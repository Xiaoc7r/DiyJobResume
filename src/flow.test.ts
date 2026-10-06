import { describe, it, expect } from "vitest";
import {
  initialResume,
  parseMarkdown,
  toMarkdown,
  readResume,
  applyTemplate,
  insertModule,
  paginate,
  moveGroup,
} from "./flow";
import { inline } from "./render";
const measure = (_: unknown, text: string) =>
  Math.max(20, Math.ceil(text.length / 20) * 20);
describe("continuous document", () => {
  it("adds and removes pages solely from content", () => {
    const lines = parseMarkdown(
      Array.from({ length: 20 }, (_, i) => "- 第" + i + "项").join("\n"),
    );
    expect(paginate(lines, 100, measure)).toHaveLength(4);
    expect(paginate(lines.slice(0, 2), 100, measure)).toHaveLength(1);
    expect(paginate([], 100, measure)).toEqual([[]]);
  });
  it("splits a paragraph without losing or duplicating any text", () => {
    const text = "这是跨页段落😀".repeat(90),
      lines = parseMarkdown(text),
      pages = paginate(lines, 100, measure);
    expect(pages.length).toBeGreaterThan(3);
    expect(
      pages
        .flat()
        .map((p) => p.line.text.slice(p.start, p.end))
        .join(""),
    ).toBe(text);
    for (const page of pages)
      expect(page.reduce((n, p) => n + p.height, 0)).toBeLessThanOrEqual(100);
  });
  it("keeps a heading with the following short paragraph", () => {
    const lines = parseMarkdown("填充\n填充\n填充\n填充\n## 标题\n正文");
    const pages = paginate(lines, 100, measure);
    expect(pages[1].map((p) => p.line.text)).toEqual(["标题", "正文"]);
  });
  it("ignores blank lines for page count", () =>
    expect(paginate(parseMarkdown("\n".repeat(100)), 100, measure)).toEqual([
      [],
    ]));
  it("roundtrips the supported markdown without changing content", () => {
    const doc = initialResume();
    expect(toMarkdown(parseMarkdown(toMarkdown(doc.lines)))).toBe(
      toMarkdown(doc.lines),
    );
  });
  it("keeps stable line ids after an inserted source line", () => {
    const a = parseMarkdown("# 名字\n## 教育\n学校");
    const b = parseMarkdown("# 名字\n联系方式\n## 教育\n学校", a);
    expect(b[2].id).toBe(a[1].id);
    expect(b[3].id).toBe(a[2].id);
  });
  it("template changes preserve edited content and images", () => {
    const doc = initialResume();
    doc.lines[0].text = "自定义姓名";
    for (const template of ["blue", "black", "ribbon"] as const) {
      const next = applyTemplate(doc, template);
      expect(next.lines).toEqual(doc.lines);
      expect(next.pictures).toEqual(doc.pictures);
    }
  });
  it("adds an entry under its existing heading, inheriting global style", () => {
    const doc = initialResume(),
      next = insertModule(doc, "工作经历", "### 新公司 | 2025\n- 新职责");
    expect(
      next.lines.filter((l) => l.kind === "section" && l.text === "工作经历"),
    ).toHaveLength(1);
    expect(
      next.lines.findIndex((l) => l.text === "新公司 | 2025"),
    ).toBeLessThan(next.lines.findIndex((l) => l.text === "项目经历"));
    expect(next.settings).toEqual(doc.settings);
  });
  it("drags a section together with its contents", () => {
    const doc = initialResume();
    doc.lines = parseMarkdown("# 姓名\n## A\n### A1\nA正文\n## B\nB正文");
    const next = moveGroup(doc, doc.lines[4].id, doc.lines[1].id);
    expect(toMarkdown(next.lines)).toBe(
      "# 姓名\n## B\nB正文\n## A\n### A1\nA正文",
    );
  });
  it("migrates v1 without inventing manual pages", () => {
    const doc = readResume({
      version: 1,
      name: "旧简历",
      pages: 8,
      blocks: [
        { kind: "header", title: "旧名字", body: "旧邮箱", page: 0, y: 0 },
        { kind: "skills", title: "技能", body: "• Java", page: 6, y: 50 },
      ],
    });
    expect(toMarkdown(doc.lines)).toContain("# 旧名字");
    expect(toMarkdown(doc.lines)).toContain("- Java");
    expect("pages" in doc).toBe(false);
  });
  it("validates imports and clamps typography", () => {
    const d = initialResume();
    expect(() =>
      readResume({ version: 2, lines: [{ kind: "script", text: "x" }] }),
    ).toThrow();
    d.settings.top = -90;
    d.settings.types.text.size = 500;
    expect(readResume(d).settings.top).toBe(12);
    expect(readResume(d).settings.types.text.size).toBe(300);
  });
  it("roundtrips editable JSON backups", () => {
    const d = initialResume();
    expect(readResume(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it("renders inline formatting while escaping HTML and rejecting unsafe links", () => {
    expect(inline("**重点**")).toBe("<strong>重点</strong>");
    expect(inline("<img src=x onerror=alert(1)>")).toContain("&lt;img");
    expect(inline("[x](javascript:alert(1))")).not.toContain("<a");
  });
});
