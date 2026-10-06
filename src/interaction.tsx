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
export function holdDrag(
  e: ReactPointerEvent,
  id: string,
  onMove: (target: string) => void,
) {
  if (
    e.button !== 0 ||
    (e.target as HTMLElement).closest("button,input,select,a")
  )
    return;
  const handle = e.currentTarget as HTMLElement,
    startX = e.clientX,
    startY = e.clientY;
  let active = false,
    target: HTMLElement | null = null;
  const clearTarget = () => {
    target?.classList.remove("drop-target");
    target = null;
  };
  const timer = window.setTimeout(() => {
    active = true;
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add("holding-block");
    handle.classList.add("moving-block");
    window.getSelection()?.removeAllRanges();
  }, 350);
  const cleanup = () => {
    clearTimeout(timer);
    clearTarget();
    document.body.classList.remove("holding-block");
    handle.classList.remove("moving-block");
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
    target =
      document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-line],[data-field]") || null;
    if ((target?.dataset.line || target?.dataset.field) !== id)
      target?.classList.add("drop-target");
    const scroller = target?.closest<HTMLElement>(
      ".paper-workspace,.simple-editor",
    );
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (event.clientY < r.top + 55) scroller.scrollTop -= 22;
      else if (event.clientY > r.bottom - 55) scroller.scrollTop += 22;
    }
  };
  const end = () => {
    const dest = target?.dataset.line || target?.dataset.field;
    const moved = active;
    cleanup();
    if (moved && dest && dest !== id) onMove(dest);
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
