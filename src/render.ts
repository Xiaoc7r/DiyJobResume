import MarkdownIt from "markdown-it";
import { boundedCache } from "./boundedCache";
import { colorOpen, elementColor } from "./inlineColor";
import { normalizeHex } from "./color";
import { normalizeColorMarkup } from "./inlineColorMarkup";
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
markdown.inline.ruler.before("html_inline", "safe_color", (state, silent) => {
  if (Number(state.env?.colorDepth || 0) >= 24) return false;
  const open =
    /^<span\s+style=["']color:\s*(#[a-f\d]{6}|#[a-f\d]{3});?["']\s*>/i.exec(
      state.src.slice(state.pos),
    );
  if (!open) return false;
  const tags = /<span\b[^>]*>|<\/span>/gi;
  tags.lastIndex = state.pos + open[0].length;
  let depth = 1,
    match: RegExpExecArray | null,
    end = -1;
  while ((match = tags.exec(state.src))) {
    depth += match[0].toLowerCase() === "</span>" ? -1 : 1;
    if (!depth) {
      end = match.index;
      break;
    }
  }
  if (end < 0) return false;
  if (!silent) {
    const token = state.push("safe_color", "span", 0);
    token.content = state.src.slice(state.pos + open[0].length, end);
    token.meta = { hex: normalizeHex(open[1]) };
  }
  state.pos = end + 7;
  return true;
});
markdown.renderer.rules.safe_color = (tokens, index, _options, env) => {
  const token = tokens[index],
    hex = token.meta!.hex as string;
  return `<span class="inline-color" data-inline-color="${hex}" style="color:${hex}!important">${markdown.renderInline(token.content, { inlineColor: hex, colorDepth: Number(env?.colorDepth || 0) + 1 })}</span>`;
};
for (const name of ["strong_open", "em_open", "s_open", "code_inline"]) {
  const original = markdown.renderer.rules[name];
  markdown.renderer.rules[name] = (tokens, index, options, env, self) => {
    const html = original
      ? original(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options);
    return env?.inlineColor
      ? html.replace(
          /^<\w+/,
          (tag) => tag + ` style="color:${env.inlineColor}!important"`,
        )
      : html;
  };
}
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
markdown.renderer.rules.cjk_strong = (tokens, index, _options, env) =>
  "<strong>" + markdown.renderInline(tokens[index].content, env) + "</strong>";
markdown.inline.ruler.before("emphasis", "cjk_italic", (state, silent) => {
  if (state.src[state.pos] !== "*" || state.src[state.pos + 1] === "*")
    return false;
  const end = state.src.indexOf("*", state.pos + 1);
  if (end < 0 || state.src[end + 1] === "*") return false;
  if (!silent) {
    const token = state.push("cjk_italic", "em", 0);
    token.content = state.src.slice(state.pos + 1, end);
  }
  state.pos = end + 1;
  return true;
});
markdown.renderer.rules.cjk_italic = (tokens, index, _options, env) =>
  "<em>" + markdown.renderInline(tokens[index].content, env) + "</em>";
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
markdown.renderer.rules.safe_underline = (tokens, index, _options, env) =>
  "<u>" + markdown.renderInline(tokens[index].content, env) + "</u>";
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet("target", "_blank");
  tokens[index].attrSet("rel", "noopener noreferrer");
  if (env?.inlineColor)
    tokens[index].attrSet("style", `color:${env.inlineColor}!important`);
  return self.renderToken(tokens, index, options);
};
const inlineCache = boundedCache<string>();
export function inline(s: string): string {
  const hit = inlineCache.get(s);
  if (hit !== undefined) return hit;
  const html = markdown.renderInline(s);
  inlineCache.set(s, html, html.length);
  return html;
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
  return `<span class="ink"${line.kind === "section" ? ` data-title="${escapeHtml(inline(text).replace(/<[^>]*>/g, ""))}"` : ""}>${inline(text) || "<br>"}</span>`;
}
export function domMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE)
    return (node.textContent || "").replaceAll("\u00a0", " ");
  if (!(node instanceof HTMLElement)) return "";
  const content = Array.from(node.childNodes).map(domMarkdown).join("");
  const color = ["SPAN", "FONT"].includes(node.tagName)
    ? elementColor(node)
    : null;
  if (color) return colorOpen(color) + content + "</span>";
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
      if (!content) return "";
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
  return normalizeColorMarkup(
    cells.length
      ? Array.from(cells)
          .map((c) =>
            Array.from(c.childNodes)
              .map(domMarkdown)
              .join("")
              .replace(/\n$/, ""),
          )
          .join(" | ")
      : Array.from(el.childNodes).map(domMarkdown).join("").replace(/\n$/, ""),
  );
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
