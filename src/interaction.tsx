import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export function NumericInput({
  value,
  onChange,
  min = 0,
  max = 150,
  step = 1,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const [draft, setDraft] = useState(String(value)),
    editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(String(value));
  }, [value]);
  const finish = () => {
    editing.current = false;
    const n = draft.trim() === "" ? value : Number(draft);
    const next = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <input
      type="number"
      aria-label={label}
      value={draft}
      min={min}
      max={max}
      step={step}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text !== "" && Number.isFinite(n) && n >= min && n <= max)
          onChange(n);
      }}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
    />
  );
}

// A quick click keeps native caret/selection behavior. Movement before the hold
// threshold cancels dragging, so selecting text does not accidentally move blocks.
// holdMs = 0 means "start dragging immediately" (used by the row handle grip).
export function holdDrag(
  e: ReactPointerEvent,
  id: string,
  onMove: (target: string, after: boolean) => void,
  holdMs = 350,
  allow?: (id: string) => boolean,
) {
  if (e.button !== 0) return;
  if (holdMs && (e.target as HTMLElement).closest("button,input,select,a")) return;
  const handle = e.currentTarget as HTMLElement,
    startX = e.clientX,
    startY = e.clientY,
    root =
      handle.closest?.<HTMLElement>(".simple-editor,.paper-workspace") ??
      document.body;
  let active = false,
    target: HTMLElement | null = null,
    after = false;
  const clearTarget = () => {
    target?.classList.remove("drop-target");
    target = null;
    after = false;
  };
  // 落点只看纵向位置：手柄在行左边外面，按鼠标坐标找元素会永远找不到行
  const pickAt = (y: number) => {
    const rows = Array.from(
      root.querySelectorAll?.<HTMLElement>("[data-field],[data-line]") ?? [],
    );
    let last: HTMLElement | null = null;
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      if (!box.height) continue;
      const rowId = row.dataset.field || row.dataset.line || "";
      if (rowId === id) continue;
      if (allow && !allow(rowId)) continue;
      last = row;
      if (y < box.top + box.height / 2) return { row, after: false };
    }
    return last ? { row: last, after: true } : null;
  };
  const activate = () => {
    active = true;
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add("holding-block");
    handle.classList.add("moving-block");
    handle.closest?.(".edit-field")?.classList.add("moving-block");
    window.getSelection()?.removeAllRanges();
  };
  const timer = holdMs ? window.setTimeout(activate, holdMs) : (activate(), 0);
  const cleanup = () => {
    clearTimeout(timer);
    clearTarget();
    document.body.classList.remove("holding-block");
    handle.classList.remove("moving-block");
    handle.closest?.(".edit-field")?.classList.remove("moving-block");
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", cancel);
    handle.removeEventListener("pointerleave", leave);
    handle.removeEventListener("lostpointercapture", cancel);
    window.removeEventListener("keydown", escape);
    if (handle.hasPointerCapture(e.pointerId))
      handle.releasePointerCapture(e.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!active) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 5)
        cleanup();
      return;
    }
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    clearTarget();
    const hit = pickAt(event.clientY);
    target = hit?.row ?? null;
    after = hit?.after ?? false;
    if ((target?.dataset.line || target?.dataset.field) !== id)
      target?.classList.add("drop-target");
    const box = root.getBoundingClientRect?.();
    if (box && typeof root.scrollTop === "number") {
      if (event.clientY < box.top + 55) root.scrollTop -= 22;
      else if (event.clientY > box.bottom - 55) root.scrollTop += 22;
    }
  };
  const end = () => {
    const dest = target?.dataset.line || target?.dataset.field,
      dropAfter = after,
      moved = active;
    cleanup();
    if (moved && dest && dest !== id) onMove(dest, dropAfter);
  };
  const cancel = () => cleanup();
  const leave = () => {
    if (!active) cleanup();
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") cleanup();
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", cancel);
  handle.addEventListener("pointerleave", leave);
  handle.addEventListener("lostpointercapture", cancel);
  window.addEventListener("keydown", escape);
}
