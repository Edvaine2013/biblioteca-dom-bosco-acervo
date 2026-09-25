/**
 * Leitor de código de barras para a web (iOS/Android usam `barcode-scanner.tsx`).
 *
 * **Por que este componente existe.**
 *
 * 1. O `expo-camera` na web decodifica com a biblioteca `jsQR`, que **só**
 *    entende QR Code, e ainda exige `barcodeScannerSettings.barcodeTypes`
 *    contendo "qr" para ligar o scanner (ver `ExpoCamera.web.js`,
 *    `isQRScannerEnabled`). Como o acervo usa EAN-13/EAN-8/Code-128 — códigos de
 *    barras lineares de livro — o decodificador nunca era ativado.
 *
 * 2. A contracapa dos livros brasileiros costuma trazer **dois códigos**: o
 *    ISBN (prefixo 978/979) e o código de controle de vendas da livraria. Se o
 *    leitor capturar o código de loja, a consulta aos catálogos sai vazia. Por
 *    isso cada quadro é decodificado em busca de **todos** os códigos visíveis e
 *    o ISBN tem prioridade absoluta sobre os demais.
 *
 * O stream da câmera chega pronto, obtido dentro do gesto do usuário por
 * `@/lib/camera-stream` (ver o comentário daquele arquivo: pedir a câmera fora
 * do gesto faz o Safari negar a permissão).
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, type Result } from "@zxing/library";
import { extractIsbn, isBooklandCandidate } from "@/lib/isbn";
import type { CameraStream } from "@/lib/camera-stream";

export type BarcodeScannerProps = {
  /** Stream já autorizado pelo usuário (obtido no clique do botão). */
  stream: CameraStream;
  /** Formatos aceitos, nos mesmos nomes usados pelo expo-camera (ex.: "ean13"). */
  formats?: string[];
  /** Chamado a cada código lido, com o texto decodificado. */
  onScanned: (data: string) => void;
  /** Chamado quando o scanner não consegue iniciar. */
  onError?: (message: string) => void;
};

const DEFAULT_FORMATS = ["ean13", "ean8", "code128"];

const FORMAT_BY_NAME: Record<string, BarcodeFormat> = {
  ean13: BarcodeFormat.EAN_13,
  ean8: BarcodeFormat.EAN_8,
  code128: BarcodeFormat.CODE_128,
  code39: BarcodeFormat.CODE_39,
  code93: BarcodeFormat.CODE_93,
  itf: BarcodeFormat.ITF,
  upc_a: BarcodeFormat.UPC_A,
  upc_e: BarcodeFormat.UPC_E,
  codabar: BarcodeFormat.CODABAR,
  qr: BarcodeFormat.QR_CODE,
};

function resolveFormats(formats?: string[]) {
  const resolved = (formats ?? DEFAULT_FORMATS)
    .map((name) => FORMAT_BY_NAME[name.toLowerCase()])
    .filter((format): format is BarcodeFormat => format !== undefined);
  return resolved.length
    ? resolved
    : [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128];
}

/** Intervalo entre tentativas de leitura, em milissegundos. */
const SCAN_INTERVAL_MS = 150;

export function BarcodeScanner({ stream, formats, onScanned, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onScannedRef = useRef(onScanned);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState<"starting" | "running" | "error">("starting");
  const [message, setMessage] = useState("Iniciando a câmera...");

  // Mantém os callbacks atuais sem reiniciar a câmera a cada render.
  onScannedRef.current = onScanned;
  onErrorRef.current = onError;

  const formatKey = (formats ?? DEFAULT_FORMATS).join(",");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const video = videoRef.current;
    if (!video || !stream) return;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, resolveFormats(formatKey.split(",")));
    // TRY_HARDER melhora a leitura de códigos 1D com pouca luz ou inclinados.
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    const bitmapCanvas = document.createElement("canvas");

    /**
     * Procura **todos** os códigos do quadro, e não apenas um.
     *
     * O ZXing decodifica um código por chamada: quando a contracapa traz o
     * código de loja e o ISBN lado a lado, ele devolve o primeiro que achar — e
     * pode ser justamente o código de loja, que não identifica livro nenhum.
     *
     * Por isso o quadro é dividido em faixas sobrepostas (esquerda, centro,
     * direita). Cada faixa é decodificada separadamente, de modo que um código
     * nunca esconda o outro. Assim é possível comparar as leituras e ficar com o
     * ISBN quando ele estiver visível.
     */
    const codesInFrame = (): string[] => {
      const found = new Set<string>();
      const frame = BrowserMultiFormatReader.createCanvasFromMediaElement(video);
      const { width, height } = frame;
      if (!width || !height) return [];

      /** Faixas verticais: divisão ampla, com 25% de sobreposição. */
      const bands: [number, number][] = [
        [0, width],
        [0, width * 0.62],
        [width * 0.38, width],
        [width * 0.25, width * 0.75],
      ];

      for (const [from, to] of bands) {
        const bandWidth = Math.max(1, Math.round(to - from));
        bitmapCanvas.width = bandWidth;
        bitmapCanvas.height = height;
        const ctx = bitmapCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) continue;
        ctx.drawImage(frame, from, 0, bandWidth, height, 0, 0, bandWidth, height);

        for (const invert of [false, true]) {
          try {
            const result: Result = reader.decodeFromCanvas(
              invert ? invertCanvas(bitmapCanvas) : bitmapCanvas,
            );
            found.add(result.getText());
          } catch {
            // Nenhum código nesta faixa/modo: segue para o próximo.
          }
        }
      }
      return [...found];
    };

    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromStream(stream, video, (result: Result | undefined) => {
        if (cancelled || !result) return;
        const readings = new Set([result.getText(), ...codesInFrame()]);
        const isbnReading = [...readings].find((value) => extractIsbn(value));
        if (isbnReading) {
          onScannedRef.current(isbnReading);
          return;
        }
        // Sem ISBN no quadro: devolve o candidato mais provável (prefixo 978/979)
        // ou, na falta dele, o que foi lido — para a tela explicar o engano.
        const booklandLooking = [...readings].find((value) => isBooklandCandidate(value));
        onScannedRef.current(booklandLooking ?? result.getText());
      })
      .then((scannerControls) => {
        if (cancelled) {
          scannerControls.stop();
          return;
        }
        controls = scannerControls;
        setStatus("running");
        setMessage("Aponte para o código de barras ISBN na contracapa.");
      })
      .catch(() => {
        if (cancelled) return;
        const reason =
          "Não foi possível iniciar a leitura. Feche e toque novamente em “Ler código de barras”.";
        setStatus("error");
        setMessage(reason);
        onErrorRef.current?.(reason);
      });

    return () => {
      // `stop()` encerra as tracks do stream e libera o vídeo.
      cancelled = true;
      controls?.stop();
    };
  }, [stream, formatKey]);

  return (
    <View style={styles.wrapper}>
      {/* Elemento nativo do navegador: o ZXing escreve o stream de vídeo aqui. */}
      <video
        ref={videoRef}
        style={styles.video as unknown as Record<string, unknown>}
        autoPlay
        muted
        playsInline
      />
      {status !== "running" ? (
        <View style={styles.overlay} pointerEvents="none">
          {status === "starting" ? <ActivityIndicator color="#D99A24" /> : null}
          <Text style={styles.overlayText}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Inverte as cores do quadro, para leitura em etiquetas com fundo escuro. */
function invertCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "black", overflow: "hidden" },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  overlayText: { color: "white", textAlign: "center", fontSize: 14, lineHeight: 20 },
});
