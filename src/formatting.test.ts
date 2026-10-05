import { describe, it, expect } from "vitest";
import { markMarkdown, changeMarkdownKind, withColumns } from "./formatting";
import { inline, lineHtml } from "./render";
import {
  initialResume,
  applyTemplate,
  parseMarkdown,
  toMarkdown,
  readResume,
} from "./flow";
import { skillLines } from "./samples";
describe("selection formatting", () => {
  it("toggles marks while preserving selection and surrounding text", () => {
    for (const mark of ["bold", "italic", "underline", "strike"] as const) {
      const a = markMarkdown("甲乙丙丁", 1, 3, mark);
      expect(inline(a.source).replace(/<[^>]+>/g, "")).toBe("甲乙丙丁");
      expect(markMarkdown(a.source, a.start, a.end, mark).source).toBe(
        "甲乙丙丁",
      );
    }
  });
  it("renders nested emphasis, Chinese punctuation, underline and strike safely", () => {
    expect(inline("***重点***")).toContain("<strong>重点</strong>");
    expect(inline("**背景：**中文")).toBe("<strong>背景：</strong>中文");
    expect(inline("<u>**重点**</u> ~~删除~~")).toBe(
      "<u><strong>重点</strong></u> <s>删除</s>",
    );
    expect(inline("<u><img src=x onerror=alert(1)></u>")).not.toContain("<img");
  });
  it("adds safe links and rejects script URLs", () => {
    expect(
      inline(markMarkdown("网站", 0, 2, "link", "https://example.com").source),
    ).toContain('href="https://example.com"');
    expect(() =>
      markMarkdown("网站", 0, 2, "link", "javascript:alert(1)"),
    ).toThrow();
  });
  it("changes only the selected lines including h6 and ordered lists", () => {
    expect(changeMarkdownKind("标题\n内容\n末尾", 0, 2, "h6").source).toBe(
      "###### 标题\n内容\n末尾",
    );
    expect(changeMarkdownKind("标题\n内容\n末尾", 0, 6, "ordered").source).toBe(
      "1. 标题\n2. 内容\n末尾",
    );
    const source = "#### 四\n##### 五\n###### 六\n1. 甲\n2. 乙";
    expect(toMarkdown(parseMarkdown(source))).toBe(source);
  });
  it("keeps all column contents when reducing columns", () => {
    const l = parseMarkdown("### 公司 | 岗位 | 日期")[0];
    expect(withColumns(l, 2).text).toBe("公司 | 岗位 · 日期");
    expect(withColumns(l, 1).text).toBe("公司 · 岗位 · 日期");
    expect(lineHtml(l, undefined, "black").indexOf("公司")).toBeLessThan(
      lineHtml(l, undefined, "black").indexOf("日期"),
    );
  });
  it("accepts sub-10 and fractional font sizes through backups", () => {
    const d = initialResume();
    d.settings.types.text.size = 7.5;
    expect(readResume(d).settings.types.text.size).toBe(7.5);
  });
});
describe("requested examples", () => {
  for (const template of ["blue", "black", "ribbon"] as const)
    it(template + " uses the requested project and original skills", () => {
      const doc = initialResume(template),
        source = toMarkdown(doc.lines);
      expect(source).toContain(template === "black" ? "DoVideoAI" : "CityHub");
      expect(source).not.toContain(
        template === "black" ? "CityHub" : "DoVideoAI",
      );
      expect(source).toContain("github.com/Xiaoc7r");
      expect(source).toContain("xxiaocr@gmail.com");
      const start = doc.lines.findIndex(
        (l) => l.kind === "section" && l.text === "专业技能",
      );
      expect(
        doc.lines
          .slice(start + 1)
          .map((l) => inline(l.text).replace(/<[^>]+>/g, "")),
      ).toEqual(skillLines);
      expect(
        applyTemplate(initialResume(), template).lines.map((l) => l.text),
      ).toEqual(doc.lines.map((l) => l.text));
    });
});
