import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser, Pencil, Type, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { drawMarks, fontSizeFor, type Mark, type Point } from "@/lib/annotations";

const COLORS = [
  { value: "#e11d48", label: "赤" },
  { value: "#2563eb", label: "青" },
  { value: "#171717", label: "黒" },
];

type Tool = "pen" | "text";

// スクリーンショットの上に、ペンで線を引いたり文字を置いたりする
export function ScreenshotAnnotator(props: { image: string; marks: Mark[]; onChange: (marks: Mark[]) => void }) {
  const { image, marks, onChange } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]!.value);
  // 描いている途中の線。離したら marks に入れる
  const [drawing, setDrawing] = useState<Mark | null>(null);
  // 文字を打っている場所（画像の座標と、画面上の位置）
  const [typing, setTyping] = useState<{ at: Point; left: number; top: number; text: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMarks(ctx, drawing ? [...marks, drawing] : marks);
  }, [marks, drawing, size]);

  // 画面上の位置を、画像のピクセルの位置に直す
  const toImagePoint = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * e.currentTarget.width) / rect.width,
      y: ((e.clientY - rect.top) * e.currentTarget.height) / rect.height,
    };
  };

  const commitText = () => {
    if (typing && typing.text.trim()) onChange([...marks, { kind: "text", color, at: typing.at, text: typing.text.trim() }]);
    setTyping(null);
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    // 文字を打っている途中なら、画像をクリックしたら確定するだけ（入力欄のフォーカスは外さない）
    if (typing) {
      e.preventDefault();
      commitText();
      return;
    }
    if (tool === "text") {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setTyping({ at: toImagePoint(e), left: e.clientX - rect.left, top: e.clientY - rect.top, text: "" });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing({ kind: "line", color, points: [toImagePoint(e)] });
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (drawing?.kind !== "line") return;
    setDrawing({ ...drawing, points: [...drawing.points, toImagePoint(e)] });
  };

  const onPointerUp = () => {
    if (drawing) onChange([...marks, drawing]);
    setDrawing(null);
  };

  // 画面に出している大きさでの文字の大きさ（入力欄を書き込み後と同じ見た目にする）
  const canvas = canvasRef.current;
  const displayScale = canvas && size ? canvas.getBoundingClientRect().width / size.width : 1;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="書き込みの道具">
        <Button type="button" size="sm" variant={tool === "pen" ? "default" : "outline"} aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>
          <Pencil />
          ペン
        </Button>
        <Button type="button" size="sm" variant={tool === "text" ? "default" : "outline"} aria-pressed={tool === "text"} onClick={() => setTool("text")}>
          <Type />
          文字
        </Button>
        <div className="mx-1 flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={`色: ${c.label}`}
              aria-pressed={color === c.value}
              onClick={() => setColor(c.value)}
              className={cn("size-6 rounded-full border-2 border-background ring-offset-background", color === c.value && "ring-2 ring-ring ring-offset-1")}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" disabled={marks.length === 0} onClick={() => onChange(marks.slice(0, -1))}>
          <Undo2 />
          元に戻す
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={marks.length === 0} onClick={() => onChange([])}>
          <Eraser />
          全部消す
        </Button>
      </div>

      <div className="relative min-h-0 self-start overflow-hidden rounded-md border">
        <img
          src={image}
          alt="送るスクリーンショット"
          className="block max-h-[65vh] w-auto max-w-full select-none"
          draggable={false}
          onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        />
        {size && (
          <canvas
            ref={canvasRef}
            width={size.width}
            height={size.height}
            data-testid="annotation-canvas"
            className={cn("absolute inset-0 size-full touch-none", tool === "pen" ? "cursor-crosshair" : "cursor-text")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        )}
        {typing && (
          <input
            autoFocus
            aria-label="書き込む文字"
            value={typing.text}
            onChange={(e) => setTyping({ ...typing, text: e.target.value })}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") {
                // 入力だけやめる。フォーム全体は閉じない
                e.stopPropagation();
                setTyping(null);
              }
            }}
            className="absolute min-w-24 -translate-y-1/2 rounded border border-dashed bg-white/80 px-1 font-bold outline-none"
            style={{ left: typing.left, top: typing.top, color, fontSize: fontSizeFor(size?.width ?? 0) * displayScale }}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {tool === "pen" ? "ドラッグして線を引けます" : "文字を置きたい所をクリックして入力し、Enter で確定します"}
      </p>
    </div>
  );
}
