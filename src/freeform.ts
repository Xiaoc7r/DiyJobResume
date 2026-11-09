import type { Resume } from "./flow";
import type { CSSProperties } from "react";

export interface SourceDesign {
  dx?: number;
  dy?: number;
  width?: number;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  tags?: Record<string, Omit<SourceDesign, "tags">>;
}
export const sourceContentStyle = (design?: SourceDesign): CSSProperties => {
  if (!design) return {};
  const { dx: _x, dy: _y, width: _w, tags: _tags, ...style } = design;
  return {
    ...style,
    ...(design.borderWidth !== undefined ? { borderStyle: "solid" } : {}),
  };
};
export const sourceFrameStyle = (design?: SourceDesign): CSSProperties =>
  design
    ? {
        ...(design.dx || design.dy
          ? { transform: `translate(${design.dx || 0}px, ${design.dy || 0}px)` }
          : {}),
        ...(design.width !== undefined ? { width: design.width } : {}),
      }
    : {};
export function applySourceContentStyle(
  element: HTMLElement,
  design?: SourceDesign,
) {
  for (const [key, value] of Object.entries(sourceContentStyle(design))) {
    (element.style as unknown as Record<string, string>)[key] =
      typeof value === "number" && key !== "lineHeight"
        ? `${value}px`
        : String(value);
  }
}

export interface FreePage {
  id: string;
  width: number;
  height: number;
  background: string;
  canvas: { objects: Record<string, unknown>[]; version?: string };
}
export interface FreeDocument {
  version: 1;
  source: string;
  pages: FreePage[];
  base?: "flow";
  sourceDesign?: Record<string, SourceDesign>;
}
export const blankFreePage = (): FreePage => ({
  id: crypto.randomUUID(),
  width: 794,
  height: 1123,
  background: "#ffffff",
  canvas: { version: "7.4.0", objects: [] },
});

export function sourceFingerprint(doc: Resume) {
  const source = JSON.stringify([
    doc.lines,
    doc.settings,
    doc.template,
    doc.pictures,
  ]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++)
    hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

// Only our local drawing objects are accepted. Never let imported JSON fetch remote resources.
export function readFreeDocument(raw: unknown): FreeDocument {
  if (!raw || typeof raw !== "object") throw new Error("自由稿格式不正确。");
  const data = raw as FreeDocument;
  if (
    data.version !== 1 ||
    !Array.isArray(data.pages) ||
    !data.pages.length ||
    data.pages.length > 20 ||
    JSON.stringify(data).length > 12000000
  )
    throw new Error("自由稿最多支持 20 页，备份不能超过 12 MB。");
  let count = 0;
  const types = new Set([
    "Textbox",
    "IText",
    "Text",
    "Rect",
    "Circle",
    "Ellipse",
    "Triangle",
    "Line",
    "Path",
    "Polygon",
    "Polyline",
    "Group",
    "Image",
  ]);
  const validate = (object: unknown, depth: number) => {
    if (!object || typeof object !== "object" || depth > 12 || ++count > 3000)
      throw new Error("自由稿中的元素过多或格式不正确。");
    const o = object as Record<string, unknown>;
    if (!types.has(String(o.type))) throw new Error("自由稿包含不支持的元素。");
    for (const [key, value] of Object.entries(o)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw new Error("自由稿包含不支持的属性。");
      if (typeof value === "number" && !Number.isFinite(value))
        throw new Error("自由稿包含无效数值。");
    }
    if (
      o.type === "Image" &&
      (typeof o.src !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(o.src))
    )
      throw new Error("自由稿图片必须为本地 PNG、JPEG 或 WebP。");
    if (
      o.resizeFilter ||
      (o.filters &&
        (!Array.isArray(o.filters) ||
          o.filters.some(
            (f: unknown) =>
              !f ||
              typeof f !== "object" ||
              (f as { type?: string }).type !== "Grayscale",
          )))
    )
      throw new Error("自由稿包含不支持的图片滤镜。");
    const safeStyles = (value: unknown, level = 0) => {
      if (!value || typeof value !== "object" || level > 8) return;
      for (const [key, v] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new Error("自由稿包含不支持的属性。");
        if (typeof v === "number" && !Number.isFinite(v))
          throw new Error("自由稿包含无效数值。");
        if (
          [
            "fill",
            "stroke",
            "backgroundColor",
            "textBackgroundColor",
            "color",
          ].includes(key) &&
          v != null &&
          v !== "" &&
          (typeof v !== "string" ||
            !/^(#[a-f\d]{3,8}|[a-z]+|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\))$/i.test(
              v,
            ))
        )
          throw new Error("自由稿包含不支持的颜色。");
        if (
          key === "fontFamily" &&
          (typeof v !== "string" || /[<>"'&\\]/.test(v))
        )
          throw new Error("自由稿字体格式不正确。");
        if (
          key === "shadow" &&
          typeof v === "string" &&
          /[<>"'&\\]|url\(/i.test(v)
        )
          throw new Error("自由稿阴影格式不正确。");
        if (
          v &&
          typeof v === "object" &&
          !["objects", "clipPath", "path"].includes(key)
        )
          safeStyles(v, level + 1);
      }
    };
    safeStyles(o);
    if (o.clipPath) validate(o.clipPath, depth + 1);
    if (o.objects) {
      if (!Array.isArray(o.objects)) throw new Error("自由稿组合格式不正确。");
      o.objects.forEach((child) => validate(child, depth + 1));
    }
    // Paint servers can reference images too; the UI uses solid colors only.
    if (
      ["fill", "stroke"].some(
        (k) => o[k] !== undefined && o[k] !== null && typeof o[k] !== "string",
      )
    )
      throw new Error("暂不支持导入外部图案填充。");
  };
  const seen = new Set<string>();
  for (const page of data.pages) {
    if (
      !page ||
      !Number.isFinite(page.width) ||
      !Number.isFinite(page.height) ||
      page.width < 100 ||
      page.width > 5000 ||
      page.height < 100 ||
      page.height > 5000 ||
      !/^#[a-f\d]{6}$/i.test(page.background) ||
      !page.canvas ||
      !Array.isArray(page.canvas.objects)
    )
      throw new Error("自由稿纸张设置不正确。");
    if (typeof page.id !== "string" || seen.has(page.id))
      page.id = crypto.randomUUID();
    seen.add(page.id);
    page.canvas.objects.forEach((o) => validate(o, 0));
    page.canvas = { version: "7.4.0", objects: page.canvas.objects };
  }
  const sourceDesign: Record<string, SourceDesign> = {};
  const normalizeDesign = (raw: unknown, tags = true): SourceDesign => {
    const value =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const result: Record<string, unknown> = {};
    for (const key of [
      "dx",
      "dy",
      "width",
      "fontSize",
      "lineHeight",
      "borderWidth",
      "borderRadius",
      "padding",
    ]) {
      if (typeof value[key] === "number" && Number.isFinite(value[key]))
        result[key] = Math.max(
          key === "dx" || key === "dy" ? -5000 : 0,
          Math.min(5000, value[key] as number),
        );
    }
    for (const key of ["color", "backgroundColor", "borderColor"])
      if (
        typeof value[key] === "string" &&
        /^(#[a-f\d]{3,8}|rgba?\([\d.,\s%]+\)|transparent|none)$/i.test(
          value[key] as string,
        )
      )
        result[key] = value[key];
    if (
      typeof value.fontFamily === "string" &&
      /^[\w\s,-]{1,120}$/.test(value.fontFamily)
    )
      result.fontFamily = value.fontFamily;
    if (tags && value.tags && typeof value.tags === "object")
      result.tags = Object.fromEntries(
        Object.entries(value.tags)
          .filter(([k]) => /^\d{1,4}$/.test(k))
          .slice(0, 200)
          .map(([k, v]) => [k, normalizeDesign(v, false)]),
      );
    return result as SourceDesign;
  };
  if (data.sourceDesign && typeof data.sourceDesign === "object")
    for (const [id, design] of Object.entries(data.sourceDesign).slice(0, 2000))
      if (/^[a-z\d_-]{1,80}$/i.test(id))
        sourceDesign[id] = normalizeDesign(design);
  return {
    version: 1,
    source: typeof data.source === "string" ? data.source : "",
    pages: data.pages,
    ...(data.base === "flow" ? { base: "flow" as const, sourceDesign } : {}),
  };
}

export function freeText(doc: FreeDocument): string {
  const result: string[] = [];
  const walk = (objects: Record<string, unknown>[]) => {
    for (const o of objects) {
      if (typeof o.text === "string" && o.text.trim()) result.push(o.text);
      if (Array.isArray(o.objects)) walk(o.objects);
    }
  };
  doc.pages.forEach((p) => walk(p.canvas.objects));
  return result.join("\n\n");
}
