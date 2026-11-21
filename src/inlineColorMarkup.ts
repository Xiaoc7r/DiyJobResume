import { normalizeHex } from "./color";

/** Flatten only matched, supported color tags; arbitrary HTML remains literal. */
export function rewriteColors(
  source: string,
  start = 0,
  end = 0,
  color?: string,
) {
  const stack: { at: number; tag: string; color: string | null }[] = [];
  const events = new Map<number, { length: number; color?: string }>();
  for (const match of source.matchAll(/<span\b[^>]*>|<\/span>/gi)) {
    if (match[0].toLowerCase() === "</span>") {
      const open = stack.pop();
      if (open?.color) {
        events.set(open.at, { length: open.tag.length, color: open.color });
        events.set(match.index!, { length: match[0].length });
      }
    } else {
      const hex =
        /^<span\s+style=["']color:\s*(#[a-f\d]{6}|#[a-f\d]{3});?["']\s*>$/i.exec(
          match[0],
        );
      stack.push({
        at: match.index!,
        tag: match[0],
        color: hex ? normalizeHex(hex[1]) : null,
      });
    }
  }
  const chars: string[] = [],
    colors: (string | undefined)[] = [],
    active: string[] = [];
  let a = -1,
    b = -1;
  for (let i = 0; i <= source.length; ) {
    if (a < 0 && i >= start) a = chars.length;
    if (b < 0 && i >= end) b = chars.length;
    if (i === source.length) break;
    const event = events.get(i);
    if (event) {
      if (event.color) active.push(event.color);
      else active.pop();
      i += event.length;
    } else {
      chars.push(source[i++]);
      colors.push(active.at(-1));
    }
  }
  if (color) colors.fill(color, Math.max(0, a), Math.max(0, b));
  const text = chars.join("");
  // Keep Markdown structure outside color spans, including entry column separators.
  for (const match of text.matchAll(
    /^(?:#{1,6}[ \t]+|[-*][ \t]+|\d+[.)][ \t]+)|\n| \| /gm,
  ))
    colors.fill(undefined, match.index!, match.index! + match[0].length);
  const output: string[] = [];
  let length = 0,
    first = -1,
    last = 0,
    previous: string | undefined;
  const append = (value: string) => {
    output.push(value);
    length += value.length;
  };
  for (let i = 0; i < chars.length; i++) {
    if (colors[i] !== previous) {
      if (previous) append("</span>");
      if (colors[i]) append(`<span style="color:${colors[i]}">`);
      previous = colors[i];
    }
    if (i >= a && i < b && (!color || colors[i] === color)) {
      if (first < 0) first = length;
      last = length + 1;
    }
    append(chars[i]);
  }
  if (previous) append("</span>");
  return {
    source: output.join(""),
    start: Math.max(0, first),
    end: Math.max(0, last),
  };
}
export const normalizeColorMarkup = (source: string) =>
  /<span\s+style=["']color:/i.test(source)
    ? rewriteColors(source).source
    : source;
