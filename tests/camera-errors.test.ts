import { describe, expect, it } from "vitest";
import { describeCameraError } from "../lib/camera-errors";

/**
 * Regressões do erro "Permissão de câmera negada".
 *
 * Quando a permissão é negada, o navegador não volta a perguntar, então a única
 * saída é o usuário desbloquear nas configurações do site. A mensagem precisa
 * dizer isso — antes, a tela apenas informava que a permissão havia sido
 * negada, sem caminho de recuperação.
 */
describe("mensagens de erro da câmera", () => {
  it("ensina a desbloquear quando a permissão foi negada", () => {
    const message = describeCameraError("NotAllowedError");
    // A mensagem precisa indicar o caminho de desbloqueio no Chrome/Android.
    expect(message).toMatch(/cadeado/i);
    expect(message).toMatch(/Permissões/i);
    expect(message).toMatch(/Permitir/i);
  });

  it("trata também o caso de bloqueio por política de segurança", () => {
    expect(describeCameraError("SecurityError")).toMatch(/cadeado|barra de endereços/i);
  });

  it("distingue câmera ausente de câmera em uso por outro app", () => {
    expect(describeCameraError("NotFoundError")).toMatch(/nenhuma câmera compatível/i);
    expect(describeCameraError("OverconstrainedError")).toMatch(/nenhuma câmera compatível/i);
    expect(describeCameraError("NotReadableError")).toMatch(/em uso por outro aplicativo/i);
  });

  it("mantém uma orientação genérica para falhas não mapeadas", () => {
    expect(describeCameraError("AbortError")).toMatch(/não foi possível iniciar a câmera/i);
    expect(describeCameraError("")).toMatch(/não foi possível iniciar a câmera/i);
  });

  it("nunca devolve mensagem vazia", () => {
    for (const name of ["NotAllowedError", "NotFoundError", "NotReadableError", "Outro"]) {
      expect(describeCameraError(name).length).toBeGreaterThan(20);
    }
  });
});
