export type CatalogBook = {
  isbn?: string;
  title?: string;
  subtitle?: string;
  author?: string;
  publisher?: string;
  edition?: string;
  year?: string;
  pages?: number;
  language?: string;
  category?: string;
  description?: string;
  coverUri?: string;
  catalogSource?: string;
};

function clean(value?: string) {
  const result = value?.trim();
  return result || undefined;
}

/** Chaves textuais de CatalogBook (exclui `pages`, que é numérica). */
type TextField = { [K in keyof CatalogBook]-?: CatalogBook[K] extends string | undefined ? K : never }[keyof CatalogBook];

export function usefulCategory(value?: string, title?: string) {
  const category = clean(value);
  if (!category || category.toLowerCase() === title?.trim().toLowerCase()) return undefined;
  // A Open Library devolve marcadores como "series:Harry_Potter", que não são
  // categorias de assunto e não devem aparecer na ficha do livro.
  if (/^series:/i.test(category)) return undefined;
  return category;
}

export function mergeCatalogBooks(isbn: string, entries: (CatalogBook | null)[]) {
  const books = entries.filter((entry): entry is CatalogBook => Boolean(entry));
  if (!books.length) return null;
  const first = (field: TextField) => books.map((book) => clean(book[field])).find(Boolean);
  const title = first("title");
  const category = books.map((book) => usefulCategory(book.category, title)).find(Boolean);
  return {
    isbn,
    title,
    subtitle: first("subtitle"),
    author: first("author"),
    publisher: first("publisher"),
    edition: first("edition"),
    year: first("year"),
    pages: books.map((book) => book.pages).find((value) => typeof value === "number" && value > 0),
    language: first("language"),
    category,
    description: first("description"),
    coverUri: first("coverUri"),
    catalogSource: books.map((book) => clean(book.catalogSource)).find(Boolean),
  } satisfies CatalogBook;
}
