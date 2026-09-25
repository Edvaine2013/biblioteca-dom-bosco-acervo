import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuração dos testes.
 *
 * O alias `@/` é o mesmo do `tsconfig.json` e precisa existir aqui também: os
 * módulos de `lib/` importam uns aos outros por `@/lib/...`, e sem esta
 * resolução o vitest não consegue carregar quem depende deles.
 *
 * O caminho raiz sai de `fileURLToPath` (e não de `new URL`) porque o tipo
 * `URL` do DOM e o do Node divergem entre si no `tsconfig` do projeto.
 */
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "node",
  },
});
