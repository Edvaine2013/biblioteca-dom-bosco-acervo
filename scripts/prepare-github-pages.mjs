import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const dist = join(root, "dist");
const base = "biblioteca-dom-bosco-acervo";

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

function prefixRootPaths(content) {
  return content
    .replace(/(["'])\/(?![\/])/g, `$1/${base}/`)
    .replaceAll(`/${base}/acervo"`, `/${base}/acervo/"`)
    .replaceAll(`/${base}/movimentos"`, `/${base}/movimentos/"`)
    .replaceAll(`/${base}/novo-livro"`, `/${base}/novo-livro/"`);
}

const files = await walk(dist);
for (const file of files) {
  if (!/\.(html|js|css)$/.test(file)) continue;
  const content = await readFile(file, "utf8");
  await writeFile(file, prefixRootPaths(content));
}

for (const route of ["acervo", "movimentos", "novo-livro"]) {
  const source = join(dist, `${route}.html`);
  const targetDirectory = join(dist, route);
  await mkdir(targetDirectory, { recursive: true });
  await cp(source, join(targetDirectory, "index.html"));
}

await writeFile(join(dist, ".nojekyll"), "\n");
console.log(`Prepared ${relative(root, dist)} for /${base}/`);
