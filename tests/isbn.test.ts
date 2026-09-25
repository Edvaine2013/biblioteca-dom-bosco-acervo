import { describe, expect, it } from "vitest";
import { explainIsbnIssue, extractIsbn, isbnIssue, isValidIsbn, readIsbn, toIsbn13 } from "../lib/isbn";

/**
 * O bug: o leitor aceitava **qualquer** EAN-13 cujo dígito verificador
 * fechasse, então o código de controle de vendas da livraria (prefixo 789) era
 * tratado como ISBN e a consulta aos catálogos saía vazia.
 *
 * A regra correta: só é ISBN o código que começa com 978 ou 979 (prefixo
 * Bookland, reservado a publicações) **e** tem o dígito verificador correto.
 */
describe("validação estrita de ISBN", () => {
  it("aceita ISBN-13 real de editora brasileira", () => {
    expect(isValidIsbn("9788535914849")).toBe(true);
    expect(isValidIsbn("9788532530783")).toBe(true);
    expect(isValidIsbn("978-85-359-1484-9")).toBe(true);
  });

  it("rejeita código de loja ou de produto com prefixo 789", () => {
    // EAN-13 com dígito verificador válido — o que a validação antiga aceitava.
    expect(isValidIsbn("7891234567895")).toBe(false);
    expect(isbnIssue("7891234567895")).toBe("not-bookland");
    expect(isValidIsbn("7891000315507")).toBe(false);
  });

  it("rejeita EAN de produto de outros prefixos", () => {
    expect(isValidIsbn("4006381333931")).toBe(false);
    expect(isValidIsbn("1234567890128")).toBe(false);
  });

  it("explica que o código lido é de loja, não de livro", () => {
    const message = explainIsbnIssue("7891234567895");
    expect(message).toMatch(/código de loja ou de produto/i);
    expect(message).toMatch(/978|979/);
  });

  it("distingue dígito verificador errado de prefixo errado", () => {
    // 9788535914840 tem prefixo correto, mas o verificador não fecha.
    expect(isbnIssue("9788535914840")).toBe("checksum");
    expect(explainIsbnIssue("9788535914840")).toMatch(/dígito verificador/i);
  });

  it("aponta quando o valor nem tem tamanho de ISBN", () => {
    expect(isbnIssue("12345")).toBe("length");
    expect(isbnIssue("")).toBe("empty");
    expect(explainIsbnIssue("12345")).toMatch(/não é um ISBN/i);
  });

  it("aceita ISBN-10 antigo com dígito X", () => {
    expect(isValidIsbn("080442957X")).toBe(true);
    expect(isValidIsbn("0804429570")).toBe(false);
  });

  it("converte ISBN-10 no ISBN-13 equivalente", () => {
    expect(toIsbn13("8535914846")).toBe("9788535914849");
    expect(toIsbn13("9788535914849")).toBe("9788535914849");
  });
});

describe("leitura do código pelo scanner", () => {
  it("extrai o ISBN de um texto com rótulo ou hífens", () => {
    expect(extractIsbn("ISBN 978-85-359-1484-9")).toBe("9788535914849");
    expect(extractIsbn("9788535914849")).toBe("9788535914849");
  });

  it("devolve sucesso com o ISBN limpo quando o código é de livro", () => {
    const reading = readIsbn("978-85-359-1484-9");
    expect(reading).toEqual({ ok: true, isbn: "9788535914849" });
  });

  it("devolve mensagem específica quando o código é de loja", () => {
    const reading = readIsbn("7891234567895");
    expect(reading.ok).toBe(false);
    if (!reading.ok) expect(reading.message).toMatch(/código de loja ou de produto/i);
  });

  it("não confunde o código de loja com o ISBN da mesma etiqueta", () => {
    // Alguns livros trazem os dois códigos: o de loja e o ISBN. A leitura deve
    // ficar com o ISBN, ignorando o outro.
    expect(extractIsbn("7891234567895 9788535914849")).toBe("9788535914849");
  });

  it("ignora leituras parciais", () => {
    expect(readIsbn("978").ok).toBe(false);
    expect(readIsbn("CODIGO-INTERNO").ok).toBe(false);
  });
});
