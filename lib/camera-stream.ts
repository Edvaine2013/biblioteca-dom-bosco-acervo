/**
 * Aquisição do stream da câmera (lado nativo).
 *
 * No iOS/Android o `expo-camera` cuida da permissão e do stream ao montar o
 * `CameraView`, então aqui não há nada a fazer. A implementação real, usada
 * pelo navegador, está em `camera-stream.web.ts`.
 */
export type CameraStream = null;

export type CameraStreamResult =
  | { ok: true; stream: CameraStream }
  | { ok: false; message: string };

export async function acquireCameraStream(): Promise<CameraStreamResult> {
  return { ok: true, stream: null };
}

export function releaseCameraStream(_stream: CameraStream) {
  // Nada a liberar: o CameraView encerra a câmera ao ser desmontado.
}

export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

export async function getCameraPermissionState(): Promise<CameraPermissionState> {
  // No nativo a permissão é pedida pelo próprio `CameraView`/expo-camera.
  return "unknown";
}
