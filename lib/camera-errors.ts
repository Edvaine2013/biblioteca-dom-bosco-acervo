/**
 * Mensagens de erro da câmera.
 *
 * Módulo puro (sem APIs de plataforma) para ser compartilhado pelos caminhos
 * web e nativo e coberto por testes — a mensagem precisa dizer ao usuário
 * **como resolver**, não apenas que falhou.
 */
export function describeCameraError(errorName: string) {
  switch (errorName) {
    case "NotAllowedError":
    case "SecurityError":
      return "O navegador bloqueou a câmera para este site. Para liberar: toque em “AA” ou no cadeado na barra de endereços e permita a câmera. No iPhone, confira também em Ajustes › Safari › Câmera. Depois toque em “Ler código de barras” de novo.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhuma câmera compatível foi encontrada neste dispositivo.";
    case "NotReadableError":
      return "A câmera está em uso por outro aplicativo. Feche-o e tente novamente.";
    default:
      return "Não foi possível iniciar a câmera. Verifique a permissão do navegador e use a câmera traseira do celular.";
  }
}

export function cameraErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  return describeCameraError(name);
}
