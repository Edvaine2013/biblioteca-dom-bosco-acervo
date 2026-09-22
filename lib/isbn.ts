function normalizeIsbn(value: string) {
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(compact)) return compact;
  if (/^\d{9}[\dX]$/.test(compact)) return compact;
  return undefined;
}

function hasValidCheckDigit(isbn: string) {
  if (isbn.length === 13) {
    const total = isbn.split("").reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return total % 10 === 0;
  }
  if (isbn.length === 10) {
    const total = isbn.split("").reduce((sum, digit, index) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0);
    return total % 11 === 0;
  }
  return false;
}

export function extractIsbn(text: string) {
  const candidates = text.toUpperCase().match(/[\dX][\dX\s-]{8,20}/g) ?? [];
  for (const candidate of candidates) {
    const isbn = normalizeIsbn(candidate);
    if (isbn && hasValidCheckDigit(isbn)) return isbn;
  }
  return undefined;
}

export function isValidIsbn(value: string) {
  const isbn = normalizeIsbn(value);
  return Boolean(isbn && hasValidCheckDigit(isbn));
}
