import { afterEach, describe, expect, it, vi } from "vitest";
import { holdDrag } from "./interaction";
function setup() {
  vi.useFakeTimers();
  const classes = () => ({ add: vi.fn(), remove: vi.fn() });
  const win = new EventTarget();
  Object.assign(win, {
    setTimeout,
    clearTimeout,
    getSelection: () => ({ removeAllRanges: vi.fn() }),
  });
  vi.stubGlobal("window", win);
  const destination = {
    dataset: { line: "b" },
    classList: classes(),
    closest: () => null,
  };
  vi.stubGlobal("document", {
    body: { classList: classes() },
    elementFromPoint: () => ({ closest: () => destination }),
  });
  const el = Object.assign(new EventTarget(), {
    classList: classes(),
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  const move = vi.fn();
  holdDrag(
    {
      button: 0,
      target: { closest: () => null },
      currentTarget: el,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    } as never,
    "a",
    move,
  );
  const fire = (type: string, x = 10, y = 10) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { clientX: x, clientY: y, pointerId: 1 });
    el.dispatchEvent(e);
  };
  return { el, move, fire };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("hold to move, click to edit", () => {
  it("does not drag after a quick click", () => {
    const t = setup();
    t.fire("pointerup");
    vi.advanceTimersByTime(500);
    expect(t.el.setPointerCapture).not.toHaveBeenCalled();
    expect(t.move).not.toHaveBeenCalled();
  });
  it("keeps quick text selection native", () => {
    const t = setup();
    t.fire("pointermove", 30, 10);
    vi.advanceTimersByTime(500);
    t.fire("pointerup");
    expect(t.el.setPointerCapture).not.toHaveBeenCalled();
  });
  it("moves once after holding and releasing over another block", () => {
    const t = setup();
    vi.advanceTimersByTime(350);
    t.fire("pointermove", 30, 50);
    t.fire("pointerup");
    expect(t.move).toHaveBeenCalledExactlyOnceWith("b");
    t.fire("pointerup");
    expect(t.move).toHaveBeenCalledTimes(1);
  });
  it("cancels a held move without changing content", () => {
    const t = setup();
    vi.advanceTimersByTime(350);
    t.fire("pointermove", 30, 50);
    t.fire("pointercancel");
    t.fire("pointerup");
    expect(t.move).not.toHaveBeenCalled();
    expect(t.el.releasePointerCapture).toHaveBeenCalled();
  });
});
