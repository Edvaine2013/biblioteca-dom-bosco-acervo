import { describe, expect, it } from "vitest";
import { bandsFor, pickBestReading } from "../lib/barcode-decode";

/**
 * Regressões da escolha de leitura.
 *
 * Na contracapa dos livros brasileiros convivem o código de controle de vendas
 * da livraria e o ISBN, lado a lado. O decodificador devolve um código por vez,
 * então a regra de escolha precisa garantir que **o ISBN vença sempre** — e que
 * o código de loja só apareça quando não houver ISBN algum no quadro, para a
 * tela explicar que o alvo estava errado.
 */
describe("escolha da leitura entre os códigos do quadro", () => {
  it("prefere o ISBN quando os dois códigos aparecem juntos", () => {
    expect(pickBestReading(["7891234567895", "9788535914849"])).toBe("9788535914849");
    // A ordem não pode influenciar o resultado.
    expect(pickBestReading(["9788535914849", "7891234567895"])).toBe("9788535914849");
  });

  it("devolve o código de loja apenas quando não há ISBN visível", () => {
    expect(pickBestReading(["7891234567895"])).toBe("7891234567895");
  });

  it("prefere um candidato com prefixo de livro a um código qualquer", () => {
    // Prefixo 978 com dígito errado: é o alvo mais provável, e a tela explica
    // que a leitura ficou incompleta.
    expect(pickBestReading(["7891234567895", "9788535914840"])).toBe("9788535914840");
  });

  it("ignora valores vazios vindos do decodificador", () => {
    expect(pickBestReading(["", "9788535914849"])).toBe("9788535914849");
    expect(pickBestReading([])).toBeUndefined();
  });

  it("aceita ISBN-10 antigo como leitura válida", () => {
    expect(pickBestReading(["7891234567895", "080442957X"])).toBe("080442957X");
  });
});

describe("faixas de varredura do quadro", () => {
  it("cobre o quadro inteiro e as laterais separadamente", () => {
    const bands = bandsFor(1000);
    expect(bands[0]).toEqual([0, 1000]); // quadro inteiro
    expect(bands).toHaveLength(4);
    // Cada faixa lateral precisa enxergar a metade correspondente.
    expect(bands[1][1]).toBeGreaterThan(500); // esquerda chega ao centro
    expect(bands[2][0]).toBeLessThan(500); // direita começa antes do centro
  });

  it("mantém as faixas sobrepostas para não cortar um código na divisa", () => {
    const bands = bandsFor(1000);
    const [, left] = bands[1];
    const [rightStart] = bands[2];
    // A sobreposição garante que um código na divisa apareça inteiro em alguma faixa.
    expect(left).toBeGreaterThan(rightStart);
  });

  it("não gera faixas para largura inválida", () => {
    expect(bandsFor(0)).toEqual([]);
    expect(bandsFor(-10)).toEqual([]);
    expect(bandsFor(Number.NaN)).toEqual([]);
  });
});
