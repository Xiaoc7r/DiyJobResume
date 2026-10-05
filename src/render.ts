import type { Line, Settings, Template } from "./flow";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function inline(s: string): string {
  const pattern =
    /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g;
  let out = "",
    last = 0;
  for (const m of s.matchAll(pattern)) {
    out += escapeHtml(s.slice(last, m.index));
    out += m[1]
      ? `<strong>${escapeHtml(m[1])}</strong>`
      : m[2]
        ? `<em>${escapeHtml(m[2])}</em>`
        : m[3]
          ? `<code>${escapeHtml(m[3])}</code>`
          : `<a href="${escapeHtml(m[5])}" target="_blank" rel="noopener noreferrer">${escapeHtml(m[4])}</a>`;
    last = m.index! + m[0].length;
  }
  return out + escapeHtml(s.slice(last)).replace(/\n/g, "<br>");
}
export function lineHtml(
  line: Line,
  text = line.text,
  template: Template = "blue",
) {
  const fields = text.split(" | "),
    left = fields[0].split(" · ");
  if (
    line.kind === "entry" &&
    template !== "blue" &&
    fields.length === 2 &&
    left.length >= 2
  ) {
    return [fields[1], left[0], left.slice(1).join(" · ")]
      .map(
        (s) =>
          `<span class="entry-cell" data-original="two">${inline(s)}</span>`,
      )
      .join("");
  }
  if (line.kind === "entry" && text.includes(" | "))
    return text
      .split(" | ")
      .map((s) => `<span class="entry-cell">${inline(s)}</span>`)
      .join("");
  return `<span class="ink">${inline(text) || "<br>"}</span>`;
}
export function domMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (!(node instanceof HTMLElement)) return "";
  const content = Array.from(node.childNodes).map(domMarkdown).join("");
  switch (node.tagName) {
    case "BR":
      return "\n";
    case "B":
    case "STRONG":
      return "**" + content + "**";
    case "I":
    case "EM":
      return "*" + content + "*";
    case "CODE":
      return "`" + content + "`";
    case "A": {
      const href = node.getAttribute("href") || "";
      return /^(https?:\/\/|mailto:)/.test(href)
        ? `[${content}](${href})`
        : content;
    }
    case "DIV":
    case "P":
      return content + "\n";
    default:
      return content;
  }
}
export function editableText(el: HTMLElement) {
  const cells = el.querySelectorAll(":scope > .entry-cell");
  if (cells.length === 3 && cells[0].getAttribute("data-original") === "two") {
    const values = Array.from(cells).map((c) =>
      Array.from(c.childNodes).map(domMarkdown).join(""),
    );
    return values[1] + " · " + values[2] + " | " + values[0];
  }
  return cells.length
    ? Array.from(cells)
        .map((c) => Array.from(c.childNodes).map(domMarkdown).join(""))
        .join(" | ")
    : Array.from(el.childNodes).map(domMarkdown).join("").replace(/\n$/, "");
}
export const fonts = {
  sans: '"Noto Sans SC", sans-serif',
  serif: '"Noto Serif SC", serif',
  nunito: '"Nunito", "Noto Sans SC", sans-serif',
};
export function rowStyle(line: Line, s: Settings, continued = false) {
  const t = s.types[line.kind === "blank" ? "text" : line.kind];
  return {
    fontSize: t.size,
    paddingTop: continued ? 0 : t.before,
    paddingBottom: t.after,
    lineHeight: s.lineHeight,
  };
}
