import { Rect, Textbox, FabricImage, FabricObject } from "fabric";
import type { TextStyle } from "fabric";
import type { Resume } from "./flow";
import { blankFreePage, sourceFingerprint } from "./freeform";
import type { FreeDocument } from "./freeform";

FabricObject.customProperties = ["id", "label"];
const common = {
  originX: "left" as const,
  originY: "top" as const,
  strokeWidth: 0,
};

// Capture the existing rendered layout, retaining selectable text rather than a page image.
export async function captureFreeform(
  root: HTMLElement,
  doc: Resume,
): Promise<FreeDocument> {
  await document.fonts.ready;
  const papers = [...root.querySelectorAll<HTMLElement>(".resume-paper")];
  if (!papers.length) throw new Error("简历还在排版，请稍后再进入自由模式。");
  if (papers.length > 20)
    throw new Error("自由模式最多支持 20 页，请先精简板块稿或拆成多份简历。");
  const pages = [];
  for (const [index, paper] of papers.entries()) {
    const page = blankFreePage();
    const bounds = paper.getBoundingClientRect(),
      scale = bounds.width / 794;
    if (!scale) throw new Error("请先显示简历预览，再进入自由模式。");
    const objects: FabricObject[] = [];
    const add = (object: FabricObject, label: string) => {
      object.set({ id: crypto.randomUUID(), label } as object);
      objects.push(object);
    };
    for (const row of paper.querySelectorAll<HTMLElement>("[data-edit]")) {
      const rect = row.getBoundingClientRect(),
        css = getComputedStyle(row);
      const x = (rect.left - bounds.left) / scale,
        y = (rect.top - bounds.top) / scale;
      const w = rect.width / scale,
        h = rect.height / scale;
      if (
        css.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        css.backgroundColor !== "transparent"
      )
        add(
          new Rect({
            ...common,
            left: x,
            top: y,
            width: w,
            height: h,
            fill: css.backgroundColor,
          }),
          "标题底色",
        );
      if (parseFloat(css.borderBottomWidth))
        add(
          new Rect({
            ...common,
            left: x,
            top: y + h - parseFloat(css.borderBottomWidth),
            width: w,
            height: parseFloat(css.borderBottomWidth),
            fill: css.borderBottomColor,
          }),
          "分隔线",
        );
      if (parseFloat(css.borderLeftWidth))
        add(
          new Rect({
            ...common,
            left: x,
            top: y,
            width: parseFloat(css.borderLeftWidth),
            height: h,
            fill: css.borderLeftColor,
          }),
          "标题标记",
        );
      const cells = [
        ...row.querySelectorAll<HTMLElement>(":scope > .entry-cell"),
      ];
      for (const cell of cells.length ? cells : [row]) {
        const cellRect = cell.getBoundingClientRect(),
          cellCss = getComputedStyle(cell);
        let text = "",
          line = 0,
          char = 0;
        const styles: TextStyle = {};
        const walk = (node: Node) => {
          if (node instanceof HTMLBRElement) {
            text += "\n";
            line++;
            char = 0;
            return;
          }
          if (node.nodeType === Node.TEXT_NODE) {
            const style = getComputedStyle(node.parentElement!);
            for (const value of node.textContent || "") {
              text += value;
              if (value === "\n") {
                line++;
                char = 0;
                continue;
              }
              styles[line] ??= {};
              styles[line][char++] = {
                fontWeight: style.fontWeight,
                fontStyle: style.fontStyle === "italic" ? "italic" : "normal",
                fill: style.color,
                underline: /underline/.test(style.textDecorationLine),
                linethrough: /line-through/.test(style.textDecorationLine),
              };
            }
          } else node.childNodes.forEach(walk);
        };
        cell.childNodes.forEach(walk);
        if (!text.trim()) continue;
        const isBullet =
          row.classList.contains("row-bullet") ||
          row.classList.contains("row-ordered");
        const prefix =
          isBullet && !cells.length
            ? row.classList.contains("row-ordered")
              ? `${row.dataset.order || "1"}. `
              : "• "
            : "";
        const size = parseFloat(cellCss.fontSize) || 13;
        const lineHeight = parseFloat(cellCss.lineHeight) || size * 1.5;
        if (prefix)
          for (const key of Object.keys(styles))
            if (Number(key) === 0)
              styles[0] = Object.fromEntries(
                Object.entries(styles[0]).map(([c, s]) => [
                  Number(c) + prefix.length,
                  s,
                ]),
              );
        const tb = new Textbox(prefix + text, {
          ...common,
          left:
            (cellRect.left - bounds.left) / scale +
            parseFloat(cellCss.paddingLeft || "0"),
          top:
            (cellRect.top - bounds.top) / scale +
            parseFloat(cellCss.paddingTop || "0") +
            (lineHeight - size * 1.13) / 2,
          width: Math.max(
            20,
            cellRect.width / scale -
              parseFloat(cellCss.paddingLeft || "0") -
              parseFloat(cellCss.paddingRight || "0"),
          ),
          fontFamily: cellCss.fontFamily.split(",")[0].replaceAll('"', ""),
          fontSize: size,
          fontWeight: cellCss.fontWeight,
          fontStyle: cellCss.fontStyle === "italic" ? "italic" : "normal",
          fill: cellCss.color,
          lineHeight: lineHeight / (size * 1.13),
          textAlign:
            cellCss.textAlign === "center"
              ? "center"
              : cellCss.textAlign === "right"
                ? "right"
                : "left",
          splitByGrapheme: true,
          styles,
        });
        add(tb, text.trim().slice(0, 24));
      }
    }
    for (const p of doc.pictures.filter(
      (p) => Math.min(p.page, papers.length - 1) === index,
    )) {
      const img = await FabricImage.fromURL(p.src);
      img.set({
        ...common,
        left: p.x,
        top: p.y,
        scaleX: p.w / img.width,
        scaleY: p.h / img.height,
      });
      add(img, p.label);
    }
    page.canvas = {
      version: "7.4.0",
      objects: objects.map((o) => o.toObject()),
    };
    pages.push(page);
  }
  return { version: 1, source: sourceFingerprint(doc), pages };
}
