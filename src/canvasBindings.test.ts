// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Rect, FabricImage } from "fabric";
import type { Canvas, FabricObject } from "fabric";
import { cloneSceneObjects } from "./freeScene";
import { CanvasBindings } from "./canvasBindings";
import { initialResume } from "./flow";
import { blankFreePage } from "./freeform";
import type { FreeDocument } from "./freeform";

function surface() {
  const objects: FabricObject[] = [];
  return {
    disposed: false,
    getActiveObject: () => undefined,
    getObjects: () => [...objects],
    add: (object: FabricObject) => objects.push(object),
    remove: (object: FabricObject) =>
      objects.splice(objects.indexOf(object), 1),
    requestRenderAll: vi.fn(),
    toObject: () => ({
      objects: objects
        .filter((object) => !object.excludeFromExport)
        .map((object) => object.toObject()),
    }),
  } as unknown as Canvas;
}
const documentModel = (): FreeDocument => ({
  version: 1,
  source: "",
  pages: [blankFreePage()],
});
afterEach(() => vi.restoreAllMocks());

describe("canvas snapshot and asynchronous binding ownership", () => {
  it("disposes successful clones when another object fails to decode", async () => {
    const first = new Rect(),
      second = new Rect(),
      copy = new Rect();
    const dispose = vi.spyOn(copy, "dispose");
    vi.spyOn(first, "clone").mockResolvedValue(copy);
    vi.spyOn(second, "clone").mockRejectedValue(new Error("decode failed"));
    await expect(cloneSceneObjects([first, second])).rejects.toThrow(
      "decode failed",
    );
    expect(dispose).toHaveBeenCalledOnce();
  });
  it("serializes each picture once per snapshot and preserves duplicate-ID native objects", async () => {
    const bindings = new CanvasBindings(),
      canvas = surface(),
      doc = initialResume(),
      model = documentModel();
    const picture = new Rect({ width: 64, height: 64 });
    vi.spyOn(FabricImage, "fromURL").mockResolvedValue(
      picture as unknown as FabricImage,
    );
    await bindings.install(canvas, doc, model, 0, null, {});
    const raw = vi.spyOn(picture, "toObject");
    const native = new Rect({ id: picture.get("id"), width: 20, height: 20 });
    canvas.add(native);
    const hiddenHelper = new Rect({ excludeFromExport: true });
    canvas.add(hiddenHelper);
    expect(bindings.snapshot(canvas, doc, model, 0)).toBe(doc.pictures);
    expect(raw).toHaveBeenCalledTimes(1);
    expect(model.pages[0].canvas.objects).toHaveLength(1);
    expect(model.pages[0].canvas.objects[0].width).toBe(20);
    picture.set({ opacity: 0.4 });
    expect(bindings.snapshot(canvas, doc, model, 0)).toEqual([]);
    expect(model.pages[0].canvas.objects).toHaveLength(2);
    expect(model.pages[0].canvas.objects[0].opacity).toBe(0.4);
  });
  it("does not install canceled image results into another page", async () => {
    const bindings = new CanvasBindings(),
      canvas = surface(),
      doc = initialResume(),
      model = documentModel();
    let resolve!: (object: FabricImage) => void;
    vi.spyOn(FabricImage, "fromURL").mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const loading = bindings.install(canvas, doc, model, 0, null, {});
    bindings.cancel();
    const old = new Rect({ width: 50, height: 50 });
    const dispose = vi.spyOn(old, "dispose");
    resolve(old as unknown as FabricImage);
    await loading;
    expect(canvas.getObjects()).toEqual([]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(bindings.snapshot(canvas, doc, model, 0)).toBe(doc.pictures);
  });
});
