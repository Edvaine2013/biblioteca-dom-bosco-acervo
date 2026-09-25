/**
 * Leitor de código de barras para a web (iOS/Android usam `barcode-scanner.tsx`).
 *
 * Por que este componente existe:
 * o `expo-camera` na web implementa a leitura com a biblioteca `jsQR`, que
 * **só** decodifica QR Code, e ainda exige `barcodeScannerSettings.barcodeTypes`
 * contendo "qr" para ligar o scanner (ver `ExpoCamera.web.js`,
 * `isQRScannerEnabled`). Como o acervo usa EAN-13/EAN-8/Code-128 — códigos de
 * barras lineares de livro — o decodificador nunca era ativado: a câmera abria
 * e nenhum código era lido.
 *
 * Aqui usamos o ZXing, que já estava nas dependências do projeto, com um
 * `MultiFormatReader` de detecção mista (1D + 2D) e `TRY_HARDER`.
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, type Result } from "@zxing/library";

export type BarcodeScannerProps = {
  /** Formatos aceitos, nos mesmos nomes usados pelo expo-camera (ex.: "ean13"). */
  formats?: string[];
  /** Chamado a cada código lido, com o texto decodificado. */
  onScanned: (data: string) => void;
  /** Chamado quando a câmera não pode ser iniciada. */
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

function describeError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permissão de câmera negada. Autorize o acesso nas configurações do navegador e tente novamente.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhuma câmera compatível foi encontrada neste dispositivo.";
    case "NotReadableError":
      return "A câmera está em uso por outro aplicativo. Feche-o e tente novamente.";
    default:
      return "Não foi possível iniciar a câmera. Verifique a permissão do navegador e use a câmera traseira do celular.";
  }
}

export function BarcodeScanner({ formats, onScanned, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
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

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, resolveFormats(formatKey.split(",")));
    // TRY_HARDER melhora a leitura de códigos 1D com pouca luz ou inclinados.
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 400,
    });

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      try {
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result: Result | undefined) => {
            if (cancelled || !result) return;
            onScannedRef.current(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("running");
        setMessage("Aponte para o código de barras ISBN na contracapa.");
      } catch (error) {
        if (cancelled) return;
        const reason = describeError(error);
        setStatus("error");
        setMessage(reason);
        onErrorRef.current?.(reason);
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      // Libera o elemento de vídeo para que a câmera seja desligada ao fechar.
      if (videoRef.current) BrowserCodeReader.cleanVideoSource(videoRef.current);
    };
  }, [formatKey]);

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
