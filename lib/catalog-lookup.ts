import { mergeCatalogBooks, usefulCategory, type CatalogBook } from "@/lib/catalog-merge";
import { extractIsbn, isValidIsbn } from "@/lib/isbn";
export { extractIsbn, isValidIsbn } from "@/lib/isbn";
export type { CatalogBook } from "@/lib/catalog-merge";

type BrasilApiBook = {
  title?: string;
  authors?: string[];
  year?: number;
  subjects?: string[];
  cover_url?: string | null;
};

type GoogleBook = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

export const CATALOG_SOURCES = [
  "CBL Serviços via BrasilAPI",
  "Google Books",
  "Open Library",
] as const;

async function lookupBrasilApi(isbn: string): Promise<CatalogBook | null> {
  const response = await fetch(`https://brasilapi.com.br/api/isbn/v1/${encodeURIComponent(isbn)}?providers=cbl,mercado-editorial,open-library,google-books`);
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error("BrasilAPI indisponível");
  const entry = await response.json() as BrasilApiBook;
  if (!entry.title && !entry.authors?.length) return null;
  return {
    isbn,
    title: entry.title,
    author: entry.authors?.join(", "),
    year: entry.year ? String(entry.year) : undefined,
    category: entry.subjects?.find((subject) => usefulCategory(subject, entry.title)),
    coverUri: entry.cover_url ?? undefined,
  };
}

async function lookupGoogleBooks(isbn: string): Promise<CatalogBook | null> {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`);
  if (!response.ok) throw new Error("Google Books indisponível");
  const data = await response.json() as { items?: GoogleBook[] };
  const entry = data.items?.[0]?.volumeInfo;
  if (!entry?.title && !entry?.authors?.length) return null;
  return {
    isbn,
    title: entry.title,
    author: entry.authors?.join(", "),
    year: entry.publishedDate?.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1],
    category: entry.categories?.find((category) => usefulCategory(category, entry.title)),
    coverUri: (entry.imageLinks?.thumbnail ?? entry.imageLinks?.smallThumbnail)?.replace("http://", "https://"),
  };
}

async function lookupOpenLibrary(isbn: string): Promise<CatalogBook | null> {
  const response = await fetch(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=title,author_name,first_publish_year,subject,cover_i`);
  if (!response.ok) throw new Error("Open Library indisponível");
  const data = await response.json() as { docs?: { title?: string; author_name?: string[]; first_publish_year?: number; subject?: string[]; cover_i?: number }[] };
  const entry = data.docs?.[0];
  if (!entry?.title && !entry?.author_name?.length) return null;
  return {
    isbn,
    title: entry.title,
    author: entry.author_name?.filter(Boolean).join(", "),
    year: entry.first_publish_year ? String(entry.first_publish_year) : undefined,
    category: entry.subject?.find((subject) => usefulCategory(subject, entry.title)),
    coverUri: entry.cover_i ? `https://covers.openlibrary.org/b/id/${entry.cover_i}-L.jpg` : undefined,
  };
}

export async function lookupBookByIsbn(isbn: string): Promise<CatalogBook | null> {
  const normalized = extractIsbn(isbn);
  if (!normalized || !isValidIsbn(normalized)) return null;
  const results = await Promise.allSettled([
    lookupBrasilApi(normalized),
    lookupGoogleBooks(normalized),
    lookupOpenLibrary(normalized),
  ]);
  const entries = results.map((result) => result.status === "fulfilled" ? result.value : null);
  return mergeCatalogBooks(normalized, entries);
}
