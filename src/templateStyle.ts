import type { Kind, Line, Resume } from "./flow";
import { readFreeDocument } from "./freeform";
import type { FreeDocument, SourceDesign } from "./freeform";

export type TemplateSlot = Exclude<Kind, "blank"> | "contact";
export interface TemplateStyle {
  version: 1;
  id: string;
  name: string;
  drawings: FreeDocument;
  headerFrame?: { x: number; y: number; width: number; height: number };
  regions?: { header: number; section: number };
  sectionFrame: { x: number; y: number; width: number; height: number };
  slots: Partial<Record<TemplateSlot, SourceDesign>>;
}
export function headerLines(lines: Line[]) {
  const start = lines.findIndex((line) => line.kind === "name");
  if (start < 0) return [];
  const end = lines.findIndex(
    (line, i) => i > start && line.kind === "section",
  );
  return lines
    .slice(start, end < 0 ? lines.length : end)
    .filter((line) => line.kind !== "blank");
}
export function templateSlot(lines: Line[], line: Line): TemplateSlot {
  return line.kind !== "name" &&
    headerLines(lines).some((row) => row.id === line.id)
    ? "contact"
    : line.kind === "blank"
      ? "text"
      : line.kind;
}
export function lineDesign(doc: Resume, line: Line) {
  return {
    ...doc.templateStyle?.slots[templateSlot(doc.lines, line)],
    ...doc.freeform?.sourceDesign?.[line.id],
  };
}
export function lineDesignResolver(doc: Resume) {
  const headers = new Set(headerLines(doc.lines).map((line) => line.id));
  const designs = new Map<string, SourceDesign>();
  for (const line of doc.lines) {
    const slot =
      line.kind !== "name" && headers.has(line.id)
        ? "contact"
        : line.kind === "blank"
          ? "text"
          : line.kind;
    const area = doc.templateStyle?.regions;
    const extra: SourceDesign = {};
    if (area && line.kind === "section") {
      extra.height = area.section;
      extra.minHeight = 0;
    }
    if (
      area &&
      line.kind === "name" &&
      line.id === doc.lines.find((row) => row.kind === "name")?.id
    ) {
      const other = headerLines(doc.lines)
        .filter((row) => row.id !== line.id)
        .reduce((sum, row) => {
          const d = doc.templateStyle?.slots.contact,
            t = doc.settings.types[row.kind === "blank" ? "text" : row.kind];
          return (
            sum +
            (d?.fontSize || t.size) *
              (d?.lineHeight || doc.settings.lineHeight) +
            t.before +
            t.after
          );
        }, 0);
      extra.height = Math.max(1, area.header - other);
      extra.minHeight = 0;
    }
    designs.set(line.id, {
      ...doc.templateStyle?.slots[slot],
      ...extra,
      ...doc.freeform?.sourceDesign?.[line.id],
    });
  }
  return (line: Line) => designs.get(line.id) || {};
}
// This versioned shape is shared by editable backups and the future template importer.
export function readTemplateStyle(raw: unknown): TemplateStyle {
  if (!raw || typeof raw !== "object") throw new Error("模板格式不正确。");
  const data = raw as TemplateStyle;
  if (
    data.version !== 1 ||
    !/^[a-z\d_-]{1,80}$/i.test(data.id) ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 60
  )
    throw new Error("模板名称或版本不支持。");
  const frame = data.sectionFrame;
  if (
    !frame ||
    ![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) ||
    frame.width < 1 ||
    frame.height < 1 ||
    frame.width > 5000 ||
    frame.height > 5000 ||
    Math.abs(frame.x) > 5000 ||
    Math.abs(frame.y) > 5000
  )
    throw new Error("模板绘制区域不正确。");
  if (
    data.regions &&
    (!data.headerFrame ||
      ![data.regions.header, data.regions.section].every(
        (n) => Number.isFinite(n) && n >= 12 && n <= 500,
      ))
  )
    throw new Error("模板区域尺寸不正确。");
  if (
    data.headerFrame &&
    (![
      data.headerFrame.x,
      data.headerFrame.y,
      data.headerFrame.width,
      data.headerFrame.height,
    ].every(Number.isFinite) ||
      Math.abs(data.headerFrame.x) > 5000 ||
      Math.abs(data.headerFrame.y) > 5000 ||
      data.headerFrame.width < 1 ||
      data.headerFrame.width > 5000 ||
      data.headerFrame.height < 1 ||
      data.headerFrame.height > 5000)
  )
    throw new Error("个人信息绘制区域不正确。");
  const drawings = readFreeDocument(structuredClone(data.drawings));
  const slots: TemplateStyle["slots"] = {};
  const allowed = [
    "name",
    "contact",
    "section",
    "entry",
    "text",
    "bullet",
    "ordered",
    "h4",
    "h5",
    "h6",
  ] as const;
  const normalized = readFreeDocument({
    ...drawings,
    base: "flow",
    sourceDesign: data.slots || {},
  }).sourceDesign!;
  for (const key of allowed) if (normalized[key]) slots[key] = normalized[key];
  return {
    version: 1,
    id: data.id,
    name: data.name.trim(),
    drawings,
    sectionFrame: {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    },
    slots,
    ...(data.headerFrame &&
    [
      data.headerFrame.x,
      data.headerFrame.y,
      data.headerFrame.width,
      data.headerFrame.height,
    ].every(Number.isFinite) &&
    data.headerFrame.width > 0 &&
    data.headerFrame.height > 0
      ? { headerFrame: { ...data.headerFrame } }
      : {}),
    ...(data.regions &&
    [data.regions.header, data.regions.section].every(
      (n) => Number.isFinite(n) && n >= 12 && n <= 500,
    )
      ? { regions: { ...data.regions } }
      : {}),
  };
}
