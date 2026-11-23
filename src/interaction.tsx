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
    editing = useRef(false),
    emitted = useRef(value);
  useEffect(() => {
    if (!editing.current || value !== emitted.current) setDraft(String(value));
    emitted.current = value;
  }, [value]);
  const finish = () => {
    editing.current = false;
    const n = draft.trim() === "" ? value : Number(draft);
    const next = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : value;
    setDraft(String(next));
    if (next !== value) {
      emitted.current = next;
      onChange(next);
    }
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
        if (text !== "" && Number.isFinite(n) && n >= min && n <= max) {
          emitted.current = n;
          onChange(n);
        }
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

// Keep at most one pending sample. Release flushes it even before the next paint;
// cancellation drops it so a completed gesture can never write state later.
function pointerFrame(onMove: (event: PointerEvent) => void) {
  let frame: number | undefined;
  let pending: PointerEvent | undefined;
  const cancel = () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    pending = undefined;
  };
  const flush = () => {
    const event = pending;
    cancel();
    if (event) onMove(event);
  };
  return {
    push(event: PointerEvent) {
      pending = event;
      frame ??= window.requestAnimationFrame(flush);
    },
    flush,
    cancel,
  };
}

function releasePointer(handle: HTMLElement, pointerId: number) {
  try {
    if (handle.hasPointerCapture(pointerId))
      handle.releasePointerCapture(pointerId);
  } catch {
    // The browser may already have removed a cancelled pointer or its target.
  }
}

// Shared by sidebar and picture gestures. Call the returned cleanup when their
// document/mode unmounts; cancellation preserves the last visible position.
export function trackPointer(
  e: ReactPointerEvent,
  onMove: (event: PointerEvent) => void,
  onFinish: () => void,
) {
  const handle = e.currentTarget as HTMLElement;
  const pointerId = e.pointerId;
  const updates = pointerFrame(onMove);
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    updates.cancel();
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", cancel);
    handle.removeEventListener("lostpointercapture", cancel);
    window.removeEventListener("blur", cleanup);
    window.removeEventListener("keydown", escape);
    releasePointer(handle, pointerId);
    onFinish();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    updates.push(event);
  };
  const end = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    try {
      updates.flush();
    } finally {
      cleanup();
    }
  };
  const cancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) cleanup();
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") cleanup();
  };
  try {
    handle.setPointerCapture(pointerId);
  } catch {
    onFinish();
    return () => {};
  }
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", cancel);
  handle.addEventListener("lostpointercapture", cancel);
  window.addEventListener("blur", cleanup);
  window.addEventListener("keydown", escape);
  return cleanup;
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
  if (holdMs && (e.target as HTMLElement).closest("button,input,select,a"))
    return;
  const handle = e.currentTarget as HTMLElement,
    pointerId = e.pointerId,
    startX = e.clientX,
    startY = e.clientY,
    root =
      handle.closest?.<HTMLElement>(".simple-editor,.paper-workspace") ??
      document.body;
  let active = false,
    closed = false,
    timer: number | undefined,
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
    if (handle.isConnected === false) {
      cleanup();
      return;
    }
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      cleanup();
      return;
    }
    active = true;
    document.body.classList.add("holding-block");
    handle.classList.add("moving-block");
    handle.closest?.(".edit-field")?.classList.add("moving-block");
    window.getSelection()?.removeAllRanges();
  };
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    updates.cancel();
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
    window.removeEventListener("blur", cleanup);
    releasePointer(handle, pointerId);
  };
  const updates = pointerFrame((event) => {
    window.getSelection()?.removeAllRanges();
    const hit = pickAt(event.clientY);
    const next = hit?.row ?? null;
    if (target !== next) {
      clearTarget();
      target = next;
      target?.classList.add("drop-target");
    }
    after = hit?.after ?? false;
    const box = root.getBoundingClientRect?.();
    if (box && typeof root.scrollTop === "number") {
      if (event.clientY < box.top + 55) root.scrollTop -= 22;
      else if (event.clientY > box.bottom - 55) root.scrollTop += 22;
    }
  });
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    if (!active) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 5)
        cleanup();
      return;
    }
    event.preventDefault();
    updates.push(event);
  };
  const end = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    try {
      updates.flush();
      const dest = target?.dataset.line || target?.dataset.field,
        dropAfter = after,
        moved = active;
      cleanup();
      if (moved && dest && dest !== id) onMove(dest, dropAfter);
    } finally {
      cleanup();
    }
  };
  const cancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) cleanup();
  };
  const leave = (event: PointerEvent) => {
    if (event.pointerId === pointerId && !active) cleanup();
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
  window.addEventListener("blur", cleanup);
  if (holdMs) timer = window.setTimeout(activate, holdMs);
  else activate();
}
