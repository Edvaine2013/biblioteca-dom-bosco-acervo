import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";

const MAX_WIDTH = 720;
const MAX_HEIGHT = 960;
const JPEG_QUALITY = 0.72;

export async function prepareBookImage(asset: ImagePickerAsset) {
  if (Platform.OS !== "web") {
    if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
    return asset.uri;
  }

  return await new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Não foi possível preparar a imagem."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem selecionada."));
    image.src = asset.uri;
  });
}

export async function readBarcodeFromImage(imageUri: string) {
  if (Platform.OS !== "web") return undefined;
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const reader = new BrowserMultiFormatReader();
  try {
    const result = await reader.decodeFromImageUrl(imageUri);
    const value = result.getText().replace(/[^\dX]/gi, "").toUpperCase();
    return value.startsWith("978") || value.startsWith("979") || value.length === 10 ? value : undefined;
  } catch {
    return undefined;
  }
}
