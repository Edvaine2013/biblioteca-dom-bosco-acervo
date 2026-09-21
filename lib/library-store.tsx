import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  year: string;
  shelf: string;
  coverUri?: string;
  available: boolean;
};

export type Loan = {
  id: string;
  bookId: string;
  borrower: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string;
};

type LibraryContextValue = {
  books: Book[];
  loans: Loan[];
  hydrated: boolean;
  addBook: (book: Omit<Book, "id" | "available">) => Promise<Book>;
  borrowBook: (bookId: string, borrower?: string) => void;
  returnBook: (loanId: string) => void;
};

const seedBooks: Book[] = [
  { id: "1", title: "O Pequeno Príncipe", author: "Antoine de Saint-Exupéry", category: "Literatura", year: "1943", shelf: "A-01", available: true },
  { id: "2", title: "Capitães da Areia", author: "Jorge Amado", category: "Literatura brasileira", year: "1937", shelf: "A-08", available: false },
  { id: "3", title: "Quarto de Despejo", author: "Carolina Maria de Jesus", category: "Memórias", year: "1960", shelf: "B-04", available: true },
  { id: "4", title: "O Cortiço", author: "Aluísio Azevedo", category: "Literatura brasileira", year: "1890", shelf: "A-12", available: true },
  { id: "5", title: "Vidas Secas", author: "Graciliano Ramos", category: "Literatura brasileira", year: "1938", shelf: "A-15", available: true },
];

const seedLoans: Loan[] = [
  { id: "l1", bookId: "2", borrower: "Mariana Oliveira · 2º B", borrowedAt: "12 set 2026", dueAt: "26 set 2026" },
];

const LibraryContext = createContext<LibraryContextValue | null>(null);
const BOOKS_KEY = "dom-bosco-books-v1";
const LOANS_KEY = "dom-bosco-loans-v1";

export function addBookToCollection(current: Book[], book: Omit<Book, "id" | "available">, id = String(Date.now())): Book[] {
  return [{ ...book, id, available: true }, ...current];
}

export function markBookBorrowed(current: Book[], bookId: string): Book[] {
  return current.map((book) => book.id === bookId ? { ...book, available: false } : book);
}

export function markBookReturned(current: Book[], bookId: string): Book[] {
  return current.map((book) => book.id === bookId ? { ...book, available: true } : book);
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>(seedBooks);
  const [loans, setLoans] = useState<Loan[]>(seedLoans);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(BOOKS_KEY), AsyncStorage.getItem(LOANS_KEY)]).then(([storedBooks, storedLoans]) => {
      if (storedBooks) setBooks(JSON.parse(storedBooks));
      if (storedLoans) setLoans(JSON.parse(storedLoans));
    }).finally(() => setHydrated(true));
  }, []);

  useEffect(() => { if (hydrated) AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(books)); }, [books, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(LOANS_KEY, JSON.stringify(loans)); }, [loans, hydrated]);

  const value = useMemo<LibraryContextValue>(() => ({
    books,
    loans,
    hydrated,
    addBook: async (book) => {
      const addedBook = addBookToCollection(books, book)[0];
      const nextBooks = [addedBook, ...books];
      setBooks(nextBooks);
      if (hydrated) await AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(nextBooks));
      return addedBook;
    },
    borrowBook: (bookId, borrower = "Leitor não identificado") => {
      const borrowedAt = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(" de ", " ");
      setBooks((current) => markBookBorrowed(current, bookId));
      setLoans((current) => [{ id: `l${Date.now()}`, bookId, borrower, borrowedAt, dueAt: "em 14 dias" }, ...current]);
    },
    returnBook: (loanId) => {
      const loan = loans.find((item) => item.id === loanId);
      if (!loan) return;
      setBooks((current) => markBookReturned(current, loan.bookId));
      setLoans((current) => current.map((item) => item.id === loanId ? { ...item, returnedAt: "agora" } : item));
    },
  }), [books, loans, hydrated]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("useLibrary precisa estar dentro de LibraryProvider");
  return context;
}

export function getInitials(title: string) {
  return title.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
