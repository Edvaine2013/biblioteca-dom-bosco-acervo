function normalizeIsbn(value: string) {
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(compact)) return compact;
  if (/^\d{9}[\dX]$/.test(compact)) return compact;
  return undefined;
}

export function extractIsbn(text: string) {
  const candidates = text.toUpperCase().match(/[\dX][\dX\s-]{8,20}/g) ?? [];
  for (const candidate of candidates) {
    const isbn = normalizeIsbn(candidate);
    if (isbn) return isbn;
  }
  return undefined;
}

export function isValidIsbn(value: string) {
  return Boolean(normalizeIsbn(value));
}
