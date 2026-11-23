import { afterEach, describe, expect, it, vi } from "vitest";
import { holdDrag, trackPointer } from "./interaction";
function setup(holdMs = 350, track = false) {
  vi.useFakeTimers();
  const classes = () => ({ add: vi.fn(), remove: vi.fn() });
  const win = new EventTarget();
  Object.assign(win, {
    setTimeout,
    clearTimeout,
    getSelection: () => ({ removeAllRanges: vi.fn() }),
    requestAnimationFrame: (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16),
    cancelAnimationFrame: clearTimeout,
  });
  vi.stubGlobal("window", win);
  const row = (id: string, top: number) => ({
    dataset: { field: id },
    classList: classes(),
    getBoundingClientRect: () => ({ top, height: 20, bottom: top + 20 }),
  });
  const rows = [row("a", 0), row("b", 40)];
  const root = {
    querySelectorAll: vi.fn(() => rows),
    getBoundingClientRect: () => ({ top: 0, bottom: 400 }),
    scrollTop: 0,
  };
  vi.stubGlobal("document", { body: { classList: classes() } });
  const el = Object.assign(new EventTarget(), {
    classList: classes(),
    closest: (selector: string) =>
      selector.includes("simple-editor") ? root : null,
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  const move = vi.fn();
  const start = {
    button: 0,
    target: { closest: () => null },
    currentTarget: el,
    clientX: 10,
    clientY: 10,
    pointerId: 1,
  } as never;
  const finish = vi.fn();
  const cleanup = track
    ? trackPointer(start, move, finish)
    : holdDrag(start, "a", move, holdMs);
  const fire = (type: string, x = 10, y = 10, pointerId = 1) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { clientX: x, clientY: y, pointerId });
    el.dispatchEvent(e);
  };
  return { el, move, fire, root, rows, cleanup, finish, win };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("hold to move, click to edit", () => {
  it("batches pointer bursts and does not rewrite the same drop highlight", () => {
    const t = setup();
    vi.advanceTimersByTime(350);
    for (let i = 0; i < 100; i++) t.fire("pointermove", 30, 70);
    vi.advanceTimersByTime(16);
    expect(t.root.querySelectorAll).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 100; i++) t.fire("pointermove", 30, 70);
    vi.advanceTimersByTime(16);
    expect(t.rows[1].classList.add).toHaveBeenCalledTimes(1);
    t.fire("pointerup");
    expect(t.move).toHaveBeenCalledExactlyOnceWith("b", true);
  });
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
    t.fire("pointermove", 30, 45);
    t.fire("pointerup");
    expect(t.move).toHaveBeenCalledExactlyOnceWith("b", false);
    t.fire("pointerup");
    expect(t.move).toHaveBeenCalledTimes(1);
  });
  it("cancels a held move without changing content", () => {
    const t = setup();
    vi.advanceTimersByTime(350);
    t.fire("pointermove", 30, 45);
    t.fire("pointercancel");
    t.fire("pointerup");
    expect(t.move).not.toHaveBeenCalled();
    expect(t.el.releasePointerCapture).toHaveBeenCalled();
    vi.runAllTimers();
    expect(t.root.querySelectorAll).not.toHaveBeenCalled();
  });
  it("starts a grip immediately and releases pending movement before paint", () => {
    const t = setup(0);
    expect(t.el.setPointerCapture).toHaveBeenCalledExactlyOnceWith(1);
    t.fire("pointermove", 30, 45);
    t.fire("pointerup");
    vi.runAllTimers();
    expect(t.move).toHaveBeenCalledExactlyOnceWith("b", false);
    expect(t.root.querySelectorAll).toHaveBeenCalledTimes(1);
  });
  it("limits edge scrolling to one step per frame rather than per sample", () => {
    const t = setup(0);
    for (let i = 0; i < 100; i++) t.fire("pointermove", 30, 399);
    vi.advanceTimersByTime(16);
    expect(t.root.scrollTop).toBe(22);
    t.fire("pointercancel");
    vi.runAllTimers();
    expect(t.root.scrollTop).toBe(22);
  });
  it("cleans a delayed hold if pointer capture is no longer available", () => {
    const t = setup();
    t.el.setPointerCapture.mockImplementation(() => {
      throw new Error("pointer no longer exists");
    });
    expect(() => vi.advanceTimersByTime(350)).not.toThrow();
    t.fire("pointermove", 30, 45);
    vi.runAllTimers();
    expect(t.root.querySelectorAll).not.toHaveBeenCalled();
    expect(t.move).not.toHaveBeenCalled();
  });
  it("ignores a second pointer without ending the held gesture", () => {
    const t = setup(0);
    t.fire("pointermove", 30, 45, 2);
    t.fire("pointerup", 30, 45, 2);
    vi.runAllTimers();
    expect(t.root.querySelectorAll).not.toHaveBeenCalled();
    t.fire("pointermove", 30, 45);
    t.fire("pointerup");
    expect(t.move).toHaveBeenCalledExactlyOnceWith("b", false);
  });
  it.each(["blur", "escape", "lostpointercapture"])(
    "cleans the frame and drop marker on %s",
    (reason) => {
      const t = setup(0);
      t.fire("pointermove", 30, 45);
      vi.advanceTimersByTime(16);
      t.fire("pointermove", 30, 70);
      if (reason === "escape") {
        const event = new Event("keydown");
        Object.assign(event, { key: "Escape" });
        t.win.dispatchEvent(event);
      } else if (reason === "blur") t.win.dispatchEvent(new Event("blur"));
      else t.fire(reason);
      t.fire("pointerup");
      vi.runAllTimers();
      expect(t.root.querySelectorAll).toHaveBeenCalledTimes(1);
      expect(t.rows[1].classList.remove).toHaveBeenCalledWith("drop-target");
      expect(t.move).not.toHaveBeenCalled();
      expect(t.el.releasePointerCapture).toHaveBeenCalledTimes(1);
    },
  );
  it("does not activate a detached handle or retain window listeners", () => {
    const t = setup();
    Object.assign(t.el, { isConnected: false });
    vi.advanceTimersByTime(350);
    t.fire("pointermove", 30, 45);
    t.win.dispatchEvent(new Event("blur"));
    vi.runAllTimers();
    expect(t.el.setPointerCapture).not.toHaveBeenCalled();
    expect(t.root.querySelectorAll).not.toHaveBeenCalled();
    expect(t.el.releasePointerCapture).toHaveBeenCalledTimes(1);
  });
});

describe("frame-coalesced pointer sessions", () => {
  it("processes only the last sample per frame and flushes release once", () => {
    const t = setup(0, true);
    for (let i = 0; i < 100; i++) t.fire("pointermove", i, 45);
    expect(t.move).not.toHaveBeenCalled();
    vi.advanceTimersByTime(16);
    expect(t.move).toHaveBeenCalledTimes(1);
    expect(t.move.mock.calls[0][0].clientX).toBe(99);
    t.fire("pointermove", 101, 46);
    t.fire("pointerup");
    t.fire("pointerup");
    vi.runAllTimers();
    expect(t.move).toHaveBeenCalledTimes(2);
    expect(t.move.mock.calls[1][0].clientX).toBe(101);
    expect(t.finish).toHaveBeenCalledTimes(1);
    expect(t.el.releasePointerCapture).toHaveBeenCalledTimes(1);
  });
  it.each(["pointercancel", "lostpointercapture", "blur", "escape", "unmount"])(
    "retains the last painted sample and drops pending work on %s",
    (reason) => {
      const t = setup(0, true);
      t.fire("pointermove", 20, 20);
      vi.advanceTimersByTime(16);
      t.fire("pointermove", 30, 30);
      if (reason === "unmount") t.cleanup?.();
      else if (reason === "blur") t.win.dispatchEvent(new Event("blur"));
      else if (reason === "escape") {
        const event = new Event("keydown");
        Object.assign(event, { key: "Escape" });
        t.win.dispatchEvent(event);
      } else t.fire(reason);
      t.fire("pointerup");
      t.fire("pointermove", 40, 40);
      vi.runAllTimers();
      expect(t.move).toHaveBeenCalledTimes(1);
      expect(t.move.mock.calls[0][0].clientX).toBe(20);
      expect(t.finish).toHaveBeenCalledTimes(1);
      expect(t.el.releasePointerCapture).toHaveBeenCalledTimes(1);
    },
  );
  it("ignores movement and cancellation from other pointers", () => {
    const t = setup(0, true);
    t.fire("pointermove", 30, 30, 2);
    t.fire("pointercancel", 30, 30, 2);
    t.fire("pointerup", 30, 30, 2);
    vi.runAllTimers();
    expect(t.move).not.toHaveBeenCalled();
    expect(t.finish).not.toHaveBeenCalled();
    t.fire("pointermove", 20, 20);
    t.fire("pointerup");
    expect(t.move).toHaveBeenCalledTimes(1);
    expect(t.finish).toHaveBeenCalledTimes(1);
  });
  it("still disposes the session when the browser has removed the pointer", () => {
    const t = setup(0, true);
    t.el.releasePointerCapture.mockImplementation(() => {
      throw new Error("pointer no longer exists");
    });
    t.fire("pointermove");
    expect(() => t.cleanup?.()).not.toThrow();
    vi.runAllTimers();
    expect(t.move).not.toHaveBeenCalled();
    expect(t.finish).toHaveBeenCalledTimes(1);
  });
});
