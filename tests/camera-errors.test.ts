import { describe, expect, it } from "vitest";
import { cameraErrorInfo, describeCameraError, stalePermissionInfo } from "../lib/camera-errors";

/**
 * Regressões do erro "Permissão de câmera negada".
 *
 * O relato real foi: *"ativei a autorização de uso da câmera na configuração do
 * Google Chrome e o erro continua"*. A causa é que o Chrome resolve a permissão
 * no carregamento do documento: quem libera a câmera com o site já aberto
 * continua recebendo `NotAllowedError` até recarregar a página. Como o site é
 * uma página única, navegar entre as telas não recarrega nada — sem uma saída
 * explícita, a autorização parece não ter funcionado.
 *
 * Os testes fixam as três decisões que a tela precisa tomar: oferecer recarga,
 * oferecer nova tentativa, ou apenas explicar o bloqueio.
 */
describe("diagnóstico do erro de câmera", () => {
  it("ensina a desbloquear quando a permissão foi negada", () => {
    const info = cameraErrorInfo("NotAllowedError");
    expect(info.message).toMatch(/cadeado/i);
    expect(info.message).toMatch(/Permissões/i);
    expect(info.message).toMatch(/Permitir/i);
    expect(info.permissionDenied).toBe(true);
  });

  it("pede recarga da página quando o navegador recusou por permissão", () => {
    // Sem a recarga, o Chrome continua com a resposta antiga e a autorização
    // concedida nas configurações não passa a valer.
    expect(cameraErrorInfo("NotAllowedError").needsReload).toBe(true);
    expect(cameraErrorInfo("SecurityError").needsReload).toBe(true);
  });

  it("explica o caso da autorização concedida que ainda não vale nesta aba", () => {
    const info = stalePermissionInfo();
    expect(info.needsReload).toBe(true);
    expect(info.permissionDenied).toBe(true);
    expect(info.message).toMatch(/Recarregar/i);
    expect(info.title).toMatch(/autorização concedida/i);
  });

  it("trata também o caso de bloqueio por política de segurança", () => {
    expect(describeCameraError("SecurityError")).toMatch(/cadeado|barra de endereços/i);
  });

  it("distingue câmera ausente de câmera em uso por outro app", () => {
    expect(describeCameraError("NotFoundError")).toMatch(/nenhuma câmera compatível/i);
    expect(describeCameraError("OverconstrainedError")).toMatch(/nenhuma câmera compatível/i);
    expect(describeCameraError("NotReadableError")).toMatch(/em uso por outro aplicativo/i);
  });

  it("oferece nova tentativa apenas quando a falha é temporária", () => {
    // Câmera ocupada melhora fechando o outro app; permissão negada não.
    expect(cameraErrorInfo("NotReadableError").canRetry).toBe(true);
    expect(cameraErrorInfo("NotAllowedError").canRetry).toBe(false);
    expect(cameraErrorInfo("NotFoundError").canRetry).toBe(false);
  });

  it("mantém uma orientação genérica para falhas não mapeadas", () => {
    expect(describeCameraError("AbortError")).toMatch(/não foi possível iniciar a câmera/i);
    expect(describeCameraError("")).toMatch(/não foi possível iniciar a câmera/i);
    expect(cameraErrorInfo("").canRetry).toBe(true);
  });

  it("nunca devolve mensagem vazia e sempre traz um título", () => {
    for (const name of ["NotAllowedError", "NotFoundError", "NotReadableError", "Outro", ""]) {
      const info = cameraErrorInfo(name);
      expect(info.message.length).toBeGreaterThan(20);
      expect(info.title.length).toBeGreaterThan(5);
      expect(info.name).toBe(name);
    }
  });
});
