// @vitest-environment jsdom
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { StaticCanvas, Textbox, Rect, Group } from "fabric";
import { act, createElement, createRef, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import FreeStudio from "./FreeStudio";
import type { FreeStudioApi } from "./FreeStudio";
import {
  blankFreePage,
  readFreeDocument,
  sourceFingerprint,
  freeText,
} from "./freeform";
import type { FreeDocument } from "./freeform";
import { initialResume, readResume } from "./flow";
import { cloneResume, loadLibrary, saveLibrary } from "./docs";
import { captureFreeform } from "./freeCapture";

// Native 2D text metrics and SVG serialization in a Node DOM. This is not a browser UI test.
const makeNativeCanvas = (width: number, height: number) =>
  createCanvas(width, height);
const surfaces = new WeakMap<
  HTMLCanvasElement,
  ReturnType<typeof makeNativeCanvas>
>();
const roots: Root[] = [];
beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: function (this: HTMLCanvasElement) {
      let canvas = surfaces.get(this);
      if (!canvas) {
        canvas = createCanvas(this.width || 300, this.height || 150);
        surfaces.set(this, canvas);
      }
      if (canvas.width !== this.width) canvas.width = this.width;
      if (canvas.height !== this.height) canvas.height = this.height;
      const context = canvas.getContext("2d");
      return new Proxy(context, {
        get(target, key) {
          const value = Reflect.get(target, key, target);
          if (key === "drawImage")
            return (source: HTMLCanvasElement, ...args: number[]) =>
              Reflect.apply(value, target, [
                surfaces.get(source) || source,
                ...args,
              ]);
          return typeof value === "function" ? value.bind(target) : value;
        },
        set(target, key, value) {
          return Reflect.set(target, key, value, target);
        },
      });
    },
  });
  Object.defineProperty(document, "fonts", {
    value: {
      ready: Promise.resolve(),
      status: "loaded",
      load: () => Promise.resolve([]),
    },
    configurable: true,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach((root) => root.unmount());
  });
  document.body.innerHTML = "";
  localStorage.clear();
});
const draft = (): FreeDocument => {
  const page = blankFreePage();
  page.canvas.objects = [
    new Textbox("独立可编辑文字", {
      left: 42,
      top: 50,
      width: 300,
      fontSize: 16,
      originX: "left",
      originY: "top",
    }).toObject() as unknown as Record<string, unknown>,
  ];
  return readFreeDocument(
    JSON.parse(
      JSON.stringify({ version: 1, source: "original", pages: [page] }),
    ),
  );
};
describe("free document persistence and boundaries", () => {
  it("rejects SVG paint injection and external style resources in nested text runs", () => {
    const doc = draft();
    doc.pages[0].canvas.objects[0].fill = "url(https://example.com/x)";
    expect(() => readFreeDocument(doc)).toThrow("颜色");
    doc.pages[0].canvas.objects[0].fill = "#171717";
    doc.pages[0].canvas.objects[0].styles = {
      0: { 0: { fill: 'red" onload="alert(1)' } },
    };
    expect(() => readFreeDocument(doc)).toThrow("颜色");
  });

  it("preserves the complete free draft through backup, library migration and copy without changing structured content", () => {
    const doc = initialResume(),
      original = structuredClone(doc.lines);
    doc.freeform = draft();
    expect(readResume(JSON.parse(JSON.stringify(doc))).freeform).toEqual(
      doc.freeform,
    );
    saveLibrary({
      activeId: "one",
      items: [{ id: "one", name: doc.name, updatedAt: 1, doc }],
    });
    expect(loadLibrary().library.items[0].doc.freeform).toEqual(doc.freeform);
    const copied = cloneResume(doc, "副本");
    copied.freeform!.pages[0].canvas.objects[0].text = "副本文字";
    expect(freeText(doc.freeform)).toBe("独立可编辑文字");
    expect(doc.lines).toEqual(original);
  });
  it("detects source changes while ignoring free draft changes", () => {
    const doc = initialResume(),
      first = sourceFingerprint(doc);
    doc.freeform = draft();
    expect(sourceFingerprint(doc)).toBe(first);
    doc.lines[0] = { ...doc.lines[0], text: "新名字" };
    expect(sourceFingerprint(doc)).not.toBe(first);
  });
  it("rejects remote images, unknown classes and hidden network filters", () => {
    const data = draft();
    data.pages[0].canvas.objects = [
      { type: "Image", src: "https://example.com/private.png" },
    ];
    expect(() => readFreeDocument(data)).toThrow("本地");
    data.pages[0].canvas.objects = [{ type: "ExternalWidget" }];
    expect(() => readFreeDocument(data)).toThrow("不支持");
    data.pages[0].canvas.objects = [
      {
        type: "Rect",
        filters: [
          { type: "BlendImage", image: { src: "https://example.com/a" } },
        ],
      },
    ];
    expect(() => readFreeDocument(data)).toThrow("滤镜");
  });
  it("discards unsupported canvas-level resources and limits oversized pages", () => {
    const data = draft();
    Object.assign(data.pages[0].canvas, {
      backgroundImage: { type: "Image", src: "https://example.com/a" },
    });
    expect(readFreeDocument(data).pages[0].canvas).not.toHaveProperty(
      "backgroundImage",
    );
    data.pages[0].width = 999999;
    expect(() => readFreeDocument(data)).toThrow("纸张");
  });
  it("retains text and vector elements when serializing groups for export", async () => {
    const c = new StaticCanvas(undefined, { width: 794, height: 1123 });
    c.add(
      new Group([
        new Rect({ width: 200, height: 40, fill: "#0756a5" }),
        new Textbox("专业技能", { width: 180, fontSize: 16 }),
      ]),
    );
    const data = draft();
    data.pages[0].canvas = c.toObject();
    readFreeDocument(data);
    const restored = new StaticCanvas(undefined, { width: 794, height: 1123 });
    await restored.loadFromJSON(data.pages[0].canvas);
    const svg = restored.toSVG();
    expect(svg).toContain("专业技能");
    expect(svg).toContain("<text");
    expect(svg).toContain("<rect");
    expect(svg).not.toContain("<image");
    await c.dispose();
    await restored.dispose();
  });
  it("reuses source rendering without converting or mutating any original markup", async () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<article class="resume-paper"><div data-edit="name" style="font-size:24px;line-height:36px;text-align:center"><strong>测试姓名</strong></div><div data-edit="body" style="font-size:13px;line-height:19.5px"><span>正文 <em>斜体</em></span></div></article>';
    document.body.append(root);
    root.querySelector("article")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 794, height: 1123 }) as DOMRect;
    root.querySelectorAll<HTMLElement>("[data-edit]").forEach((el, i) => {
      el.getBoundingClientRect = () =>
        ({ left: 42, top: 40 + i * 40, width: 710, height: 36 }) as DOMRect;
    });
    const original = root.innerHTML;
    const captured = await captureFreeform(root, initialResume());
    expect(captured.base).toBe("flow");
    expect(captured.pages[0].canvas.objects).toEqual([]);
    expect(root.innerHTML).toBe(original);
    readFreeDocument(captured);
  });
});

async function mountEditor() {
  const doc = initialResume();
  doc.freeform = draft();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const apiRef = createRef<FreeStudioApi>();
  let saved = doc.freeform;
  const onMode = vi.fn();
  await act(async () => {
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(FreeStudio, {
          doc,
          apiRef,
          onMode,
          onRebuild: vi.fn(),
          onChange: (value) => {
            saved = value;
          },
        }),
      ),
    );
  });
  await act(async () => {
    await vi.waitFor(() =>
      expect(container.querySelector(".free-loading")).toBeNull(),
    );
  });
  return { container, apiRef, saved: () => saved, onMode };
}
async function click(container: HTMLElement, name: string) {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (b) =>
      b.getAttribute("aria-label") === name || b.textContent?.trim() === name,
  );
  expect(button, name).toBeTruthy();
  expect(button!.disabled, name).toBe(false);
  await act(async () => {
    button!.click();
  });
}
describe("free editor actions in a Node DOM", () => {
  it("prepares actual vector pages before printing and prevents concurrent duplicate exports", async () => {
    const e = await mountEditor();
    let exported = "";
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      exported = e.container.querySelector(".free-print")?.innerHTML || "";
    });
    try {
      await act(async () => {
        await Promise.all([
          e.apiRef.current!.print(),
          e.apiRef.current!.print(),
        ]);
      });
      expect(print).toHaveBeenCalledTimes(1);
      expect(exported).toContain("独立可编辑文字");
      expect(exported).toContain("<text");
      expect(exported).not.toContain("<canvas");
      await act(async () => {
        window.dispatchEvent(new Event("afterprint"));
      });
    } finally {
      print.mockRestore();
    }
  });
  it("preserves lock settings and links in editable backups", async () => {
    const c = new StaticCanvas(undefined, { width: 794, height: 1123 });
    const object = new Rect({ width: 20, height: 20 });
    object.set({
      lockMovementX: true,
      lockMovementY: true,
      hasControls: false,
      link: "https://github.com/Xiaoc7r",
    });
    c.add(object);
    const data = draft();
    data.pages[0].canvas = c.toObject();
    const saved = readFreeDocument(JSON.parse(JSON.stringify(data)));
    expect(saved.pages[0].canvas.objects[0].lockMovementX).toBe(true);
    expect(saved.pages[0].canvas.objects[0].link).toBe(
      "https://github.com/Xiaoc7r",
    );
    await c.loadFromJSON(saved.pages[0].canvas);
    expect(c.getObjects()[0].lockMovementX).toBe(true);
    expect(c.getObjects()[0].hasControls).toBe(false);
    await c.dispose();
  });
  it("adds shapes, copies, deletes, undoes and redoes without rewriting structured text", async () => {
    const e = await mountEditor();
    await click(e.container, "矩形");
    expect(e.saved().pages[0].canvas.objects).toHaveLength(2);
    await click(e.container, "复制选中元素");
    expect(e.saved().pages[0].canvas.objects).toHaveLength(3);
    await click(e.container, "删除选中元素");
    expect(e.saved().pages[0].canvas.objects).toHaveLength(2);
    await act(async () => {
      e.apiRef.current!.undo();
    });
    expect(e.saved().pages[0].canvas.objects).toHaveLength(3);
    await act(async () => {
      e.apiRef.current!.redo();
    });
    expect(e.saved().pages[0].canvas.objects).toHaveLength(2);
    readFreeDocument(e.saved());
  });
  it("adds a real editable table, ungroups it and preserves it when leaving free mode", async () => {
    const e = await mountEditor();
    await click(e.container, "插入");
    expect(e.saved().pages[0].canvas.objects.at(-1)?.type).toBe("Group");
    await click(e.container, "解组 Ctrl+Shift+G");
    expect(
      e.saved().pages[0].canvas.objects.filter((o) => o.type === "Textbox")
        .length,
    ).toBeGreaterThan(1);
    await click(e.container, "Markdown");
    expect(e.onMode).toHaveBeenCalledWith("md");
    readFreeDocument(e.saved());
  });
  it("adds pages and supports undo without losing the original page", async () => {
    const e = await mountEditor();
    await click(e.container, "新增自由页");
    expect(e.saved().pages).toHaveLength(2);
    expect(e.saved().pages[0].canvas.objects).toHaveLength(1);
    await act(async () => {
      e.apiRef.current!.undo();
    });
    expect(e.saved().pages).toHaveLength(1);
    expect(freeText(e.saved())).toBe("独立可编辑文字");
  });
  it("inserts an SVG icon as vector objects with no network image dependency", async () => {
    const e = await mountEditor();
    await click(e.container, "插入邮箱图标");
    await act(async () => {
      await vi.waitFor(() =>
        expect(e.saved().pages[0].canvas.objects).toHaveLength(2),
      );
    });
    expect(e.saved().pages[0].canvas.objects[1].type).not.toBe("Image");
    readFreeDocument(e.saved());
  });
});
