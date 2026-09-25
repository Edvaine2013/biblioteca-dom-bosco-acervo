import { mergeCatalogBooks, usefulCategory, type CatalogBook } from "@/lib/catalog-merge";
import { extractIsbn, isValidIsbn } from "@/lib/isbn";
export { explainIsbnIssue, extractIsbn, isbnIssue, isValidIsbn, readIsbn, toIsbn13 } from "@/lib/isbn";
export type { CatalogBook } from "@/lib/catalog-merge";

/**
 * Repositórios bibliográficos consultados, na ordem de precedência.
 *
 * A ordem importa: as fontes brasileiras vêm primeiro, então **o dado nacional
 * prevalece** e as fontes internacionais apenas completam o que faltar (capa,
 * sinopse, número de páginas). O cadastro do acervo é brasileiro, e é do CBL
 * que sai o registro oficial do ISBN no país.
 *
 * Quatro dessas fontes são alcançadas por meio da BrasilAPI, que normaliza a
 * resposta em um único formato: além de evitar quatro integrações distintas,
 * ela faz a ponte com os provedores brasileiros que não expõem API própria.
 */
export type CatalogSourceId =
  | "cbl"
  | "mercado-editorial"
  | "open-library"
  | "google-books";

export type CatalogSource = {
  id: CatalogSourceId;
  /** Nome exibido no cadastro. */
  label: string;
  /** Como o dado é obtido: pela BrasilAPI ou direto na fonte. */
  via: "brasilapi" | "direto";
  /** Origem do registro, para exibir a procedência no cadastro. */
  origin: string;
};

export const CATALOG_SOURCES: CatalogSource[] = [
  {
    id: "cbl",
    label: "CBL Serviços",
    via: "brasilapi",
    origin: "Agência Brasileira do ISBN",
  },
  {
    id: "mercado-editorial",
    label: "Mercado Editorial",
    via: "brasilapi",
    origin: "Catálogo do mercado editorial brasileiro",
  },
  {
    id: "open-library",
    label: "Open Library",
    via: "brasilapi",
    origin: "Internet Archive",
  },
  {
    id: "google-books",
    label: "Google Books",
    via: "brasilapi",
    origin: "Google",
  },
];

/** Consultas diretas, usadas para completar o que a BrasilAPI não devolver. */
export const DIRECT_SOURCES = ["Open Library (direto)", "Google Books (direto)"] as const;

/** Rótulo curto de cada fonte, como aparece em “Fonte” na ficha do livro. */
const SOURCE_LABEL: Record<string, string> = {
  cbl: "CBL Serviços",
  "mercado-editorial": "Mercado Editorial",
  "open-library": "Open Library",
  "google-books": "Google Books",
};

type BrasilApiBook = {
  isbn?: string;
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
  /** Provedor que respondeu a consulta. */
  provider?: string;
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

/** Consulta um ou mais provedores da BrasilAPI (ex.: "cbl,mercado-editorial"). */
async function lookupBrasilApi(isbn: string, providers?: string): Promise<CatalogBook | null> {
  const query = providers ? `?providers=${providers}` : "";
  const response = await fetch(
    `https://brasilapi.com.br/api/isbn/v1/${encodeURIComponent(isbn)}${query}`,
  );
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error("BrasilAPI indisponível");
  const entry = (await response.json()) as BrasilApiBook;
  if (!entry.title && !entry.authors?.length) return null;
  const provider = entry.provider?.toLowerCase() ?? "";
  return {
    isbn,
    title: entry.title,
    subtitle: entry.subtitle ?? undefined,
    author: entry.authors?.join(", "),
    publisher: entry.publisher,
    edition: entry.edition,
    year: entry.year ? String(entry.year) : undefined,
    pages: entry.page_count && entry.page_count > 0 ? entry.page_count : undefined,
    language: entry.language,
    category: entry.subjects?.find((subject) => usefulCategory(subject, entry.title)),
    description: entry.synopsis ?? undefined,
    coverUri: entry.cover_url ?? undefined,
    catalogSource: SOURCE_LABEL[provider] ?? "BrasilAPI",
  };
}

/**
 * Fontes brasileiras: é daqui que deve sair o registro principal do livro.
 * A BrasilAPI responde pelo CBL quando o ISBN está registrado no país.
 */
async function lookupBrazilianSources(isbn: string): Promise<CatalogBook | null> {
  return lookupBrasilApi(isbn, "cbl,mercado-editorial");
}

/** Espelhos internacionais servidos pela BrasilAPI. */
async function lookupBrasilApiInternational(isbn: string): Promise<CatalogBook | null> {
  return lookupBrasilApi(isbn, "open-library,google-books");
}

async function lookupGoogleBooks(isbn: string): Promise<CatalogBook | null> {
  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`,
  );
  if (!response.ok) throw new Error("Google Books indisponível");
  const data = (await response.json()) as { items?: GoogleBook[] };
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
    coverUri: (entry.imageLinks?.thumbnail ?? entry.imageLinks?.smallThumbnail)?.replace(
      "http://",
      "https://",
    ),
    catalogSource: "Google Books",
  };
}

async function lookupOpenLibrary(isbn: string): Promise<CatalogBook | null> {
  const response = await fetch(
    `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=title,author_name,first_publish_year,subject,cover_i,language`,
  );
  if (!response.ok) throw new Error("Open Library indisponível");
  const data = (await response.json()) as {
    docs?: {
      title?: string;
      author_name?: string[];
      first_publish_year?: number;
      subject?: string[];
      cover_i?: number;
      language?: string[];
    }[];
  };
  const entry = data.docs?.[0];
  if (!entry?.title && !entry?.author_name?.length) return null;
  return {
    isbn,
    title: entry.title,
    author: entry.author_name?.filter(Boolean).join(", "),
    year: entry.first_publish_year ? String(entry.first_publish_year) : undefined,
    language: pickLanguage(entry.language),
    // O campo `subject` da Open Library é uma folksonomia de etiquetas em
    // inglês ("Ghosts", "Monsters"), não um cabeçalho de assunto bibliográfico.
    // Numa ficha em português isso apareceria como "Categoria: Ghosts", então a
    // categoria fica reservada às fontes brasileiras — o campo continua
    // editável no cadastro para quem quiser classificar manualmente.
    category: undefined,
    coverUri: entry.cover_i
      ? `https://covers.openlibrary.org/b/id/${entry.cover_i}-L.jpg`
      : undefined,
    catalogSource: "Open Library",
  };
}

/**
 * Busca o livro em todos os repositórios e devolve a ficha consolidada.
 *
 * As consultas saem em paralelo; a ordem do array define a precedência
 * (brasileiras primeiro, internacionais depois). Se um repositório falhar ou
 * estiver fora do ar, os demais seguem — uma fonte indisponível não pode
 * impedir o cadastro.
 */
export async function lookupBookByIsbn(isbn: string): Promise<CatalogBook | null> {
  const normalized = extractIsbn(isbn);
  if (!normalized || !isValidIsbn(normalized)) return null;

  const results = await Promise.allSettled([
    lookupBrazilianSources(normalized),
    lookupBrasilApiInternational(normalized),
    lookupOpenLibrary(normalized),
    lookupGoogleBooks(normalized),
  ]);

  const entries = results.map((result) =>
    result.status === "fulfilled" ? result.value : null,
  );
  const merged = mergeCatalogBooks(normalized, entries);
  if (!merged) return null;
  return merged;
}

/**
 * Nome dos repositórios em que o livro foi encontrado, na ordem de precedência.
 * A BrasilAPI devolve o provedor que respondeu, então o rótulo já chega pronto
 * em `catalogSource`.
 */
export function sourcesLabel(catalogSource?: string) {
  return catalogSource?.trim() || "";
}
