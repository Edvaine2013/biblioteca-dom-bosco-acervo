import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireCameraStream } from "../lib/camera-stream.web";

/**
 * Regressões da aquisição do stream.
 *
 * O relato real foi: *"ativei a autorização de uso da câmera na configuração do
 * Google Chrome e o erro continua"*. Há duas causas distintas, e as duas
 * precisam produzir o caminho de recuperação certo:
 *
 * 1. O aparelho recusa a combinação de restrições pedida (alguns Androids
 *    respondem `OverconstrainedError` a `facingMode` + resolução) — a solução é
 *    tentar uma restrição mais simples, sem incomodar o usuário.
 * 2. A permissão já está concedida, mas esta aba foi aberta antes da autorização
 *    e continua com a resposta antiga — a solução é recarregar a página, e a
 *    tela precisa dizer isso.
 */
const fakeStream = { getTracks: () => [] } as unknown as MediaStream;

function stubNavigator(options: {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  permission?: string;
}) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: { getUserMedia: options.getUserMedia },
      permissions: {
        query: async () => ({ state: options.permission ?? "prompt" }),
      },
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "navigator");
});

describe("aquisição do stream da câmera", () => {
  it("usa a câmera traseira quando o aparelho aceita", async () => {
    const asked: MediaStreamConstraints[] = [];
    stubNavigator({
      getUserMedia: async (constraints) => {
        asked.push(constraints);
        return fakeStream;
      },
    });

    const result = await acquireCameraStream();
    expect(result.ok).toBe(true);
    expect(asked).toHaveLength(1);
    expect(JSON.stringify(asked[0])).toMatch(/environment/);
  });

  it("cai para uma restrição mais simples quando o aparelho recusa a combinação", async () => {
    const asked: string[] = [];
    stubNavigator({
      getUserMedia: async (constraints) => {
        asked.push(JSON.stringify(constraints.video));
        // Aparelho que só aceita o pedido mais simples.
        if (typeof constraints.video === "object" && "facingMode" in (constraints.video ?? {})) {
          const error = new Error("constraint");
          error.name = "OverconstrainedError";
          throw error;
        }
        return fakeStream;
      },
    });

    const result = await acquireCameraStream();
    expect(result.ok).toBe(true);
    // Tentou mais de uma vez antes de conseguir.
    expect(asked.length).toBeGreaterThan(1);
    expect(asked[asked.length - 1]).toBe("true");
  });

  it("não insiste em variações quando o erro é de permissão", async () => {
    let attempts = 0;
    stubNavigator({
      getUserMedia: async () => {
        attempts += 1;
        const error = new Error("denied");
        error.name = "NotAllowedError";
        throw error;
      },
      permission: "denied",
    });

    const result = await acquireCameraStream();
    expect(result.ok).toBe(false);
    // Permissão negada não melhora mudando a restrição: uma tentativa basta.
    expect(attempts).toBe(1);
    if (!result.ok) {
      expect(result.issue.permissionDenied).toBe(true);
      expect(result.issue.needsReload).toBe(true);
      expect(result.issue.message).toMatch(/cadeado/i);
    }
  });

  it("explica que a autorização recém-concedida exige recarregar a página", async () => {
    // O caso central do relato: o Chrome já tem a câmera liberada, mas a aba
    // foi aberta antes da autorização e continua respondendo como negada.
    stubNavigator({
      getUserMedia: async () => {
        const error = new Error("denied");
        error.name = "NotAllowedError";
        throw error;
      },
      permission: "granted",
    });

    const result = await acquireCameraStream();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue.needsReload).toBe(true);
      expect(result.issue.title).toMatch(/autorização concedida/i);
      expect(result.issue.message).toMatch(/Recarregar/i);
    }
  });

  it("oferece nova tentativa quando a câmera está ocupada", async () => {
    stubNavigator({
      getUserMedia: async () => {
        const error = new Error("busy");
        error.name = "NotReadableError";
        throw error;
      },
    });

    const result = await acquireCameraStream();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue.canRetry).toBe(true);
      expect(result.issue.needsReload).toBe(false);
      expect(result.issue.message).toMatch(/em uso por outro aplicativo/i);
    }
  });

  it("orienta a usar a foto quando o navegador não expõe a câmera", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });

    const result = await acquireCameraStream();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue.title).toMatch(/não libera a câmera/i);
      // O caminho alternativo precisa ser citado na mensagem.
      expect(result.issue.message).toMatch(/foto/i);
    }
  });
});
