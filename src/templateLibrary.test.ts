// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  initialResume,
  applyTemplate,
  modules,
  parseMarkdown,
  insertModule,
  readResume,
} from "./flow";
import { blankFreePage } from "./freeform";
import { headerLines, lineDesign, readTemplateStyle } from "./templateStyle";
import {
  applyUserTemplate,
  loadUserTemplates,
  saveUserTemplate,
  removeUserTemplate,
  TEMPLATES_KEY,
} from "./templateLibrary";
import type { UserTemplate } from "./templateLibrary";

function example(): UserTemplate {
  const draft = initialResume("blank");
  draft.freeform = {
    version: 1,
    base: "flow",
    source: "",
    sourceDesign: {},
    pages: [blankFreePage()],
  };
  draft.freeform.pages[0].canvas.objects.push({
    type: "Line",
    left: 42,
    top: 110,
    x1: 0,
    x2: 700,
    y1: 0,
    y2: 0,
    stroke: "#7056a4",
    templateRole: "section",
  });
  return {
    version: 1,
    id: "test-template",
    name: "我的模板",
    drawings: draft.freeform,
    sectionFrame: { x: 42, y: 90, width: 710, height: 29 },
    slots: { section: { color: "#7056a4", fontSize: 18 } },
    settings: draft.settings,
    draft,
    updatedAt: 1,
  };
}

beforeEach(() => localStorage.clear());
describe("personal templates", () => {
  it("keeps real text, photos, canvas and independent header alignment when applying; backs up the complete style", () => {
    const doc = initialResume();
    doc.settings.headerAlign = "left";
    const before = structuredClone(doc),
      template = example();
    const next = applyUserTemplate(doc, template);
    expect(doc).toEqual(before);
    expect(next.lines).toEqual(before.lines);
    expect(next.pictures).toEqual(before.pictures);
    expect(next.freeform).toEqual(before.freeform);
    expect(next.settings.headerAlign).toBe("left");
    expect(readResume(JSON.parse(JSON.stringify(next))).templateStyle).toEqual(
      next.templateStyle,
    );
    expect(applyTemplate(next, "black").templateStyle).toBeUndefined();
    expect(applyTemplate(next, "black").lines).toEqual(doc.lines);
  });
  it("reuses section typography for new blocks, while retaining explicit per-line edits", () => {
    const doc = applyUserTemplate(initialResume(), example());
    const next = insertModule(doc, "个人评价", "内容");
    const line = next.lines.find((line) => line.text === "个人评价")!;
    expect(lineDesign(next, line)).toMatchObject({
      color: "#7056a4",
      fontSize: 18,
    });
    next.freeform!.sourceDesign = {
      ...next.freeform!.sourceDesign,
      [line.id]: { color: "#123456" },
    };
    expect(lineDesign(next, line).color).toBe("#123456");
  });
  it("stores newest first, edits the same template without duplicates, and survives reload and library deletion", () => {
    const template = example();
    saveUserTemplate(template);
    saveUserTemplate({ ...template, id: "second", name: "第二套" });
    saveUserTemplate({ ...template, name: "重新命名" });
    expect(loadUserTemplates().map((item) => item.id)).toEqual([
      "test-template",
      "second",
    ]);
    expect(loadUserTemplates()[0].name).toBe("重新命名");
    const resume = applyUserTemplate(initialResume(), loadUserTemplates()[0]);
    removeUserTemplate(template.id);
    expect(resume.templateStyle!.name).toBe("重新命名");
    expect(loadUserTemplates()).toHaveLength(1);
    localStorage.setItem(
      TEMPLATES_KEY,
      JSON.stringify([null, { version: 88 }, example()]),
    );
    expect(loadUserTemplates()).toHaveLength(1);
  });
  it("rejects remote images and unsupported versions before any drawing is loaded", () => {
    const template = example();
    expect(() => readTemplateStyle({ ...template, version: 2 })).toThrow();
    template.drawings.pages[0].canvas.objects.push({
      type: "Image",
      src: "https://example.com/private.png",
    });
    expect(() => saveUserTemplate(template)).toThrow();
    expect(localStorage.getItem(TEMPLATES_KEY)).toBeNull();
  });
});
describe("editable resume structures", () => {
  it("includes the whole personal header across empty lines, without affecting sections", () => {
    const lines = parseMarkdown(
      "# 姓名\n\n电话 | 邮箱\n个人主页\n\n## 教育背景\n正文",
    );
    expect(headerLines(lines).map((line) => line.text)).toEqual([
      "姓名",
      "电话 | 邮箱",
      "个人主页",
    ]);
  });
  it("education keeps tags with the school and puts dates last in both standard layouts", () => {
    const blocks = modules.find((item) => item.name === "教育背景")!.variants;
    const two = parseMarkdown(blocks[0].body),
      three = parseMarkdown(blocks[1].body);
    expect(two[0].text.split(" | ")).toHaveLength(2);
    expect(two[0].text).toContain("`985` `211` `双一流`");
    expect(two[1].text).toContain("计算机科学与技术");
    expect(three[0].text.split(" | ")).toHaveLength(3);
    expect(three[0].text.split(" | ").at(-1)).toContain("2025.06");
    expect(three[1].text).toContain("荣誉");
    for (const group of modules)
      for (const block of group.variants)
        expect(block.body).not.toContain("[填写");
  });
});
