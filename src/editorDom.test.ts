// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { textRangeOf } from "./editorDom";
import { editableText } from "./render";
import { parseMarkdown, toMarkdown, initialResume, readResume } from "./flow";

describe("editing selection and whitespace regressions", () => {
  it("maps a range across short nested nodes without reusing the first node offset", () => {
    const el = document.createElement("div");
    el.innerHTML = "前缀 空格 <strong>重点</strong>字";
    const range = textRangeOf(el, 3, 9)!;
    expect(range.toString()).toBe("空格 重点字");
    expect(() => textRangeOf(el, 0, 900)).not.toThrow();
  });
  it("preserves indentation, trailing spaces and whitespace-only lines in Markdown", () => {
    const source = "#   炒肉多  \n   \n###   项目 | 时间";
    expect(toMarkdown(parseMarkdown(source))).toBe(source);
    const el = document.createElement("div");
    el.innerHTML = "<span>\u00a0 A\u00a0</span>";
    expect(editableText(el)).toBe("  A ");
  });
  it("keeps the restore baseline and small anchored icons in editable backups", () => {
    const doc = initialResume();
    doc.freeformBaseline = {
      settings: structuredClone(doc.settings),
      template: doc.template,
      pictures: structuredClone(doc.pictures),
    };
    const copy = readResume(JSON.parse(JSON.stringify(doc)));
    expect(copy.pictures).toEqual(doc.pictures);
    expect(copy.freeformBaseline).toEqual(doc.freeformBaseline);
    expect(copy.pictures.filter((p) => p.anchor)).toHaveLength(3);
  });
});
