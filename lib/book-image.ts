import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";

const MAX_WIDTH = 720;
const MAX_HEIGHT = 960;
const JPEG_QUALITY = 0.72;
const RECOGNITION_MAX_SIDE = 2400;

function loadWebImage(uri: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem selecionada."));
    image.src = uri;
  });
}

function drawRegion(image: HTMLImageElement, topRatio: number, heightRatio: number) {
  const sourceY = Math.round(image.naturalHeight * topRatio);
  const sourceHeight = Math.round(image.naturalHeight * heightRatio);
  const scale = Math.min(1, RECOGNITION_MAX_SIDE / image.naturalWidth, RECOGNITION_MAX_SIDE / sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Não foi possível processar a imagem.");
  context.drawImage(image, 0, sourceY, image.naturalWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function highContrastCopy(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Não foi possível processar a imagem.");
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const gray = pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114;
    const enhanced = gray < 150 ? Math.max(0, gray * 0.55) : Math.min(255, 128 + (gray - 128) * 1.8);
    pixels.data[i] = enhanced;
    pixels.data[i + 1] = enhanced;
    pixels.data[i + 2] = enhanced;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function createRecognitionCanvases(imageUri: string) {
  const image = await loadWebImage(imageUri);
  const regions = [
    drawRegion(image, 0, 1),
    drawRegion(image, 0.35, 0.65),
    drawRegion(image, 0.55, 0.45),
    drawRegion(image, 0.7, 0.3),
  ];
  return [...regions, ...regions.map(highContrastCopy)];
}

export async function prepareBookImage(asset: ImagePickerAsset) {
  if (Platform.OS !== "web") {
    if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
    return asset.uri;
  }

  const image = await loadWebImage(asset.uri);
  const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export async function readBarcodeFromImage(imageUri: string) {
  if (Platform.OS !== "web") return undefined;
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  const canvases = await createRecognitionCanvases(imageUri);
  for (const canvas of canvases) {
    try {
      const result = reader.decodeFromCanvas(canvas);
      const value = result.getText().replace(/[^\dX]/gi, "").toUpperCase();
      if (value.startsWith("978") || value.startsWith("979") || value.length === 10) return value;
    } catch {
      // Tenta o próximo recorte ou tratamento de imagem.
    }
  }
  return undefined;
}

export async function createOcrImageVariants(imageUri: string) {
  if (Platform.OS !== "web") return [imageUri];
  const canvases = await createRecognitionCanvases(imageUri);
  return [canvases[2], canvases[3], canvases[6], canvases[7], canvases[0]].map((canvas) => canvas.toDataURL("image/jpeg", 0.88));
}
