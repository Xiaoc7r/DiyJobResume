// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { colorMarkdown, colorRichRange } from "./inlineColor";
import { normalizeColorMarkup } from "./inlineColorMarkup";
import { rangeOffsets, textRangeOf } from "./editorDom";
import { editableText, inline } from "./render";

describe("repeatable selection colors", () => {
  it("flattens legacy nested colors and keeps one tag across repeated recoloring", () => {
    let source =
      "# " +
      ["#111111", "#a88787", "#a58686", "#ffffff", "#7e5050", "#000000"]
        .map((color) => `<span style="color:${color}">`)
        .join("") +
      "示例姓名" +
      "</span>".repeat(6);
    source = normalizeColorMarkup(source);
    expect(source).toBe('# <span style="color:#000000">示例姓名</span>');
    let start = source.indexOf("示例姓名"),
      end = start + 4;
    for (const color of ["#f00", "#00f", "#203b63", "#171717"]) {
      const next = colorMarkdown(source, start, end, color);
      ({ source, start, end } = next);
      expect(source.match(/<span/g)).toHaveLength(1);
      expect(source.slice(start, end)).toBe("示例姓名");
    }
  });
  it("splits partial recoloring into adjacent colors without nesting or losing unselected text", () => {
    const source = '<span style="color:#ff0000">甲乙丙丁</span>';
    const at = source.indexOf("乙");
    const next = colorMarkdown(source, at, at + 2, "#0000ff");
    expect(next.source).toBe(
      '<span style="color:#ff0000">甲</span><span style="color:#0000ff">乙丙</span><span style="color:#ff0000">丁</span>',
    );
    const host = document.createElement("div");
    host.innerHTML = inline(next.source);
    expect(host.querySelectorAll(".inline-color .inline-color")).toHaveLength(
      0,
    );
    expect(host.textContent).toBe("甲乙丙丁");
  });
  it("restores a selection after editor nodes are replaced, including across rows", () => {
    const host = document.createElement("div");
    host.className = "simple-editor";
    host.innerHTML =
      '<p data-simple="a">甲乙丙</p><p data-simple="b">丁戊己</p>';
    document.body.append(host);
    const offsets = rangeOffsets(host, textRangeOf(host, 1, 5)!);
    for (const color of ["#ff0000", "#0000ff", "#171717"]) {
      const result = colorRichRange(
        host,
        textRangeOf(host, offsets.start, offsets.end)!,
        color,
      )!;
      for (const row of result.rows) row.innerHTML = inline(editableText(row));
      expect(textRangeOf(host, offsets.start, offsets.end)!.toString()).toBe(
        "乙丙丁戊",
      );
      expect(host.querySelectorAll(".inline-color .inline-color")).toHaveLength(
        0,
      );
      expect(
        [...host.querySelectorAll<HTMLElement>(".inline-color")].every(
          (e) => e.dataset.inlineColor === color,
        ),
      ).toBe(true);
    }
    host.remove();
  });
});
