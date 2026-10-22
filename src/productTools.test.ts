import { describe, expect, it } from "vitest";
import {
  initialResume,
  insertModule,
  modules,
  templates,
  applyTemplate,
} from "./flow";
import {
  activeDensity,
  applyDensity,
  checkContent,
  densities,
} from "./productTools";

describe("density presets", () => {
  it("preserves custom typography, horizontal margins and CSS; repeated application does not shrink", () => {
    const doc = initialResume();
    const original = structuredClone(doc);
    doc.settings.types.text.size = 9;
    doc.settings.left = 57;
    doc.settings.customCss = "p { color: red; }";
    for (const preset of densities) {
      const settings = applyDensity(doc.settings, preset.id);
      expect(settings.types.text.size).toBe(9);
      expect(settings.left).toBe(57);
      expect(settings.customCss).toBe(doc.settings.customCss);
      expect(applyDensity(settings, preset.id)).toEqual(settings);
      expect(activeDensity(settings)).toBe(preset.id);
    }
    expect(doc.lines).toEqual(original.lines);
  });
  it("recognizes manual spacing edits as custom", () => {
    const settings = applyDensity(initialResume().settings, "compact");
    settings.types.bullet.after = 6;
    expect(activeDensity(settings)).toBe("custom");
  });
});
describe("experience blocks and export checks", () => {
  it("adds complete experiences in every template without replacing the existing draft or duplicating internship headings", () => {
    for (const template of templates) {
      const doc = applyTemplate(initialResume(), template.id);
      for (const group of modules.filter((m) =>
        ["工作经历", "项目经历"].includes(m.name),
      )) {
        for (const block of group.variants) {
          const added = insertModule(doc, group.name, block.body);
          expect(
            added.lines.filter((l) => doc.lines.some((old) => old.id === l.id)),
          ).toEqual(doc.lines);
          expect(added.settings).toEqual(doc.settings);
          expect(added.template).toBe(doc.template);
          expect(added.lines.filter((l) => l.kind === "section").length).toBe(
            doc.lines.filter((l) => l.kind === "section").length,
          );
          expect(checkContent(added, 2).some((i) => i.lineId)).toBe(true);
        }
      }
    }
  });
  it("does not warn on the authorized example, checks empty text and off-page images", () => {
    const doc = initialResume();
    expect(checkContent(doc, 1)).toEqual([]);
    expect(checkContent({ ...doc, lines: [] }, 1)).toHaveLength(1);
    doc.pictures = [
      {
        id: "p",
        src: "data:image/png;base64,test",
        label: "证件照",
        x: 780,
        y: 0,
        w: 50,
        h: 50,
        page: 0,
      },
    ];
    expect(checkContent(doc, 1)[0].message).toContain("超出");
  });
});
