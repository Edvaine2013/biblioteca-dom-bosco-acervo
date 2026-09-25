import { mergeCatalogBooks, usefulCategory, type CatalogBook } from "@/lib/catalog-merge";
import { extractIsbn, isValidIsbn } from "@/lib/isbn";
export { extractIsbn, isValidIsbn } from "@/lib/isbn";
export type { CatalogBook } from "@/lib/catalog-merge";

type BrasilApiBook = {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  edition?: string;
  year?: number;
  /** A BrasilAPI expõe o total de páginas em `page_count` (não `pages`). */
  page_count?: number;
  language?: string;
  /** A BrasilAPI expõe a descrição em `synopsis` (não `description`). */
  synopsis?: string;
  subjects?: string[];
  cover_url?: string | null;
};

type GoogleBook = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    language?: string;
    description?: string;
    industryIdentifiers?: { type?: string; identifier?: string }[];
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

/**
 * A Open Library devolve `language` como a lista de idiomas de *todas* as
 * edições da obra, então o primeiro item costuma não representar a edição
 * catalogada (ex.: "cat" para 1984). Priorizamos português — o acervo é de uma
 * escola brasileira — e, na ausência dele, um idioma ocidental comum.
 */
const PREFERRED_LANGUAGES = ["por", "eng", "spa", "fra", "ita", "deu"];

function pickLanguage(languages?: string[]) {
  if (!languages?.length) return undefined;
  return PREFERRED_LANGUAGES.map((code) => languages.find((item) => item === code)).find(Boolean);
}

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
    subtitle: entry.subtitle,
    author: entry.authors?.join(", "),
    publisher: entry.publisher,
    edition: entry.edition,
    year: entry.year ? String(entry.year) : undefined,
    pages: entry.page_count && entry.page_count > 0 ? entry.page_count : undefined,
    language: entry.language,
    category: entry.subjects?.find((subject) => usefulCategory(subject, entry.title)),
    description: entry.synopsis,
    coverUri: entry.cover_url ?? undefined,
    catalogSource: "BrasilAPI",
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
    subtitle: entry.subtitle,
    author: entry.authors?.join(", "),
    publisher: entry.publisher,
    year: entry.publishedDate?.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1],
    pages: entry.pageCount,
    language: entry.language,
    category: entry.categories?.find((category) => usefulCategory(category, entry.title)),
    description: entry.description,
    coverUri: (entry.imageLinks?.thumbnail ?? entry.imageLinks?.smallThumbnail)?.replace("http://", "https://"),
    catalogSource: "Google Books",
  };
}

async function lookupOpenLibrary(isbn: string): Promise<CatalogBook | null> {
  const response = await fetch(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=title,author_name,first_publish_year,subject,cover_i,language`);
  if (!response.ok) throw new Error("Open Library indisponível");
  const data = await response.json() as { docs?: { title?: string; author_name?: string[]; first_publish_year?: number; subject?: string[]; cover_i?: number; language?: string[] }[] };
  const entry = data.docs?.[0];
  if (!entry?.title && !entry?.author_name?.length) return null;
  return {
    isbn,
    title: entry.title,
    author: entry.author_name?.filter(Boolean).join(", "),
    year: entry.first_publish_year ? String(entry.first_publish_year) : undefined,
    language: pickLanguage(entry.language),
    category: entry.subject?.find((subject) => usefulCategory(subject, entry.title)),
    coverUri: entry.cover_i ? `https://covers.openlibrary.org/b/id/${entry.cover_i}-L.jpg` : undefined,
    catalogSource: "Open Library",
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
