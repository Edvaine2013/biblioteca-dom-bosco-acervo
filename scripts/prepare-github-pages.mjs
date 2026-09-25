import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const dist = join(root, "dist");
const base = "biblioteca-dom-bosco-acervo";

/**
 * ATENÇÃO: este script NÃO reescreve o conteúdo dos arquivos.
 *
 * O caminho base ("/biblioteca-dom-bosco-acervo") é aplicado pelo próprio Expo
 * no `expo export`, via EXPO_PUBLIC_BASE_URL (app.config.ts -> experiments.baseUrl).
 *
 * Uma versão anterior deste script fazia um replace global de caminhos
 * absolutos em .html/.js/.css e corrompia o bundle JavaScript: literais de
 * regex como `.replace(/"/g, "&quot;")` viravam
 * `.replace(/"/biblioteca-dom-bosco-acervo/g, ...)`, causando
 * "SyntaxError: Invalid regular expression flags" e deixando o site publicado
 * sem hidratação (abas e botões não respondiam).
 *
 * Aqui apenas replicamos as rotas estáticas exportadas em pastas com
 * index.html, para que /acervo/, /movimentos/ e /novo-livro/ (com barra final)
 * também sejam servidos pelo GitHub Pages.
 */
const routes = ["acervo", "movimentos", "novo-livro"];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

const files = await walk(dist);

for (const route of routes) {
  const source = join(dist, `${route}.html`);
  const targetDirectory = join(dist, route);
  await mkdir(targetDirectory, { recursive: true });
  await cp(source, join(targetDirectory, "index.html"));
}

await writeFile(join(dist, ".nojekyll"), "\n");

// Verificação de sanidade: falha o deploy cedo se o caminho base não tiver
// sido aplicado pelo Expo, evitando publicar um site sem CSS/JS em subpasta.
const indexHtml = await readFile(join(dist, "index.html"), "utf8");
if (!indexHtml.includes(`/${base}/_expo/`)) {
  throw new Error(
    `O caminho base /${base}/ não foi encontrado em dist/index.html. ` +
      `Confirme que EXPO_PUBLIC_BASE_URL=/${base} foi definido antes do expo export.`
  );
}

console.log(`Prepared ${relative(root, dist)} for /${base}/ (${files.length} arquivos verificados)`);
