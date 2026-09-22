import { describe, expect, it } from "vitest";
import { extractIsbn, isValidIsbn } from "../lib/isbn";
import { mergeCatalogBooks } from "../lib/catalog-merge";

describe("leitura de ISBN", () => {
  it("extrai ISBN-13 com espaços e hífens", () => {
    expect(extractIsbn("ISBN 978-85-359-1484-9")).toBe("9788535914849");
  });

  it("aceita ISBN-10 com dígito X", () => {
    expect(isValidIsbn("0-8044-2957-X")).toBe(true);
    expect(extractIsbn("ISBN-10: 0-8044-2957-X")).toBe("080442957X");
  });

  it("ignora números que não têm tamanho de ISBN", () => {
    expect(extractIsbn("Código interno 12345")).toBeUndefined();
  });

  it("rejeita ISBN com dígito verificador incorreto", () => {
    expect(isValidIsbn("9788535914848")).toBe(false);
    expect(extractIsbn("ISBN 9788535914848")).toBeUndefined();
  });

  it("combina campos de fontes diferentes sem perder título, ano, categoria e capa", () => {
    expect(mergeCatalogBooks("9788535914849", [
      { author: "George Orwell" },
      { title: "1984", year: "2009", category: "Literatura" },
      { coverUri: "https://example.com/capa.jpg" },
    ])).toEqual({
      isbn: "9788535914849",
      title: "1984",
      author: "George Orwell",
      year: "2009",
      category: "Literatura",
      coverUri: "https://example.com/capa.jpg",
    });
  });
});
