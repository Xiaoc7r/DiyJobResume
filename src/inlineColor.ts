import { normalizeHex } from "./color";
import { rewriteColors } from "./inlineColorMarkup";

export const colorOpen = (hex: string) => `<span style="color:${hex}">`;
export function cssColorHex(value: string) {
  const hex = normalizeHex(value);
  if (hex) return hex;
  const rgb = /^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/i.exec(value);
  return rgb && rgb.slice(1).every((value) => +value <= 255)
    ? "#" +
        rgb
          .slice(1)
          .map((value) => (+value).toString(16).padStart(2, "0"))
          .join("")
    : null;
}
export function elementColor(element: HTMLElement) {
  return (
    normalizeHex(element.dataset.inlineColor || "") ||
    cssColorHex(element.style.color) ||
    (element.tagName === "FONT"
      ? normalizeHex(element.getAttribute("color") || "")
      : null)
  );
}

// Validated color is the only supported span attribute. No arbitrary HTML/CSS.
export function colorMarkdown(
  source: string,
  start: number,
  end: number,
  value: string,
) {
  const hex = normalizeHex(value);
  if (!hex) throw new Error("颜色格式不正确。");
  start = Math.max(0, Math.min(source.length, start));
  end = Math.max(start, Math.min(source.length, end));
  if (start === end) return { source, start, end };
  // A URL is metadata. Selecting its source colors the link, never its address.
  for (const match of source.matchAll(
    /\[[^\]\n]*\]\((?:https?:\/\/|mailto:)[^\s)]*\)/g,
  )) {
    const destination = match.index! + match[0].indexOf("](") + 2,
      close = match.index! + match[0].length;
    if (
      (start >= destination && start < close) ||
      (end > destination && end < close)
    ) {
      start = Math.min(start, match.index!);
      end = Math.max(end, close);
    }
  }
  return rewriteColors(source, start, end, hex);
}

// Split at row boundaries so formatting cannot reparent React-owned blocks.
export function colorRichRange(root: HTMLElement, range: Range, value: string) {
  const hex = normalizeHex(value);
  if (
    !hex ||
    !range.startContainer.isConnected ||
    !range.endContainer.isConnected
  )
    return null;
  const rows = root.classList.contains("simple-editor")
    ? [...root.querySelectorAll<HTMLElement>("[data-simple]")]
    : [root];
  const parts = rows
    .filter((row) => range.intersectsNode(row))
    .map((row) => {
      const part = document.createRange();
      part.selectNodeContents(row);
      if (row.contains(range.startContainer))
        part.setStart(range.startContainer, range.startOffset);
      if (row.contains(range.endContainer))
        part.setEnd(range.endContainer, range.endOffset);
      return { row, part };
    })
    .filter(({ part }) => !part.collapsed);
  const colored: HTMLElement[] = [];
  for (const { part } of parts.reverse()) {
    const span = document.createElement("span");
    span.className = "inline-color";
    span.dataset.inlineColor = hex;
    span.style.setProperty("color", hex, "important");
    span.append(part.extractContents());
    // Changing an already colored selection replaces its color, not an unbounded nest.
    span
      .querySelectorAll<HTMLElement>(".inline-color, font[color], [style]")
      .forEach((child) => {
        child.style.removeProperty("color");
        delete child.dataset.inlineColor;
        child.removeAttribute("color");
        child.classList.remove("inline-color");
      });
    span
      .querySelectorAll<HTMLElement>("a, code")
      .forEach((child) => child.style.setProperty("color", hex, "important"));
    part.insertNode(span);
    colored.unshift(span);
  }
  if (!colored.length) return null;
  const next = document.createRange();
  next.setStartBefore(colored[0]);
  next.setEndAfter(colored.at(-1)!);
  return { range: next, rows: parts.map((item) => item.row) };
}
