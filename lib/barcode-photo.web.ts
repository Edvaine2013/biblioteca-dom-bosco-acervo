/**
 * Leitura do código de barras a partir de uma **foto** da etiqueta.
 *
 * **Por que este caminho existe.**
 *
 * O leitor ao vivo depende do `getUserMedia`, que o navegador pode recusar por
 * motivos que o usuário não controla — permissão negada antes de ele entender o
 * pedido, política do aparelho, navegador embutido de WhatsApp/Instagram, ou o
 * Chrome que ainda não releu a autorização concedida com a página aberta.
 *
 * A foto não passa por nada disso: o `<input type="file" capture>` abre o
 * **aplicativo de câmera do próprio celular**, que já tem a autorização de
 * sistema concedida, e devolve a imagem pronta para o site. O ZXing decodifica a
 * foto com a mesma regra do leitor ao vivo — o ISBN vence o código de loja.
 *
 * É o caminho que funciona em qualquer navegador, inclusive nos que bloqueiam a
 * câmera para páginas web.
 */
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { bandsFor, invertCanvas, pickBestReading } from "@/lib/barcode-decode";

export type PhotoReading =
  | { ok: true; code: string }
  | { ok: false; message: string };

const FORMATS = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128];

function createReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

/** Carrega o arquivo escolhido pelo usuário como imagem. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir a imagem."));
    };
    image.src = url;
  });
}

/**
 * Abre o seletor do celular (câmera ou galeria) e devolve o arquivo escolhido.
 *
 * O atributo `capture` faz o Android abrir direto o aplicativo de câmera; se o
 * aparelho não suportar, o usuário ainda pode escolher uma foto da galeria, o
 * que também serve.
 */
export function pickBarcodePhoto(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.style.display = "none";
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener("change", () => finish(input.files?.[0] ?? null), { once: true });
    // Em navegadores que não disparam `change` ao cancelar, o foco de volta à
    // janela indica que a escolha terminou.
    window.addEventListener(
      "focus",
      () => setTimeout(() => finish(input.files?.[0] ?? null), 800),
      { once: true },
    );

    input.click();
  });
}

/**
 * Decodifica a foto em busca do código de barras.
 *
 * Repete a estratégia do leitor ao vivo: tenta o quadro inteiro e depois cada
 * faixa sobreposta, com e sem inversão de contraste — fotos de etiqueta saem com
 * sombra, brilho e enquadramento irregular, e a leitura só é confiável quando
 * todas as variações concordam em algum código.
 */
export async function decodeBarcodePhoto(file: File): Promise<PhotoReading> {
  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return { ok: false, message: "Não foi possível abrir a foto. Tente novamente." };
  }

  const reader = createReader();
  const full = document.createElement("canvas");
  full.width = image.naturalWidth || image.width;
  full.height = image.naturalHeight || image.height;
  const ctx = full.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { ok: false, message: "Este navegador não conseguiu processar a foto." };
  }
  ctx.drawImage(image, 0, 0);

  const readings = new Set<string>();
  const band = document.createElement("canvas");
  const areas: [number, number][] = [[0, full.width], ...bandsFor(full.width)];

  for (const [from, to] of areas) {
    const bandWidth = Math.max(1, Math.round(to - from));
    band.width = bandWidth;
    band.height = full.height;
    const bandCtx = band.getContext("2d", { willReadFrequently: true });
    if (!bandCtx) continue;
    bandCtx.drawImage(full, from, 0, bandWidth, full.height, 0, 0, bandWidth, full.height);

    for (const invert of [false, true]) {
      try {
        const result = reader.decodeFromCanvas(invert ? invertCanvas(band) : band);
        readings.add(result.getText());
      } catch {
        // Nenhum código nesta área/modo: segue para a próxima.
      }
    }
  }

  const best = pickBestReading(readings);
  if (!best) {
    return {
      ok: false,
      message:
        "Não encontrei nenhum código de barras na foto. Aproxime-se da etiqueta, mantenha o código inteiro no quadro e evite reflexos.",
    };
  }
  return { ok: true, code: best };
}
