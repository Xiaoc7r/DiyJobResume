import MarkdownIt from "markdown-it";
import type { Line, Settings, Template } from "./flow";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false });
markdown.disable("image");
markdown.validateLink = (href) =>
  /^(https?:\/\/|mailto:)[^\s<>"']+$/i.test(href);
// Chinese punctuation can border emphasis without an ASCII space.
markdown.inline.ruler.before("emphasis", "cjk_strong", (state, silent) => {
  if (
    state.src.slice(state.pos, state.pos + 2) !== "**" ||
    state.src[state.pos + 2] === "*"
  )
    return false;
  const end = state.src.indexOf("**", state.pos + 2);
  if (end < 0 || state.src[end + 2] === "*") return false;
  if (!silent) {
    const token = state.push("cjk_strong", "strong", 0);
    token.content = state.src.slice(state.pos + 2, end);
  }
  state.pos = end + 2;
  return true;
});
markdown.renderer.rules.cjk_strong = (tokens, index) =>
  "<strong>" + markdown.renderInline(tokens[index].content) + "</strong>";
markdown.inline.ruler.before(
  "html_inline",
  "safe_underline",
  (state, silent) => {
    if (state.src.slice(state.pos, state.pos + 3) !== "<u>") return false;
    const end = state.src.indexOf("</u>", state.pos + 3);
    if (end < 0) return false;
    if (!silent) {
      const token = state.push("safe_underline", "u", 0);
      token.content = state.src.slice(state.pos + 3, end);
    }
    state.pos = end + 4;
    return true;
  },
);
markdown.renderer.rules.safe_underline = (tokens, index) =>
  "<u>" + markdown.renderInline(tokens[index].content) + "</u>";
markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  tokens[index].attrSet("target", "_blank");
  tokens[index].attrSet("rel", "noopener noreferrer");
  return self.renderToken(tokens, index, options);
};
export function inline(s: string): string {
  return markdown.renderInline(s);
}
export function lineHtml(
  line: Line,
  text = line.text,
  _template: Template = "blue",
) {
  if (line.kind === "entry" && text.includes(" | ")) {
    const fields = text.split(" | ");
    return fields
      .map(
        (s, i) =>
          `<span class="entry-cell" data-placeholder="${i === 0 ? "左侧内容" : i === fields.length - 1 ? "右侧内容" : "中间内容"}">${inline(s) || "<br>"}</span>`,
      )
      .join("");
  }
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
    case "U":
      return "<u>" + content + "</u>";
    case "S":
    case "STRIKE":
    case "DEL":
      return "~~" + content + "~~";
    case "CODE":
      return "`" + content + "`";
    case "A": {
      const href = node.getAttribute("href") || "";
      return /^(https?:\/\/|mailto:)/i.test(href)
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
  return cells.length
    ? Array.from(cells)
        .map((c) =>
          Array.from(c.childNodes).map(domMarkdown).join("").replace(/\n$/, ""),
        )
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
