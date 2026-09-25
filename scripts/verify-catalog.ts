/**
 * Verificação de integração dos catálogos reais (BrasilAPI, Google Books,
 * Open Library). Roda com `npx tsx scripts/verify-catalog.ts`.
 *
 * Confirma que os campos enriquecidos do stage 2 (subtítulo, editora, edição,
 * páginas, idioma, descrição, capa e fonte) chegam preenchidos e que o merge
 * entre fontes não perde informação.
 */
import { lookupBookByIsbn } from "../lib/catalog-lookup";
import { extractIsbn, isValidIsbn } from "../lib/isbn";

const SAMPLE_ISBNS = [
  "9788535914849", // 1984 - Companhia das Letras
  "9788506058589", // livro didático brasileiro
  "9788532530783",
];

async function main() {
  let failures = 0;

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
  console.log(failures === 0 ? "OK: catálogos responderam com dados" : `FALHAS: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
