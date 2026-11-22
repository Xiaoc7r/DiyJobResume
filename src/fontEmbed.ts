import { boundedAsyncCache } from "./boundedCache";

const cachedFont = boundedAsyncCache<string>(
  96,
  8_000_000,
  (value) => value.length * 2,
);
let active = 0;
const waiting: (() => void)[] = [];
async function readFont(url: string) {
  if (active < 6) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("字体读取失败");
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } finally {
    clearTimeout(timeout);
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
function intersects(range: string, chars: number[]) {
  if (!range.trim()) return true;
  return range.split(",").some((part) => {
    const match = part.trim().match(/^U\+([\dA-F?]+)(?:-([\dA-F]+))?$/i);
    if (!match) return false;
    const lower = parseInt(match[1].replaceAll("?", "0"), 16),
      upper = parseInt(match[2] || match[1].replaceAll("?", "F"), 16);
    let start = 0,
      end = chars.length;
    while (start < end) {
      const middle = (start + end) >>> 1;
      if (chars[middle] < lower) start = middle + 1;
      else end = middle;
    }
    return start < chars.length && chars[start] <= upper;
  });
}

// Shared by exports and sampling. Keep empty HTML elements for CSS-generated
// content, but SVG geometry inherits no glyphs that would need font embedding.
export async function fontCss(element: HTMLElement) {
  const chars = [
    ...new Set(
      Array.from(element.textContent || "").map((c) => c.codePointAt(0)!),
    ),
  ].sort((a, b) => a - b);
  const families = new Set<string>();
  for (const node of [element, ...element.querySelectorAll("*")]) {
    if (
      node instanceof SVGElement &&
      !/^(text|tspan|textPath)$/i.test(node.localName)
    )
      continue;
    getComputedStyle(node)
      .fontFamily.split(",")
      .forEach((family) =>
        families.add(family.replaceAll(/["']/g, "").trim().toLowerCase()),
      );
  }
  const rules: { rule: CSSFontFaceRule; base: string }[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules)
        if (
          rule instanceof CSSFontFaceRule &&
          families.has(
            rule.style.fontFamily.replaceAll(/["']/g, "").toLowerCase(),
          ) &&
          intersects(rule.style.getPropertyValue("unicode-range"), chars)
        )
          rules.push({ rule, base: sheet.href || location.href });
    } catch {
      /* Only same-origin font rules are exported. */
    }
  }
  return (
    await Promise.all(
      rules.map(async ({ rule, base }) => {
        const source = rule.style.getPropertyValue("src"),
          match = source.match(/url\(["']?([^"')]+)["']?\)/);
        if (!match) return "";
        const url = new URL(match[1], base);
        if (url.origin !== location.origin) return "";
        return rule.cssText.replace(
          match[0],
          `url("${await cachedFont(url.href, () => readFont(url.href))}")`,
        );
      }),
    )
  ).join("\n");
}
