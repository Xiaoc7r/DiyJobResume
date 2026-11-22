import { memo, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { boundedCache } from "./boundedCache";
export const MarkdownNumbers = memo(function MarkdownNumbers({
  text,
  editor,
}: {
  text: string;
  editor: RefObject<HTMLTextAreaElement | null>;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const cache = useRef(boundedCache<number>(2048));
  const latest = useRef(text);
  latest.current = text;
  const measureCurrent = useRef<() => void>(() => {});
  const [layout, setLayout] = useState({ heights: [24], padding: 24 });
  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    let previous:
      | { text: string; context: string; padding: number }
      | undefined;
    const measure = () => {
      if (!el.clientWidth) return;
      const css = getComputedStyle(el);
      const context = `position:fixed;left:-100000px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:anywhere;width:${el.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)}px;font:${css.font};letter-spacing:${css.letterSpacing};tab-size:${css.tabSize}`;
      const source = latest.current,
        padding = parseFloat(css.paddingTop);
      // ResizeObserver's initial notification often follows the same text update.
      if (
        previous?.text === source &&
        previous.context === context &&
        previous.padding === padding
      )
        return;
      const mirror = document.createElement("div");
      mirror.style.cssText = context;
      const lines = source.split("\n"),
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
      if (missing.size) {
        document.body.append(mirror);
        try {
          missing.forEach((row, key) => {
            const height = row.getBoundingClientRect().height;
            resolved.set(key, height);
            cache.current.set(key, height);
          });
        } finally {
          mirror.remove();
        }
      }
      const heights = keys.map((key) => resolved.get(key)!);
      previous = { text: source, context, padding };
      setLayout((old) =>
        old.padding === padding &&
        old.heights.length === heights.length &&
        old.heights.every((height, i) => height === heights[i])
          ? old
          : { heights, padding },
      );
    };
    const scroll = () => {
      if (inner.current)
        inner.current.style.transform = `translateY(${-el.scrollTop}px)`;
    };
    measure();
    measureCurrent.current = measure;
    scroll();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const fontsChanged = () => {
      cache.current.clear();
      previous = undefined;
      measure();
    };
    document.fonts.addEventListener("loadingdone", fontsChanged);
    el.addEventListener("scroll", scroll);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fontsChanged);
      el.removeEventListener("scroll", scroll);
      measureCurrent.current = () => {};
    };
  }, [editor]);
  useEffect(() => {
    measureCurrent.current();
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
});
