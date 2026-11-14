import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
export function MarkdownNumbers({
  text,
  editor,
}: {
  text: string;
  editor: RefObject<HTMLTextAreaElement | null>;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ heights: [24], padding: 24 });
  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    const measure = () => {
      if (!el.clientWidth) return;
      const css = getComputedStyle(el),
        mirror = document.createElement("div");
      mirror.style.cssText = `position:fixed;left:-100000px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:anywhere;width:${el.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)}px;font:${css.font};letter-spacing:${css.letterSpacing};tab-size:${css.tabSize}`;
      for (const line of text.split("\n")) {
        const row = document.createElement("div");
        row.textContent = line || "\u200b";
        mirror.append(row);
      }
      document.body.append(mirror);
      const heights = [...mirror.children].map(
        (row) => row.getBoundingClientRect().height,
      );
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
    document.fonts.addEventListener("loadingdone", measure);
    el.addEventListener("scroll", scroll);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
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
