// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { inline, editableText } from "./render";
import { colorMarkdown, colorRichRange } from "./inlineColor";
import { parseMarkdown, defaultSettings } from "./flow";
import { rowMeasurements } from "./paperLayout";
import { boundedCache } from "./boundedCache";
import { revealRadius } from "./useAppearance";

describe("explicit text color", () => {
  it("round trips color, emphasis and links without permitting arbitrary HTML or CSS", () => {
    const source =
      '<span style="color:#123456">**加粗**与[主页](https://example.com)</span>';
    const host = document.createElement("div");
    host.innerHTML = inline(source);
    expect(host.querySelector("a")!.style.getPropertyPriority("color")).toBe(
      "important",
    );
    expect(host.querySelector("a")!.style.color).toBe("rgb(18, 52, 86)");
    expect(editableText(host)).toBe(source);
    expect(
      inline('<span style="color:red;position:fixed">文字</span>'),
    ).toContain("&lt;span");
    expect(
      inline('<span style="color:#000" onclick="alert(1)">文字</span>'),
    ).not.toContain("<span style=");
    expect(
      inline('<span style="color:#000">[x](javascript:alert(1))</span>'),
    ).not.toContain('href="javascript');
    expect(() =>
      inline(
        '<span style="color:#000">'.repeat(100) +
          "文字" +
          "</span>".repeat(100),
      ),
    ).not.toThrow();
  });
  it("preserves heading, list and column structure and replaces repeated color changes", () => {
    const source = "# 姓名\n## 教育背景\n### 学校 | 专业 | 时间\n- 要点";
    const result = colorMarkdown(source, 0, source.length, "#123");
    expect(parseMarkdown(result.source).map((line) => line.kind)).toEqual(
      parseMarkdown(source).map((line) => line.kind),
    );
    expect(parseMarkdown(result.source)[2].text.split(" | ")).toHaveLength(3);
    const first = colorMarkdown("甲乙丙", 1, 2, "#000000");
    const second = colorMarkdown(
      first.source,
      first.start,
      first.end,
      "#0000ff",
    );
    expect(second.source.match(/<span /g)).toHaveLength(1);
    expect(inline(second.source)).toContain("#0000ff");
    const whole = colorMarkdown(
      second.source,
      0,
      second.source.length,
      "#ff0000",
    );
    expect(whole.source.match(/<span /g)).toHaveLength(1);
    expect(inline(whole.source)).not.toContain("#0000ff");
    const link = "[主页](https://example.com)";
    const recolored = colorMarkdown(
      link,
      link.indexOf("https"),
      link.length - 1,
      "#000000",
    );
    expect(inline(recolored.source)).toContain('href="https://example.com"');
  });
  it("colors a cross-row range without reparenting rows and retains text on recoloring", () => {
    const host = document.createElement("div");
    host.className = "simple-editor";
    host.innerHTML =
      '<div data-simple="a">甲乙丙</div><div data-simple="b"><a href="https://example.com">丁戊己</a></div>';
    document.body.append(host);
    const rows = [...host.children];
    const range = document.createRange();
    range.setStart(rows[0].firstChild!, 1);
    range.setEnd(rows[1].firstChild!.firstChild!, 2);
    const result = colorRichRange(host, range, "#0000ff")!;
    const again = colorRichRange(host, result.range, "#171717")!;
    expect(again.rows).toHaveLength(2);
    expect(host.children).toHaveLength(2);
    expect(host.textContent).toBe("甲乙丙丁戊己");
    expect(host.querySelectorAll(".inline-color")).toHaveLength(2);
    expect(editableText(rows[1] as HTMLElement)).toContain(
      "https://example.com",
    );
    host.remove();
  });
});
describe("bounded measurement and rendering infrastructure", () => {
  it("reuses unchanged row measurements and invalidates appearance, text, and overrides", () => {
    const cache = rowMeasurements(),
      settings = defaultSettings(),
      row = parseMarkdown("正文")[0],
      node = document.createElement("div");
    const spy = vi
      .spyOn(node, "getBoundingClientRect")
      .mockReturnValue({ height: 24 } as DOMRect);
    document.body.append(node);
    cache.prepare([settings, 700, 0]);
    expect(
      cache.measure(node, settings, "blue", false, row, row.text, false),
    ).toBe(24);
    cache.measure(node, settings, "blue", false, row, row.text, false);
    expect(spy).toHaveBeenCalledTimes(1);
    cache.measure(node, settings, "blue", false, row, "新文字", false);
    cache.measure(node, settings, "blue", false, row, row.text, false, {
      fontSize: 18,
    });
    expect(spy).toHaveBeenCalledTimes(3);
    cache.prepare([settings, 400, 1]);
    cache.measure(node, settings, "blue", false, row, row.text, false);
    expect(spy).toHaveBeenCalledTimes(4);
    node.remove();
  });
  it("bounds caches by entries and bytes and never caches oversized input", () => {
    const cache = boundedCache<string>(2, 30);
    cache.set("a", "x", 1);
    cache.set("b", "y", 1);
    cache.get("a");
    cache.set("c", "z", 1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("x");
    cache.set("long".repeat(100), "large", 100);
    expect(cache.get("a")).toBe("x");
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
  });
  it("the circular reveal covers every corner from any button position", () => {
    for (const [x, y] of [
      [0, 0],
      [1300, 32],
      [195, 70],
      [900, 600],
    ]) {
      const radius = revealRadius(x, y, 1800, 1200);
      for (const [cx, cy] of [
        [0, 0],
        [1800, 0],
        [0, 1200],
        [1800, 1200],
      ])
        expect(Math.hypot(x - cx, y - cy)).toBeLessThan(radius);
    }
  });
});
