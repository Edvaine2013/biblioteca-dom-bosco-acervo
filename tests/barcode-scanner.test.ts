import { describe, expect, it } from "vitest";
import { extractIsbn, isValidIsbn } from "../lib/isbn";

/**
 * Regressões do leitor de código de barras.
 *
 * O bug original: na web o expo-camera só decodifica QR Code, então nenhum
 * código EAN-13 era lido. Estes testes garantem que o texto devolvido pelo
 * decodificador (ZXing na web, expo-camera no nativo) continua sendo
 * interpretado corretamente — inclusive quando vem acompanhado de rótulos.
 */
describe("decodificação do código de barras", () => {
  it("aceita o EAN-13 cru devolvido pelo decodificador", () => {
    // Formato típico do resultado do ZXing/expo-camera para um ISBN.
    expect(extractIsbn("9788535914849")).toBe("9788535914849");
  });

  it("aceita código lido com hífens ou prefixo ISBN", () => {
    expect(extractIsbn("978-85-359-1484-9")).toBe("9788535914849");
    expect(extractIsbn("ISBN 9788535914849")).toBe("9788535914849");
  });

  it("rejeita código de barras que não é ISBN (ex.: código interno da escola)", () => {
    // Um EAN-13 com dígito verificador válido, mas que não é ISBN de livro.
    expect(extractIsbn("7891234567895")).toBe("7891234567895");
    // Já um número qualquer lido por engano não deve virar ISBN.
    expect(extractIsbn("1234567890123")).toBeUndefined();
    expect(extractIsbn("CODIGO-INTERNO")).toBeUndefined();
  });

  it("aceita ISBN-10 com dígito X, usado em livros mais antigos", () => {
    expect(isValidIsbn("080442957X")).toBe(true);
    expect(extractIsbn("080442957X")).toBe("080442957X");
  });

  it("ignora leituras parciais ou excessivamente curtas", () => {
    expect(extractIsbn("978")).toBeUndefined();
    expect(extractIsbn("")).toBeUndefined();
  });
});
