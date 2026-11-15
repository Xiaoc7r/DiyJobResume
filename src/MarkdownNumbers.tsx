import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { boundedCache } from "./boundedCache";
export function MarkdownNumbers({
  text,
  editor,
}: {
  text: string;
  editor: RefObject<HTMLTextAreaElement | null>;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const cache = useRef(boundedCache<number>(2048));
  const [layout, setLayout] = useState({ heights: [24], padding: 24 });
  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    const measure = () => {
      if (!el.clientWidth) return;
      const css = getComputedStyle(el),
        mirror = document.createElement("div");
      mirror.style.cssText = `position:fixed;left:-100000px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:anywhere;width:${el.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)}px;font:${css.font};letter-spacing:${css.letterSpacing};tab-size:${css.tabSize}`;
      const lines = text.split("\n"),
        keys = lines.map((line) =>
          JSON.stringify([mirror.style.cssText, line]),
        );
      const missing = new Map<string, HTMLElement>(),
        resolved = new Map<string, number>();
      lines.forEach((line, i) => {
        const hit = cache.current.get(keys[i]);
        if (hit !== undefined) {
          resolved.set(keys[i], hit);
          return;
        }
        if (missing.has(keys[i])) return;
        const row = document.createElement("div");
        row.textContent = line || "\u200b";
        mirror.append(row);
        missing.set(keys[i], row);
      });
      document.body.append(mirror);
      missing.forEach((row, key) => {
        const height = row.getBoundingClientRect().height;
        resolved.set(key, height);
        cache.current.set(key, height);
      });
      const heights = keys.map((key) => resolved.get(key)!);
      mirror.remove();
      setLayout({ heights, padding: parseFloat(css.paddingTop) });
    };
    const scroll = () => {
      if (inner.current)
        inner.current.style.transform = `translateY(${-el.scrollTop}px)`;
    };
    measure();
    scroll();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const fontsChanged = () => {
      cache.current.clear();
      measure();
    };
    document.fonts.addEventListener("loadingdone", fontsChanged);
    el.addEventListener("scroll", scroll);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fontsChanged);
      el.removeEventListener("scroll", scroll);
    };
  }, [text, editor]);
  return (
    <div className="markdown-numbers" aria-hidden="true">
      <div ref={inner} style={{ paddingTop: layout.padding }}>
        {layout.heights.map((height, i) => (
          <span key={i} style={{ height }}>
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
