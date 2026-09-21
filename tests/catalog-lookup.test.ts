import { describe, expect, it } from "vitest";
import { extractIsbn, isValidIsbn } from "../lib/isbn";

describe("leitura de ISBN", () => {
  it("extrai ISBN-13 com espaços e hífens", () => {
    expect(extractIsbn("ISBN 978-85-359-1484-9")).toBe("9788535914849");
  });

  it("aceita ISBN-10 com dígito X", () => {
    expect(isValidIsbn("0-306-40615-X")).toBe(true);
    expect(extractIsbn("ISBN-10: 0-306-40615-X")).toBe("030640615X");
  });

  it("ignora números que não têm tamanho de ISBN", () => {
    expect(extractIsbn("Código interno 12345")).toBeUndefined();
  });
});
