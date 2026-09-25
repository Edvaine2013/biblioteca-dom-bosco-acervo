/**
 * Aquisição do stream da câmera no navegador.
 *
 * **Por que este módulo existe.**
 *
 * 1. O `getUserMedia` precisa ser chamado **dentro do gesto do usuário** (o
 *    clique no botão "Ler código de barras"). Quando a chamada parte de um
 *    `useEffect` — como faz o `expo-camera` na web — o Safari recusa a
 *    solicitação e ainda marca a permissão como negada para o site.
 *
 * 2. Cada aparelho aceita um conjunto diferente de restrições. Pedir
 *    `facingMode` **e** resolução de uma vez faz alguns Androids responderem
 *    `OverconstrainedError` — ou `NotAllowedError`, que parece permissão negada
 *    sem ser. Por isso as restrições são tentadas em ordem, da mais específica
 *    para a mais simples.
 *
 * 3. Quando a permissão é negada, é preciso saber **por quê** para oferecer a
 *    saída certa: liberar no navegador, recarregar a página (o Chrome resolve a
 *    permissão no carregamento do documento) ou simplesmente tentar de novo.
 */
import { cameraErrorInfo, stalePermissionInfo, type CameraErrorInfo } from "@/lib/camera-errors";

export type CameraStream = MediaStream;

export type CameraStreamResult =
  | { ok: true; stream: CameraStream }
  | { ok: false; issue: CameraErrorInfo };

export { describeCameraError } from "@/lib/camera-errors";

/**
 * Restrições tentadas em ordem. A primeira que o aparelho aceitar é usada.
 *
 * Só vale passar para a seguinte quando o erro for `OverconstrainedError` ou
 * `TypeError` — ou seja, quando o problema é a combinação pedida. Erros de
 * permissão e de câmera ocupada não melhoram mudando a restrição.
 */
const CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  { video: { facingMode: { ideal: "environment" } } },
  { video: true },
];

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "";
}

async function requestCamera(): Promise<{ stream?: MediaStream; error?: unknown }> {
  let lastError: unknown;
  for (const constraints of CAMERA_CONSTRAINTS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { stream };
    } catch (error) {
      lastError = error;
      const name = errorName(error);
      // Apenas restrição incompatível justifica tentar uma combinação mais simples.
      if (name !== "OverconstrainedError" && name !== "TypeError") break;
    }
  }
  return { error: lastError };
}

export async function acquireCameraStream(): Promise<CameraStreamResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      issue: {
        name: "UnsupportedError",
        title: "Este navegador não libera a câmera",
        message:
          "Abra o site pelo Chrome ou pelo Safari, diretamente (não por dentro do WhatsApp ou Instagram). Você também pode usar “Ler de uma foto”, que funciona em qualquer navegador.",
        permissionDenied: false,
        needsReload: false,
        canRetry: false,
      },
    };
  }

  const { stream, error } = await requestCamera();
  if (stream) return { ok: true, stream };

  const info = cameraErrorInfo(errorName(error));

  // Caso mais comum do relato "libere a câmera no Chrome e o erro continua":
  // a autorização foi concedida com a página já aberta e esta aba ainda guarda
  // a resposta antiga. Só uma recarga faz o navegador reler a permissão.
  if (info.permissionDenied && (await getCameraPermissionState()) === "granted") {
    return { ok: false, issue: stalePermissionInfo() };
  }

  return { ok: false, issue: info };
}

export function releaseCameraStream(stream: CameraStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

/**
 * Consulta o estado da permissão de câmera para este site.
 *
 * Serve para dois fins: avisar o usuário **antes** de ele tocar em "Ler código
 * de barras" quando a permissão já foi negada (o navegador não volta a
 * perguntar) e distinguir a autorização recém-concedida que ainda não vale
 * nesta aba.
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
