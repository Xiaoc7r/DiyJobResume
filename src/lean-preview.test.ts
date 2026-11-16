// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { boundedAsyncCache } from "./boundedCache";
import { DetailRenderer, sceneLayers, setSvgContent } from "./scenePreview";
import { blankFreePage } from "./freeform";
import type { FabricObject } from "fabric";

describe("async render cache budget", () => {
  it("shares pending work, reuses the result, and retries rejected tasks", async () => {
    const cache = boundedAsyncCache<string>(
      3,
      100,
      (value) => value.length * 2,
    );
    const render = vi.fn(async () => "svg");
    const first = cache("a", render);
    expect(cache("a", render)).toBe(first);
    await first;
    expect(await cache("a", render)).toBe("svg");
    expect(render).toHaveBeenCalledTimes(1);
    await expect(
      cache("broken", async () => {
        throw new Error("decode failed");
      }),
    ).rejects.toThrow();
    expect(await cache("broken", async () => "recovered")).toBe("recovered");
  });
  it("counts completed SVG bytes and bypasses oversized keys and results", async () => {
    const cache = boundedAsyncCache<string>(
      10,
      20,
      (value) => value.length * 2,
    );
    const small = vi.fn(async () => "12345");
    await cache("a", small);
    await cache("b", small);
    await cache("a", small);
    expect(small).toHaveBeenCalledTimes(3);
    const big = vi.fn(async () => "x".repeat(30));
    await cache("x", big);
    await cache("x", big);
    await cache("long".repeat(20), big);
    await cache("long".repeat(20), big);
    expect(big).toHaveBeenCalledTimes(4);
  });
  it("never resurrects evicted pending results or deletes a newer entry on old failure", async () => {
    const cache = boundedAsyncCache<string>(
      1,
      100,
      (value) => value.length * 2,
    );
    let reject!: (e: Error) => void;
    const old = cache(
      "a",
      () =>
        new Promise((_, no) => {
          reject = no;
        }),
    );
    const assertion = expect(old).rejects.toThrow("old");
    await Promise.resolve();
    await cache("b", async () => "other");
    const newer = cache("a", async () => "new");
    reject(new Error("old"));
    await assertion;
    await newer;
    expect(cache("a", async () => "wrong")).toBe(newer);
  });
});

describe("shared vector and detail preview", () => {
  it("serializes each visible object once and skips DOM work on unchanged layers", () => {
    const object = (plane: string, visible = true) => ({
      visible,
      plane,
      toSVG: vi.fn(() => "<path/>"),
    });
    const back = object("background"),
      front = object("foreground"),
      hidden = object("foreground", false);
    const result = sceneLayers(
      [back, front, hidden] as unknown as FabricObject[],
      { width: 794, height: 1123 },
    );
    expect(back.toSVG).toHaveBeenCalledTimes(1);
    expect(front.toSVG).toHaveBeenCalledTimes(1);
    expect(hidden.toSVG).not.toHaveBeenCalled();
    const node = document.createElement("div");
    setSvgContent(node, result.foreground);
    const original = node.firstChild;
    setSvgContent(node, result.foreground);
    expect(node.firstChild).toBe(original);
    setSvgContent(node, "<svg><circle/></svg>");
    expect(node.firstChild).not.toBe(original);
  });
  it("reuses the paper and images while dragging, but refreshes content on edits and viewport replacement", () => {
    const renderer = new DetailRenderer(),
      viewport = document.createElement("div"),
      paper = document.createElement("article");
    paper.innerHTML =
      '<p data-edit="a" contenteditable="true">正文</p><img src="data:image/png;base64,AA==">';
    const read = vi.fn(() => paper),
      doc = {},
      page = blankFreePage(),
      bounds = { left: 0, top: 0, width: 20, height: 20 };
    const layers = {
      background: "<svg><rect/></svg>",
      foreground: "<svg><path/></svg>",
    };
    renderer.render(viewport, page, bounds, layers, read, [doc]);
    const first = viewport.querySelector("article"),
      image = viewport.querySelector("img");
    renderer.render(viewport, page, { ...bounds, left: 30 }, layers, read, [
      doc,
    ]);
    expect(viewport.querySelector("article")).toBe(first);
    expect(viewport.querySelector("img")).toBe(image);
    expect(read).toHaveBeenCalledTimes(1);
    expect(viewport.querySelector("[contenteditable]")).toBeNull();
    paper.querySelector("p")!.textContent = "已修改";
    renderer.render(viewport, page, bounds, layers, read, [{}]);
    expect(viewport.querySelector("article")!.textContent).toBe("已修改");
    const other = document.createElement("div");
    renderer.render(other, page, bounds, layers, read, [doc]);
    expect(other.querySelector("article")).toBeTruthy();
  });
});
