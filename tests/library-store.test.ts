import { describe, expect, it } from "vitest";
import { addBookToCollection, getInitials, markBookBorrowed, markBookReturned, type Book } from "../lib/library-store";

const book: Omit<Book, "id" | "available"> = {
  title: "A Bolsa Amarela",
  author: "Lygia Bojunga",
  category: "Literatura",
  year: "1976",
  shelf: "C-02",
};

describe("regras do acervo", () => {
  it("cria um registro disponível com id", () => {
    const result = addBookToCollection([], book, "test-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ ...book, id: "test-1", available: true });
  });

  it("marca um livro como emprestado e depois disponível na devolução", () => {
    const initial: Book[] = [{ ...book, id: "test-1", available: true }];
    const borrowed = markBookBorrowed(initial, "test-1");
    expect(borrowed[0].available).toBe(false);
    const returned = markBookReturned(borrowed, "test-1");
    expect(returned[0].available).toBe(true);
  });

  it("gera iniciais para a identificação visual da capa", () => {
    expect(getInitials("O Pequeno Príncipe")).toBe("OP");
  });
});
