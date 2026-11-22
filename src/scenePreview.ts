import { ActiveSelection } from "fabric";
import type { FabricObject } from "fabric";
import type { FreePage } from "./freeform";
import type { LayerSvg } from "./FreeLayers";
import { prepareImageSvg } from "./canvasSvg";

const markup = new WeakMap<HTMLElement, string>();
export function setSvgContent(node: HTMLElement | null, svg: string) {
  if (!node || markup.get(node) === svg) return;
  node.innerHTML = svg;
  markup.set(node, svg);
}

// Serialize each object once, then share the layers with the canvas and detail view.
export function sceneLayers(
  objects: FabricObject[],
  page: Pick<FreePage, "width" | "height">,
): LayerSvg {
  const layers: LayerSvg = { background: "", foreground: "" };
  for (const object of objects) {
    if (!object.visible) continue;
    const plane =
      (object as FabricObject & { plane?: string }).plane === "background"
        ? "background"
        : "foreground";
    prepareImageSvg(object);
    const svg = object.toSVG();
    layers[plane] +=
      object.group instanceof ActiveSelection
        ? `<g transform="matrix(${object.group.calcTransformMatrix().join(" ")})">${svg}</g>`
        : svg;
  }
  for (const plane of ["background", "foreground"] as const)
    layers[plane] =
      `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${page.width} ${page.height}">${layers[plane]}</svg>`;
  return layers;
}

/** Viewport changes do not change vector markup. Invalidate only on scene edits. */
export class SceneLayerCache {
  private dirty = true;
  private width = 0;
  private height = 0;
  private layers: LayerSvg = { background: "", foreground: "" };

  invalidate = () => {
    this.dirty = true;
  };

  read(objects: FabricObject[], page: Pick<FreePage, "width" | "height">) {
    if (
      this.dirty ||
      page.width !== this.width ||
      page.height !== this.height
    ) {
      this.layers = sceneLayers(objects, page);
      this.width = page.width;
      this.height = page.height;
      this.dirty = false;
    }
    return this.layers;
  }
}

export class DetailRenderer {
  private viewport?: HTMLElement;
  private sheet = document.createElement("div");
  private back = document.createElement("div");
  private source = document.createElement("div");
  private front = document.createElement("div");
  private keys: readonly unknown[] = [];
  render(
    viewport: HTMLElement,
    page: FreePage,
    bounds: { left: number; top: number; width: number; height: number },
    layers: LayerSvg,
    readSource: () => HTMLElement | null | undefined,
    keys: readonly unknown[],
  ) {
    const width = viewport.clientWidth,
      height = viewport.clientHeight;
    if (this.viewport !== viewport) {
      this.viewport = viewport;
      this.back.style.cssText = this.front.style.cssText =
        "position:absolute;inset:0;pointer-events:none";
      this.source.style.display = "contents";
      this.sheet.replaceChildren(this.back, this.source, this.front);
      viewport.replaceChildren(this.sheet);
      this.keys = [];
    }
    this.sheet.style.cssText = `position:absolute;width:${page.width}px;height:${page.height}px;background:${page.background};transform-origin:0 0;transform:translate(${width / 2 - (bounds.left + bounds.width / 2) * 2}px,${height / 2 - (bounds.top + bounds.height / 2) * 2}px) scale(2)`;
    setSvgContent(this.back, layers.background);
    setSvgContent(this.front, layers.foreground);
    if (
      keys.length !== this.keys.length ||
      keys.some((key, i) => key !== this.keys[i])
    ) {
      const source = readSource()?.cloneNode(true) as HTMLElement | undefined;
      if (source) {
        source.style.transform = "none";
        source.style.pointerEvents = "none";
        source
          .querySelectorAll("[contenteditable], [data-edit], [data-line], [id]")
          .forEach((el) => {
            for (const attr of [
              "contenteditable",
              "data-edit",
              "data-line",
              "id",
            ])
              el.removeAttribute(attr);
          });
        source
          .querySelectorAll(".free-layer, .row-tools, .picture-handle")
          .forEach((el) => el.remove());
        this.source.replaceChildren(source);
      } else this.source.replaceChildren();
      this.keys = keys;
    }
  }
}
