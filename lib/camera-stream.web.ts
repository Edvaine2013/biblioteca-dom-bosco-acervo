/**
 * Aquisição do stream da câmera no navegador.
 *
 * **Por que este módulo existe** (correção do erro "Permissão de câmera negada"):
 *
 * O `getUserMedia` precisa ser chamado **dentro do gesto do usuário** (o clique
 * no botão "Ler código de barras"). Quando a chamada parte de um `useEffect`
 * — como faz o `expo-camera` na web, e como fazia a primeira versão do nosso
 * scanner — o Safari (sobretudo no iOS) recusa a solicitação e ainda marca a
 * permissão como negada para o site, sem sequer exibir o pedido de autorização.
 *
 * Por isso o stream é obtido aqui, de forma síncrona com o clique, e só então
 * entregue ao componente do scanner.
 */

export type CameraStream = MediaStream;

export type CameraStreamResult =
  | { ok: true; stream: CameraStream }
  | { ok: false; message: string };

import { cameraErrorMessage } from "@/lib/camera-errors";

export { describeCameraError } from "@/lib/camera-errors";

export async function acquireCameraStream(): Promise<CameraStreamResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      message:
        "Este navegador não libera a câmera. Abra o site pelo Safari ou pelo Chrome, diretamente (não por dentro do WhatsApp ou Instagram).",
    };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    return { ok: true, stream };
  } catch (error) {
    return { ok: false, message: cameraErrorMessage(error) };
  }
}

export function releaseCameraStream(stream: CameraStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

/**
 * Consulta o estado da permissão de câmera para este site.
 *
 * Serve para avisar o usuário **antes** de ele tocar em "Ler código de
 * barras": quando a permissão já foi negada uma vez, o Safari não volta a
 * perguntar e toda tentativa falha imediatamente — sem orientação, parece que
 * o recurso está quebrado.
 */
export async function getCameraPermissionState(): Promise<CameraPermissionState> {
  if (typeof navigator === "undefined") return "unknown";
  try {
    const status = await navigator.permissions?.query({ name: "camera" as PermissionName });
    return (status?.state as CameraPermissionState) ?? "unknown";
  } catch {
    // Safari antigo não expõe a Permissions API para câmera.
    return "unknown";
  }
}
