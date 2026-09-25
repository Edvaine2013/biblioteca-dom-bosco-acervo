/**
 * Leitor de código de barras nativo (iOS/Android).
 *
 * No nativo o `expo-camera` decodifica códigos de barras de verdade, então
 * basta o `CameraView`. A implementação para navegador — que precisa do ZXing,
 * porque o expo-camera na web só lê QR Code — está em `barcode-scanner.web.tsx`.
 */
import { CameraView, type BarcodeScanningResult } from "expo-camera";
import { StyleSheet, View } from "react-native";

export type BarcodeScannerProps = {
  /** Formatos aceitos, nos mesmos nomes usados pelo expo-camera. */
  formats?: string[];
  /** Chamado a cada código lido, com o texto decodificado. */
  onScanned: (data: string) => void;
  /** Chamado quando a câmera não pode ser iniciada. */
  onError?: (message: string) => void;
  /** Quando falso, o scanner ignora novas leituras (evita disparos repetidos). */
  active?: boolean;
};

const DEFAULT_FORMATS = ["ean13", "ean8", "code128"];

export function BarcodeScanner({ formats, onScanned, active = true }: BarcodeScannerProps) {
  return (
    <View style={styles.wrapper}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: (formats ?? DEFAULT_FORMATS) as never,
        }}
        onBarcodeScanned={
          active ? (result: BarcodeScanningResult) => onScanned(result.data) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "black", overflow: "hidden" },
});
