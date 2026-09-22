export type CatalogBook = {
  isbn?: string;
  title?: string;
  author?: string;
  year?: string;
  category?: string;
  coverUri?: string;
};

function clean(value?: string) {
  const result = value?.trim();
  return result || undefined;
}

export function usefulCategory(value?: string, title?: string) {
  const category = clean(value);
  if (!category || category.toLowerCase() === title?.trim().toLowerCase()) return undefined;
  return category;
}

export function mergeCatalogBooks(isbn: string, entries: (CatalogBook | null)[]) {
  const books = entries.filter((entry): entry is CatalogBook => Boolean(entry));
  if (!books.length) return null;
  const first = (field: keyof CatalogBook) => books.map((book) => clean(book[field])).find(Boolean);
  const title = first("title");
  const category = books.map((book) => usefulCategory(book.category, title)).find(Boolean);
  return {
    isbn,
    title,
    author: first("author"),
    year: first("year"),
    category,
    coverUri: first("coverUri"),
  } satisfies CatalogBook;
}
