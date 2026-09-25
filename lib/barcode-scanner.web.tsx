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
 *    isso cada quadro é varrido em faixas sobrepostas e o ISBN tem prioridade
 *    absoluta sobre os demais (ver `@/lib/barcode-decode`).
 *
 * O stream da câmera chega pronto, obtido dentro do gesto do usuário por
 * `@/lib/camera-stream` (ver o comentário daquele arquivo: pedir a câmera fora
 * do gesto faz o Safari negar a permissão).
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, type Result } from "@zxing/library";
import { bandsFor, invertCanvas, pickBestReading } from "@/lib/barcode-decode";
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
  /** Quando falso, o scanner ignora novas leituras (evita disparos repetidos). */
  active?: boolean;
};

const DEFAULT_FORMATS = ["ean13", "ean8", "code128"];

const FORMAT_BY_NAME: Record<string, BarcodeFormat> = {
  ean13: BarcodeFormat.EAN_13,
  ean8: BarcodeFormat.EAN_8,
  code128: BarcodeFormat.CODE_128,
  code39: BarcodeFormat.CODE_39,
  code93: BarcodeFormat.CODE_93,
  itf: BarcodeFormat.ITF,
  upa: BarcodeFormat.UPC_A,
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

export function BarcodeScanner({
  stream,
  formats,
  onScanned,
  onError,
  active = true,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onScannedRef = useRef(onScanned);
  const onErrorRef = useRef(onError);
  const activeRef = useRef(active);
  const [status, setStatus] = useState<"starting" | "running" | "error">("starting");
  const [message, setMessage] = useState("Iniciando a câmera...");

  // Mantém os callbacks atuais sem reiniciar a câmera a cada render.
  onScannedRef.current = onScanned;
  onErrorRef.current = onError;
  activeRef.current = active;

  const formatKey = (formats ?? DEFAULT_FORMATS).join(",");

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video || !stream) return;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, resolveFormats(formatKey.split(",")));
    // TRY_HARDER melhora a leitura de códigos 1D com pouca luz ou inclinados.
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    const bitmapCanvas = document.createElement("canvas");

    /** Reúne todos os códigos visíveis no quadro, faixa por faixa. */
    const codesInFrame = (): string[] => {
      const found = new Set<string>();
      let frame: HTMLCanvasElement;
      try {
        frame = BrowserMultiFormatReader.createCanvasFromMediaElement(video);
      } catch {
        return [];
      }
      const { width, height } = frame;
      if (!width || !height) return [];

      for (const [from, to] of bandsFor(width)) {
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
        if (cancelled || !result || !activeRef.current) return;
        const readings = new Set([result.getText(), ...codesInFrame()]);
        const best = pickBestReading(readings);
        if (best) onScannedRef.current(best);
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
