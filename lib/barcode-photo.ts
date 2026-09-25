/**
 * Leitura por foto no lado nativo (iOS/Android).
 *
 * No nativo o `expo-camera` lê o código ao vivo com `CameraView`, então este
 * caminho é exclusivo do navegador — a implementação real está em
 * `barcode-photo.web.ts`.
 */
export type PhotoReading =
  | { ok: true; code: string }
  | { ok: false; message: string };

export async function pickBarcodePhoto(): Promise<File | null> {
  return null;
}

export async function decodeBarcodePhoto(_file: File): Promise<PhotoReading> {
  return { ok: false, message: "Leitura por foto disponível apenas no navegador." };
}
