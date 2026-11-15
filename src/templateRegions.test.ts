import { describe, it, expect } from "vitest";
import { initialResume, readResume, parseMarkdown } from "./flow";
import { blankFreePage } from "./freeform";
import { applyUserTemplate } from "./templateLibrary";
import type { UserTemplate } from "./templateLibrary";
import { lineDesignResolver, readTemplateStyle } from "./templateStyle";
import { templateZones } from "./TemplateDecorations";

function template(): UserTemplate {
  const draft = initialResume("blank");
  draft.freeform = {
    version: 1,
    base: "flow",
    source: "",
    pages: [blankFreePage()],
  };
  return {
    version: 1,
    id: "region-template",
    name: "区域模板",
    drawings: draft.freeform,
    sectionFrame: { x: 42, y: 114, width: 710, height: 30 },
    headerFrame: { x: 42, y: 30, width: 710, height: 84 },
    regions: { header: 84, section: 30 },
    slots: {
      section: { fontSize: 17, color: "#000000" },
      name: { fontSize: 24 },
      contact: { fontSize: 13 },
    },
    settings: {
      ...draft.settings,
      font: "serif",
      color: "#ff0000",
      lineHeight: 3,
    },
    draft,
    updatedAt: 1,
  };
}
describe("reusable template regions", () => {
  it("applies only header and section properties without replacing body settings or canvas elements", () => {
    const original = initialResume(),
      next = applyUserTemplate(original, template());
    expect(next.settings).toEqual(original.settings);
    expect(next.lines).toEqual(original.lines);
    expect(next.pictures).toEqual(original.pictures);
    expect(next.freeform).toEqual(original.freeform);
    const design = lineDesignResolver(next);
    expect(
      design(next.lines.find((row) => row.kind === "section")!),
    ).toMatchObject({ height: 30, fontSize: 17, color: "#000000" });
    const body = next.lines.find((row) => row.kind === "bullet")!;
    expect(design(body).fontSize).toBeUndefined();
    expect(
      readResume(JSON.parse(JSON.stringify(next))).templateStyle?.regions,
    ).toEqual({ header: 84, section: 30 });
  });
  it("uses actual per-page flow positions and retains source offsets for decorations", () => {
    const doc = initialResume("blank");
    doc.lines = parseMarkdown(
      "# 姓名\n联系信息\n## 教育背景\n正文\n## 工作经历",
    );
    const pieces = doc.lines.map((line) => ({
      line,
      height: 20,
      start: 0,
      end: line.text.length,
      continued: false,
    }));
    const zones = templateZones(
      pieces,
      { ...doc.settings, top: 30, left: 42, right: 42 },
      794,
      (line) => (line.kind === "section" ? { dx: 2, dy: 3 } : {}),
    );
    expect(zones).toEqual([
      { role: "header", x: 42, y: 30, width: 710, height: 40 },
      { role: "section", x: 44, y: 73, width: 710, height: 20 },
      { role: "section", x: 44, y: 113, width: 710, height: 20 },
    ]);
  });
  it("rejects malformed region dimensions and keeps legacy templates supported", () => {
    const valid = template();
    expect(() =>
      readTemplateStyle({
        ...valid,
        regions: { header: Infinity, section: 30 },
      }),
    ).toThrow();
    expect(() =>
      readTemplateStyle({ ...valid, headerFrame: undefined }),
    ).toThrow();
    expect(() =>
      readTemplateStyle({
        ...valid,
        headerFrame: { x: 0, y: 0, width: 1e20, height: 84 },
      }),
    ).toThrow();
    expect(
      readTemplateStyle({
        ...valid,
        regions: undefined,
        headerFrame: undefined,
      }).regions,
    ).toBeUndefined();
  });
  it("preserves the justify toggle in backups while older drafts remain compatible", () => {
    const doc = initialResume();
    doc.settings.justify = true;
    expect(readResume(JSON.parse(JSON.stringify(doc))).settings.justify).toBe(
      true,
    );
    delete doc.settings.justify;
    expect(readResume(doc).settings.justify).toBeUndefined();
  });
});
