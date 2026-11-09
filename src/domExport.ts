import { toPng, toSvg } from "html-to-image";

const fontCache = new Map<string, Promise<string>>();
const dataUrl = (url: string) => {
  let pending = fontCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("字体读取失败");
        return r.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
      );
    fontCache.set(url, pending);
    pending.catch(() => fontCache.delete(url));
  }
  return pending;
};
function intersects(range: string, chars: number[]) {
  if (!range.trim()) return true;
  return range.split(",").some((part) => {
    const match = part.trim().match(/^U\+([\dA-F?]+)(?:-([\dA-F]+))?$/i);
    if (!match) return false;
    const lower = parseInt(match[1].replaceAll("?", "0"), 16),
      upper = parseInt(match[2] || match[1].replaceAll("?", "F"), 16);
    return chars.some((c) => c >= lower && c <= upper);
  });
}
// Embed only font subsets used by this page, rather than downloading every CJK font file.
async function fontCss(element: HTMLElement) {
  const chars = [
    ...new Set(
      Array.from(element.textContent || "").map((c) => c.codePointAt(0)!),
    ),
  ];
  const families = new Set(
    [...element.querySelectorAll("*"), element].flatMap((el) =>
      getComputedStyle(el)
        .fontFamily.split(",")
        .map((f) => f.replaceAll(/["']/g, "").trim().toLowerCase()),
    ),
  );
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
          `url("${await dataUrl(url.href)}")`,
        );
      }),
    )
  ).join("\n");
}
export async function exportPaper(element: HTMLElement, format: "png" | "svg") {
  await document.fonts.ready;
  const css = await fontCss(element);
  const options = {
    pixelRatio: 2,
    fontEmbedCSS: css,
    style: { transform: "none", position: "relative", left: "0", top: "0" },
    filter: (node: HTMLElement) =>
      !node.classList?.contains("moveable-control-box") &&
      !node.classList?.contains("picture-delete") &&
      !node.classList?.contains("picture-resize") &&
      !node.classList?.contains("picture-page"),
  };
  return format === "png" ? toPng(element, options) : toSvg(element, options);
}
