// スクリーンショットへの書き込み（手書きの線と文字）。座標は画像のピクセルで持つ

export type Point = { x: number; y: number };

export type Mark =
  | { kind: "line"; color: string; points: Point[] }
  | { kind: "text"; color: string; at: Point; text: string };

// 画像の大きさに合わせて、線の太さと文字の大きさを決める
export const lineWidthFor = (imageWidth: number) => Math.max(3, imageWidth / 320);
export const fontSizeFor = (imageWidth: number) => Math.max(18, imageWidth / 48);

export function drawMarks(ctx: CanvasRenderingContext2D, marks: Mark[]) {
  const width = ctx.canvas.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const mark of marks) {
    if (mark.kind === "line") {
      ctx.strokeStyle = mark.color;
      ctx.lineWidth = lineWidthFor(width);
      ctx.beginPath();
      mark.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      // 1点だけ（クリックしただけ）でも点が残るようにする
      if (mark.points.length === 1) ctx.lineTo(mark.points[0]!.x + 0.1, mark.points[0]!.y);
      ctx.stroke();
    } else {
      const size = fontSizeFor(width);
      ctx.font = `bold ${size}px sans-serif`;
      ctx.textBaseline = "middle";
      // どんな背景の上でも読めるよう、白い縁取りを付ける
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = size / 4;
      ctx.strokeText(mark.text, mark.at.x, mark.at.y);
      ctx.fillStyle = mark.color;
      ctx.fillText(mark.text, mark.at.x, mark.at.y);
    }
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("スクリーンショットを読み込めませんでした"));
    image.src = src;
  });
}

// スクリーンショットに書き込みを焼き込んだ JPEG を作る
export async function flattenAnnotations(imageUrl: string, marks: Mark[]): Promise<string> {
  if (marks.length === 0) return imageUrl;
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  drawMarks(ctx, marks);
  return canvas.toDataURL("image/jpeg", 0.85);
}
