/**
 * Mensagens e diagnóstico de erro da câmera.
 *
 * Módulo puro (sem APIs de plataforma) para ser compartilhado pelos caminhos
 * web e nativo e coberto por testes — a mensagem precisa dizer ao usuário
 * **como resolver**, não apenas que falhou.
 *
 * Além do texto, o diagnóstico carrega três decisões que a tela usa para
 * oferecer o caminho de recuperação certo:
 *
 * - `permissionDenied`: o navegador recusou por permissão. Ele não volta a
 *   perguntar sozinho; é preciso liberar nas configurações.
 * - `needsReload`: o Chrome guarda a permissão **por documento**. Quando a
 *   autorização é concedida com a página já aberta, ela continua valendo como
 *   negada até a página ser recarregada. Esta é a causa mais comum do relato
 *   "ativei a câmera nas configurações do Chrome e o erro continua".
 * - `canRetry`: a falha é temporária (câmera ocupada, aparelho lento) e vale
 *   tentar de novo sem sair da tela.
 */
export type CameraErrorInfo = {
  /** Nome original do erro (`DOMException.name`). */
  name: string;
  /** Título curto para o aviso na tela. */
  title: string;
  /** Explicação com o caminho de recuperação. */
  message: string;
  /** O navegador recusou por permissão. */
  permissionDenied: boolean;
  /** Só uma recarga da página faz o navegador reler a autorização. */
  needsReload: boolean;
  /** Vale tentar de novo sem sair da tela. */
  canRetry: boolean;
};

const GENERIC_MESSAGE =
  "Não foi possível iniciar a câmera. Verifique a permissão do navegador e use a câmera traseira do celular.";

/** Diagnóstico completo do erro, com o caminho de recuperação. */
export function cameraErrorInfo(name: string): CameraErrorInfo {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        name,
        title: "A câmera está bloqueada para este site",
        message:
          "No Chrome (Android), toque no cadeado na barra de endereços › Permissões › Câmera › Permitir. Depois recarregue a página: o Chrome só passa a valer a autorização depois de recarregar.",
        permissionDenied: true,
        needsReload: true,
        canRetry: false,
      };
    case "NotFoundError":
    case "OverconstrainedError":
      return {
        name,
        title: "Nenhuma câmera compatível",
        message: "Nenhuma câmera compatível foi encontrada neste dispositivo.",
        permissionDenied: false,
        needsReload: false,
        canRetry: false,
      };
    case "NotReadableError":
      return {
        name,
        title: "A câmera está ocupada",
        message:
          "A câmera está em uso por outro aplicativo. Feche-o e tente novamente.",
        permissionDenied: false,
        needsReload: false,
        canRetry: true,
      };
    case "AbortError":
      return {
        name,
        title: "A câmera demorou para responder",
        message: GENERIC_MESSAGE,
        permissionDenied: false,
        needsReload: false,
        canRetry: true,
      };
    default:
      return {
        name,
        title: "Não foi possível abrir a câmera",
        message: GENERIC_MESSAGE,
        permissionDenied: false,
        needsReload: false,
        canRetry: true,
      };
  }
}

/**
 * A permissão está concedida, mas esta aba ainda responde como negada.
 *
 * O Chrome resolve a permissão no momento em que o documento carrega. Quem
 * libera a câmera nas configurações **com o site já aberto** continua recebendo
 * `NotAllowedError` até recarregar — e, como o site é uma página única, navegar
 * entre as telas não recarrega nada. Sem esta explicação, o usuário conclui que
 * a autorização não funcionou.
 */
export function stalePermissionInfo(): CameraErrorInfo {
  return {
    name: "StalePermission",
    title: "Autorização concedida, mas esta aba está desatualizada",
    message:
      "O Chrome já tem a câmera liberada para este site, porém esta aba foi aberta antes da autorização e continua com a resposta antiga. Toque em “Recarregar e abrir a câmera” para o navegador reler a autorização.",
    permissionDenied: true,
    needsReload: true,
    canRetry: false,
  };
}

export function describeCameraError(name: string) {
  return cameraErrorInfo(name).message;
}

export function cameraErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  return describeCameraError(name);
}
