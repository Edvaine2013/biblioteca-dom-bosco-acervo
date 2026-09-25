/**
 * Lógica de leitura de código de barras compartilhada pelos caminhos que
 * decodificam imagem: a câmera ao vivo (`barcode-scanner.web.tsx`) e a foto da
 * etiqueta (`barcode-photo.web.ts`).
 *
 * É um módulo **puro** — nada de ZXing nem de DOM aqui — para poder ser testado
 * isoladamente e reusado pelos dois caminhos sem duplicar regra.
 */
import { extractIsbn, isBooklandCandidate } from "@/lib/isbn";

/**
 * Divide o quadro em faixas verticais sobrepostas.
 *
 * O ZXing decodifica **um** código por chamada. Na contracapa dos livros
 * brasileiros convivem o código de controle de vendas da livraria e o ISBN, lado
 * a lado: lendo o quadro inteiro, o decodificador devolve o primeiro que achar —
 * e pode ser justamente o código de loja. Analisando cada faixa em separado, um
 * código nunca esconde o outro e as duas leituras ficam disponíveis para
 * comparação.
 *
 * A sobreposição de 25% existe para que um código que caia na divisa entre duas
 * faixas apareça inteiro em pelo menos uma delas.
 */
export function bandsFor(width: number): [number, number][] {
  if (!Number.isFinite(width) || width <= 0) return [];
  return [
    [0, width],
    [0, width * 0.62],
    [width * 0.38, width],
    [width * 0.25, width * 0.75],
  ];
}

/**
 * Escolhe a leitura que deve valer entre todas as encontradas no mesmo quadro.
 *
 * A regra é a mesma que o usuário espera ao apontar a câmera para a contracapa:
 * **o ISBN vence sempre**. O código de loja só é devolvido quando não há ISBN
 * algum visível — aí ele serve para a tela explicar que o alvo estava errado.
 */
export function pickBestReading(readings: Iterable<string>): string | undefined {
  const values = [...readings].filter((value) => Boolean(value));
  if (!values.length) return undefined;
  const withIsbn = values.find((value) => extractIsbn(value));
  if (withIsbn) return withIsbn;
  return values.find((value) => isBooklandCandidate(value)) ?? values[0];
}

/** Inverte as cores do quadro, para etiquetas com fundo escuro ou negativo. */
export function invertCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
