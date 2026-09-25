/**
 * Verificação do leitor de código de barras (round-trip real).
 *
 * Gera uma imagem EAN-13 legítima com `bwip-js`, decodifica com o MESMO
 * caminho usado pelo app na web (ZXing `MultiFormatReader` com hints de
 * formatos 1D + TRY_HARDER, entrada em escala de cinza) e confirma que o ISBN
 * sai correto.
 *
 * Isso prova que a correção funciona de fato: o teste falha se os formatos 1D
 * não estiverem habilitados, que era exatamente o problema no site — o
 * expo-camera na web só decodifica QR Code.
 *
 * Execução: npx tsx scripts/verify-barcode.ts
 */
import { createRequire } from "node:module";
import { PNG } from "pngjs";
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";

const require = createRequire(import.meta.url);
// Os typings do bwip-js não expõem `toBuffer`, que existe em runtime.
const bwipjs = require("bwip-js") as {
  toBuffer(options: Record<string, unknown>): Promise<Buffer>;
};

const SAMPLES = [
  { isbn: "9788535914849", label: "1984 — Companhia das Letras" },
  { isbn: "9788532530783", label: "Harry Potter e a pedra filosofal" },
];

async function renderEan13(isbn: string) {
  // bwip-js valida o dígito verificador, então a imagem é um EAN-13 real.
  const png = await bwipjs.toBuffer({
    bcid: "ean13",
    text: isbn,
    scale: 3,
    height: 12,
    includetext: false,
    paddingwidth: 10,
    paddingheight: 10,
  });
  return PNG.sync.read(png);
}

/**
 * Converte RGBA -> escala de cinza exatamente como o navegador faz em
 * HTMLCanvasElementLuminanceSource.toGrayscaleBuffer.
 */
function toGrayscale(image: InstanceType<typeof PNG>) {
  const { data, width, height } = image;
  const buffer = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    const alpha = data[i + 3];
    buffer[j] =
      alpha === 0
        ? 0xff
        : (306 * data[i] + 601 * data[i + 1] + 117 * data[i + 2] + 0x200) >> 10;
  }
  return buffer;
}

function decodeWithAppSettings(image: InstanceType<typeof PNG>) {
  // Reproduz exatamente os hints de lib/barcode-scanner.web.tsx
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  const source = new RGBLuminanceSource(toGrayscale(image), image.width, image.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  return reader.decode(bitmap, hints);
}

async function main() {
  let failures = 0;

  for (const sample of SAMPLES) {
    console.log("=".repeat(74));
    console.log(`Amostra: ${sample.label} (ISBN ${sample.isbn})`);
    try {
      const image = await renderEan13(sample.isbn);
      console.log(`  imagem EAN-13 gerada: ${image.width}x${image.height}px`);

      const result = decodeWithAppSettings(image);
      const text = result.getText();
      const format = BarcodeFormat[result.getBarcodeFormat()];
      console.log(`  decodificado: "${text}" (formato ${format})`);

      const digits = text.replace(/\D/g, "");
      if (digits !== sample.isbn) {
        console.log(`  FALHA: esperado ${sample.isbn}, obtido ${digits}`);
        failures += 1;
        continue;
      }
      console.log(`  OK: ISBN reconhecido -> ${digits}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ERRO: ${message}`);
      failures += 1;
    }
  }

  console.log("=".repeat(74));
  if (failures === 0) {
    console.log("OK: o leitor decodifica códigos de barras 1D e extrai o ISBN");
  } else {
    console.log(`FALHAS: ${failures}`);
  }
  process.exit(failures === 0 ? 0 : 1);
}

void main();
