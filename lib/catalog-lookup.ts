import { Platform } from "react-native";
import { extractIsbn, isValidIsbn } from "@/lib/isbn";
export { extractIsbn, isValidIsbn } from "@/lib/isbn";

export type CatalogBook = {
  isbn?: string;
  title?: string;
  author?: string;
  year?: string;
  category?: string;
  coverUri?: string;
};

export async function lookupBookByIsbn(isbn: string): Promise<CatalogBook | null> {
  const normalized = extractIsbn(isbn);
  if (!normalized || !isValidIsbn(normalized)) return null;
  const response = await fetch(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(normalized)}&limit=1&fields=title,author_name,first_publish_year,subject,cover_i`);
  if (!response.ok) throw new Error("Não foi possível consultar o catálogo bibliográfico.");
  const data = await response.json() as { docs?: { title?: string; author_name?: string[]; first_publish_year?: number; subject?: string[]; cover_i?: number }[] };
  const entry = data.docs?.[0];
  if (!entry) return null;
  return {
    isbn: normalized,
    title: entry.title,
    author: entry.author_name?.filter(Boolean).join(", "),
    year: entry.first_publish_year ? String(entry.first_publish_year) : undefined,
    category: entry.subject?.[0],
    coverUri: entry.cover_i ? `https://covers.openlibrary.org/b/id/${entry.cover_i}-L.jpg` : undefined,
  };
}

export async function readIsbnFromImage(imageUri: string, onProgress?: (progress: number) => void) {
  if (Platform.OS !== "web") {
    throw new Error("A leitura automática da imagem está disponível no site web. No aplicativo móvel, informe o ISBN manualmente.");
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress?.(message.progress);
    },
  });
  try {
    const result = await worker.recognize(imageUri);
    return extractIsbn(result.data.text);
  } finally {
    await worker.terminate();
  }
}
