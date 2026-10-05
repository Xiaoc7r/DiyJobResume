import { parseMarkdown, toMarkdown } from "./flow";
import type { Kind, Line } from "./flow";
export type TextMark = "bold" | "italic" | "underline" | "strike" | "link";
export const validLink = (url: string) =>
  /^(https?:\/\/|mailto:)[^\s<>"']+$/i.test(url);
export function markMarkdown(
  source: string,
  start: number,
  end: number,
  mark: TextMark,
  url = "",
) {
  if (start === end) return { source, start, end };
  const wraps: Record<TextMark, [string, string]> = {
    bold: ["**", "**"],
    italic: ["*", "*"],
    underline: ["<u>", "</u>"],
    strike: ["~~", "~~"],
    link: ["[", `](${url})`],
  };
  if (mark === "link" && !validLink(url))
    throw new Error("请填写 https://、http:// 或 mailto: 开头的链接。");
  const [open, close] = wraps[mark],
    text = source.slice(start, end);
  if (
    source.slice(Math.max(0, start - open.length), start) === open &&
    source.slice(end, end + close.length) === close
  ) {
    return {
      source:
        source.slice(0, start - open.length) +
        text +
        source.slice(end + close.length),
      start: start - open.length,
      end: end - open.length,
    };
  }
  return {
    source: source.slice(0, start) + open + text + close + source.slice(end),
    start: start + open.length,
    end: end + open.length,
  };
}
export function changeMarkdownKind(
  source: string,
  start: number,
  end: number,
  kind: Kind,
) {
  const a = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const last = end > start && source[end - 1] === "\n" ? end - 1 : end;
  let b = source.indexOf("\n", last);
  if (b < 0) b = source.length;
  const changed = parseMarkdown(source.slice(a, b)).map((line, index) => ({
    ...line,
    kind,
    order: kind === "ordered" ? index + 1 : undefined,
  }));
  const text = toMarkdown(changed);
  return {
    source: source.slice(0, a) + text + source.slice(b),
    start: a,
    end: a + text.length,
  };
}
export function withColumns(line: Line, count: number): Line {
  const fields = line.text.split(" | ");
  // Reducing the number of columns joins surplus content rather than discarding it.
  if (fields.length > count)
    fields.splice(
      count - 1,
      fields.length - count + 1,
      fields.slice(count - 1).join(" · "),
    );
  while (fields.length < count) fields.push("");
  return {
    ...line,
    kind: count === 1 ? "text" : "entry",
    text: fields.join(" | "),
  };
}
