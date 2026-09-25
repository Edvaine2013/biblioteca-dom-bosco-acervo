/**
 * Leitura e validação de ISBN.
 *
 * **Por que a validação é estrita.** Um código de barras EAN-13 só identifica um
 * livro quando começa com **978** ou **979** — o prefixo "Bookland", reservado
 * internacionalmente para publicações. Qualquer outro EAN-13 (código interno de
 * livraria, etiqueta de controle de vendas, código de produto) passa pelo dígito
 * verificador do EAN, mas não corresponde a livro nenhum nos catálogos.
 *
 * A validação anterior conferia apenas o dígito verificador, então o código de
 * controle da loja era aceito como se fosse ISBN e a consulta saía vazia. Agora
 * o prefixo é verificado junto com o dígito.
 */

const BOOKLAND_PREFIXES = ["978", "979"];

/** Prefixos GS1 do Brasil (789/790): usados em códigos de loja e de produto. */
const BRAZIL_GS1_PREFIXES = ["789", "790"];

export type IsbnIssue = "empty" | "length" | "checksum" | "not-bookland";

function normalize(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function hasValidIsbn10CheckDigit(value: string) {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  const total = value
    .split("")
    .reduce((sum, digit, index) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0);
  return total % 11 === 0;
}

function hasValidIsbn13CheckDigit(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const total = value
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return total % 10 === 0;
}

function isBookland(value: string) {
  return BOOKLAND_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** Converte um ISBN-10 (obsoleto) no ISBN-13 equivalente. */
export function toIsbn13(value: string) {
  const compact = normalize(value);
  if (/^\d{13}$/.test(compact)) return compact;
  if (!/^\d{9}[\dX]$/.test(compact)) return undefined;
  const core = `978${compact.slice(0, 9)}`;
  const total = core
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (total % 10)) % 10;
  return `${core}${checkDigit}`;
}

/**
 * Aponta o que há de errado com o valor, ou `null` se for um ISBN válido.
 * `not-bookland` é o caso do código de loja: parece um EAN válido, mas não é
 * ISBN.
 */
export function isbnIssue(value: string): IsbnIssue | null {
  const compact = normalize(value);
  if (!compact) return "empty";
  if (!/^\d{9}[\dX]$/.test(compact) && !/^\d{13}$/.test(compact)) return "length";
  if (compact.length === 10) {
    return hasValidIsbn10CheckDigit(compact) ? null : "checksum";
  }
  if (!hasValidIsbn13CheckDigit(compact)) return "checksum";
  return isBookland(compact) ? null : "not-bookland";
}

export function isValidIsbn(value: string) {
  return isbnIssue(value) === null;
}

/**
 * Verifica se o código tem prefixo de publicação (978/979), ainda que o dígito
 * verificador não feche — útil para escolher, entre vários códigos lidos do
 * mesmo quadro, qual é o candidato a ISBN.
 */
export function isBooklandCandidate(text: string) {
  const compact = normalize(text);
  return isBookland(compact);
}

/**
 * Extrai o ISBN de um texto lido pelo scanner (que pode trazer prefixos como
 * "ISBN 978-85-359-1484-9").
 *
 * Vale a primeira ocorrência **válida**: quando a etiqueta traz o código de
 * loja junto com o ISBN, o código de loja é descartado e a leitura fica com o
 * ISBN — que é o único que identifica o livro nos catálogos.
 */
export function extractIsbn(text: string) {
  const upper = text.toUpperCase();
  // Cada código é analisado isoladamente: assim o código de loja não se funde
  // com o ISBN quando a etiqueta traz os dois na mesma linha.
  const candidates = upper.match(/[\dX][\dX-]{7,17}[\dX]/g) ?? [];
  for (const candidate of candidates) {
    const compact = normalize(candidate);
    if (isbnIssue(compact) === null) return compact;
  }
  // Formatações separadas por espaço (ex.: "978 85 359 1484 9").
  for (const token of upper.split(/\s+/)) {
    const joined = token.replace(/[^\dX]/g, "");
    if (joined.length >= 10 && isbnIssue(normalize(joined)) === null) {
      return normalize(joined);
    }
  }
  return undefined;
}

/** Mensagem que explica, em português claro, por que o código não serve. */
export function explainIsbnIssue(value: string) {
  const compact = normalize(value);
  const issue = isbnIssue(compact);
  const shown = compact || value.trim();

  switch (issue) {
    case null:
      return "";
    case "empty":
      return "Nenhum código foi lido. Aponte para o código de barras da contracapa.";
    case "length":
      return `Código lido: ${shown}. Não é um ISBN — o ISBN tem 13 dígitos (ou 10, nas edições antigas).`;
    case "checksum":
      return `Código lido: ${shown}. O dígito verificador não confere: pode ter faltado um dígito na leitura. Tente de novo, mais devagar e com o livro bem iluminado.`;
    case "not-bookland":
      if (BRAZIL_GS1_PREFIXES.some((prefix) => compact.startsWith(prefix))) {
        return `Código lido: ${shown}. Este é um código de loja ou de produto (prefixo 789), não um ISBN. Procure na contracapa o código que começa com 978 ou 979.`;
      }
      return `Código lido: ${shown}. Não é um ISBN: todo ISBN impresso começa com 978 ou 979. Procure esse código na contracapa.`;
  }
}

/**
 * Interpreta o que o scanner leu, já separando o caso de sucesso do caso em que
 * o código não é um ISBN — com a explicação pronta para exibir na tela.
 */
export function readIsbn(
  text: string,
): { ok: true; isbn: string } | { ok: false; message: string } {
  const isbn = extractIsbn(text);
  if (isbn) return { ok: true, isbn };
  return { ok: false, message: explainIsbnIssue(text) };
}
