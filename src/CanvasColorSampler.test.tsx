// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CanvasColorSampler } from "./CanvasColorSampler";
import { captureColorSurface } from "./domExport";
vi.mock("./domExport", () => ({ captureColorSurface: vi.fn() }));

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("applies a pending sample once and ignores rapid duplicate clicks", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"),
    paper = document.createElement("div");
  host.className = "paper-workspace";
  paper.className = "resume-paper";
  host.append(paper);
  document.body.append(host);
  const root = createRoot(document.createElement("div")),
    pick = vi.fn();
  let finish!: (canvas: HTMLCanvasElement) => void;
  vi.mocked(captureColorSurface).mockReturnValue(
    new Promise((done) => {
      finish = done;
    }),
  );
  await act(async () => {
    root.render(
      createElement(CanvasColorSampler, { onPick: pick, onError: vi.fn() }),
    );
  });
  await act(async () => {
    for (let i = 0; i < 3; i++)
      paper.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  });
  await vi.waitFor(() => expect(captureColorSurface).toHaveBeenCalledOnce());
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue({
    getImageData: () => ({ data: new Uint8ClampedArray([16, 89, 165, 255]) }),
  } as unknown as CanvasRenderingContext2D);
  await act(async () => {
    finish(canvas);
  });
  expect(pick).toHaveBeenCalledExactlyOnceWith("#1059a5");
  await act(async () => {
    root.unmount();
  });
  expect(document.body.classList.contains("color-picking")).toBe(false);
});

it("ignores a sample completing after cancellation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const paper = document.createElement("div");
  paper.className = "free-canvas-host";
  document.body.append(paper);
  const root = createRoot(document.createElement("div")),
    pick = vi.fn(),
    error = vi.fn();
  let finish!: (canvas: HTMLCanvasElement) => void;
  vi.mocked(captureColorSurface).mockReturnValue(
    new Promise((done) => {
      finish = done;
    }),
  );
  await act(async () => {
    root.render(
      createElement(CanvasColorSampler, { onPick: pick, onError: error }),
    );
  });
  await act(async () => {
    paper.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  });
  await vi.waitFor(() => expect(finish).toBeDefined());
  await act(async () => {
    root.unmount();
    finish(document.createElement("canvas"));
  });
  expect(pick).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});
