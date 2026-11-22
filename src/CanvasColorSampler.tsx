import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { boundedAsyncCache } from "./boundedCache";

export function CanvasColorSampler({
  onPick,
  onError,
}: {
  onPick: (hex: string) => void;
  onError: () => void;
}) {
  const lens = useRef<HTMLDivElement>(null),
    view = useRef<HTMLCanvasElement>(null),
    label = useRef<HTMLElement>(null);
  const callbacks = useRef({ onPick, onError });
  callbacks.current = { onPick, onError };
  useEffect(() => {
    let alive = true,
      frame = 0,
      painting = false,
      picked = false;
    let pointer: { x: number; y: number; paper: HTMLElement } | null = null;
    const ids = new WeakMap<HTMLElement, string>();
    let nextId = 0;
    // Retain one surface at most; oversized custom sheets bypass the cache budget.
    const cached = boundedAsyncCache<HTMLCanvasElement>(
      1,
      64_000_000,
      (canvas) => canvas.width * canvas.height * 4,
    );
    const target = (event: PointerEvent) =>
      (event.target as Element).closest<HTMLElement>(
        ".paper-workspace .resume-paper, .free-canvas-host",
      );
    const capture = (paper: HTMLElement) => {
      if (!ids.has(paper)) ids.set(paper, String(++nextId));
      return cached(ids.get(paper)!, () =>
        import("./domExport").then((m) => m.captureColorSurface(paper)),
      );
    };
    const pixel = (
      canvas: HTMLCanvasElement,
      paper: HTMLElement,
      x: number,
      y: number,
    ) => {
      const r = paper.getBoundingClientRect();
      const px = Math.max(
        0,
        Math.min(
          canvas.width - 1,
          Math.floor(((x - r.left) * canvas.width) / r.width),
        ),
      );
      const py = Math.max(
        0,
        Math.min(
          canvas.height - 1,
          Math.floor(((y - r.top) * canvas.height) / r.height),
        ),
      );
      const data = canvas.getContext("2d")!.getImageData(px, py, 1, 1).data;
      return {
        px,
        py,
        hex:
          "#" +
          [...data]
            .slice(0, 3)
            .map((n) => n.toString(16).padStart(2, "0"))
            .join(""),
      };
    };
    const paint = async () => {
      frame = 0;
      if (!pointer || painting) return;
      painting = true;
      const paper = pointer.paper;
      try {
        const canvas = await capture(paper);
        if (!alive || !pointer || pointer.paper !== paper) return;
        const { x, y } = pointer,
          { px, py, hex } = pixel(canvas, paper, x, y);
        const ctx = view.current!.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 110, 110);
        ctx.drawImage(canvas, px - 5, py - 5, 11, 11, 0, 0, 110, 110);
        ctx.strokeStyle = "#8884";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 10; i < 110; i += 10) {
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 110);
          ctx.moveTo(0, i);
          ctx.lineTo(110, i);
        }
        ctx.stroke();
        label.current!.textContent = hex;
        lens.current!.style.transform = `translate(${Math.max(8, Math.min(innerWidth - 134, x + 22))}px,${Math.max(8, y + 170 > innerHeight ? y - 160 : y + 22)}px)`;
        lens.current!.hidden = false;
      } catch {
        if (alive && pointer?.paper === paper) callbacks.current.onError();
      } finally {
        painting = false;
        // Moving to another sheet while a capture is pending must update even if
        // the pointer has stopped; the old capture never paints over the new target.
        if (alive && pointer && pointer.paper !== paper && !frame)
          frame = requestAnimationFrame(paint);
      }
    };
    const move = (event: PointerEvent) => {
      const paper = target(event);
      pointer = paper ? { x: event.clientX, y: event.clientY, paper } : null;
      if (!paper) {
        if (lens.current) lens.current.hidden = true;
        return;
      }
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const pick = async (event: PointerEvent) => {
      const paper = target(event);
      if (!paper) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (picked) return;
      picked = true;
      const x = event.clientX,
        y = event.clientY;
      try {
        const canvas = await capture(paper);
        if (alive) callbacks.current.onPick(pixel(canvas, paper, x, y).hex);
      } catch {
        if (alive) callbacks.current.onError();
      }
    };
    document.body.classList.add("color-picking");
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", pick, true);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      document.body.classList.remove("color-picking");
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", pick, true);
    };
  }, []);
  return createPortal(
    <div
      className="color-sampling-lens"
      ref={lens}
      hidden
      aria-label="像素取色放大镜"
    >
      <div>
        <canvas ref={view} width={110} height={110} />
        <i />
      </div>
      <strong ref={label}>#FFFFFF</strong>
    </div>,
    document.body,
  );
}
