/**
 * Verificação de integração dos repositórios bibliográficos.
 *
 * Faz duas checagens: (1) que códigos que **não** são ISBN — em especial o
 * código de loja com prefixo 789 — são recusados antes de qualquer consulta, e
 * (2) que os catálogos respondem com os metadados enriquecidos do estágio 2
 * (subtítulo, editora, edição, páginas, idioma, descrição, capa e fonte),
 * registrando quais repositórios contribuíram.
 *
 * Roda com `npx tsx scripts/verify-catalog.ts`.
 */
import { CATALOG_SOURCES, lookupBookByIsbn } from "../lib/catalog-lookup";
import { explainIsbnIssue, extractIsbn, isValidIsbn } from "../lib/isbn";

/** ISBNs reais de livros de editoras brasileiras. */
const SAMPLE_ISBNS = [
  "9788535914849", // 1984 - Companhia das Letras
  "9788506058589", // dicionário - Editora Melhoramentos
  "9788532530783", // Harry Potter - Rocco
];

/** Códigos que parecem ISBN, mas não são: precisam ser recusados. */
const NON_ISBN_CODES = [
  { code: "7891234567895", label: "código de loja (prefixo GS1 789)" },
  { code: "7891000315507", label: "código de produto brasileiro" },
  { code: "4006381333931", label: "EAN de produto europeu" },
];

async function main() {
  let failures = 0;

  console.log("REPOSITÓRIOS CONFIGURADOS");
  for (const source of CATALOG_SOURCES) {
    console.log(`  ${source.label.padEnd(18)} ${source.origin} (via ${source.via})`);
  }

  console.log("\nRECUSA DE CÓDIGOS QUE NÃO SÃO ISBN");
  let guardOk = true;
  for (const { code, label } of NON_ISBN_CODES) {
    const valid = isValidIsbn(code);
    if (valid) guardOk = false;
    console.log(`  ${code} | aceito como ISBN: ${valid ? "SIM (ERRO)" : "não"} | ${label}`);
    console.log(`     ${explainIsbnIssue(code)}`);
  }
  if (!guardOk) failures += 1;
  console.log(`  -> guarda contra código de loja: ${guardOk ? "OK" : "FALHOU"}`);

  console.log("\nCONSULTA REAL AOS CATÁLOGOS");
  for (const isbn of SAMPLE_ISBNS) {
    console.log("=".repeat(78));
    console.log(`ISBN ${isbn} (válido: ${isValidIsbn(isbn)}, extraído: ${extractIsbn(isbn)})`);
    try {
      const book = await lookupBookByIsbn(isbn);
      if (!book) {
        console.log("  nenhum catálogo retornou dados");
        failures += 1;
        continue;
      }
      const wanted = [
        "title",
        "subtitle",
        "author",
        "publisher",
        "edition",
        "year",
        "pages",
        "language",
        "category",
        "description",
        "coverUri",
        "catalogSource",
      ] as const;
      const filled = wanted.filter((key) => book[key] !== undefined);
      console.log(`  preenchidos (${filled.length}/${wanted.length}): ${filled.join(", ")}`);
      console.log(`  título:    ${book.title ?? "-"}`);
      console.log(`  autor:     ${book.author ?? "-"}`);
      console.log(`  editora:   ${book.publisher ?? "-"}`);
      console.log(`  ano:       ${book.year ?? "-"}`);
      console.log(`  páginas:   ${book.pages ?? "-"}`);
      console.log(`  idioma:    ${book.language ?? "-"}`);
      console.log(`  categoria: ${book.category ?? "-"}`);
      console.log(`  capa:      ${book.coverUri ?? "-"}`);
      console.log(`  fonte:     ${book.catalogSource ?? "-"}`);
      if (!book.title) failures += 1;
    } catch (error) {
      console.log(`  ERRO: ${String(error)}`);
      failures += 1;
    }
  }

  console.log("=".repeat(78));
  console.log(failures === 0 ? "OK: catálogos responderam com dados e códigos inválidos foram recusados" : `FALHAS: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
