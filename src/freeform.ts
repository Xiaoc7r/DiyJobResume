import type { Resume } from "./flow";

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
  return {
    version: 1,
    source: typeof data.source === "string" ? data.source : "",
    pages: data.pages,
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
