import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  List,
  ListOrdered,
  Columns2,
  X,
} from "lucide-react";
import type { Kind, Line } from "./flow";
import { changeMarkdownKind, markMarkdown, validLink } from "./formatting";
import type { TextMark } from "./formatting";
export const paragraphOptions: { kind: Kind; label: string }[] = [
  { kind: "text", label: "正文" },
  { kind: "name", label: "一级标题" },
  { kind: "section", label: "二级标题" },
  { kind: "entry", label: "三级标题" },
  { kind: "h4", label: "四级标题" },
  { kind: "h5", label: "五级标题" },
  { kind: "h6", label: "六级标题" },
];
type Target =
  | {
      type: "md";
      element: HTMLTextAreaElement;
      start: number;
      end: number;
      ids: string[];
      x: number;
      y: number;
    }
  | {
      type: "rich";
      element: HTMLElement;
      range: Range;
      ids: string[];
      x: number;
      y: number;
    };
export function SelectionTools({
  lines,
  onSource,
  onKind,
  onColumns,
}: {
  lines: Line[];
  onSource: (source: string, start: number, end: number) => void;
  onKind: (ids: string[], kind: Kind) => void;
  onColumns: (id: string, count: number) => void;
}) {
  const [target, setTarget] = useState<Target | null>(null),
    saved = useRef<Target | null>(null),
    [linkOpen, setLinkOpen] = useState(false),
    [url, setUrl] = useState("https://"),
    [error, setError] = useState(""),
    [columns, setColumns] = useState(false);
  const refs = useRef({ lines, linkOpen });
  refs.current = { lines, linkOpen };
  useEffect(() => {
    const refresh = () => {
      if (
        refs.current.linkOpen ||
        document.activeElement?.closest(".selection-tools")
      )
        return;
      const active = document.activeElement;
      let next: Target | null = null;
      if (
        active instanceof HTMLTextAreaElement &&
        active.classList.contains("markdown-editor") &&
        active.selectionStart !== active.selectionEnd
      ) {
        const rect = active.getBoundingClientRect(),
          start = active.selectionStart,
          end = active.selectionEnd,
          first = active.value.slice(0, start).split("\n").length - 1,
          last = active.value.slice(0, end).split("\n").length - 1;
        next = {
          type: "md",
          element: active,
          start,
          end,
          ids: refs.current.lines.slice(first, last + 1).map((l) => l.id),
          x: rect.x + rect.width / 2,
          y: Math.max(
            rect.y + 8,
            Math.min(
              rect.bottom - 60,
              rect.y + (first + 1) * 25 - active.scrollTop,
            ),
          ),
        };
      } else {
        const selection = window.getSelection();
        if (selection?.rangeCount && !selection.isCollapsed) {
          const range = selection.getRangeAt(0),
            anchor =
              selection.anchorNode instanceof Element
                ? selection.anchorNode
                : selection.anchorNode?.parentElement,
            el = anchor?.closest<HTMLElement>("[data-simple],[data-edit]");
          if (el) {
            const selector = el.hasAttribute("data-simple")
                ? "[data-simple]"
                : "[data-edit]",
              idAttr = el.hasAttribute("data-simple") ? "simple" : "edit";
            const ids = Array.from(
              document.querySelectorAll<HTMLElement>(selector),
            )
              .filter((n) => range.intersectsNode(n))
              .map((n) => n.dataset[idAttr]!)
              .filter(Boolean);
            const rect = range.getBoundingClientRect();
            next = {
              type: "rich",
              element: el,
              range: range.cloneRange(),
              ids,
              x: rect.x + rect.width / 2,
              y: rect.y,
            };
          }
        }
      }
      saved.current = next;
      setTarget(next);
    };
    document.addEventListener("selectionchange", refresh);
    document.addEventListener("select", refresh, true);
    document.addEventListener("pointerup", refresh);
    const hide = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTarget(null);
        setLinkOpen(false);
      }
    };
    document.addEventListener("keydown", hide);
    return () => {
      document.removeEventListener("selectionchange", refresh);
      document.removeEventListener("select", refresh, true);
      document.removeEventListener("pointerup", refresh);
      document.removeEventListener("keydown", hide);
    };
  }, []);
  const sourceAction = (next: {
    source: string;
    start: number;
    end: number;
  }) => {
    onSource(next.source, next.start, next.end);
    setTarget(null);
  };
  const mark = (mark: TextMark, link = "") => {
    const t = saved.current;
    if (!t) return;
    if (t.type === "md")
      sourceAction(markMarkdown(t.element.value, t.start, t.end, mark, link));
    else {
      t.element.focus({ preventScroll: true });
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(t.range);
      document.execCommand(
        (
          {
            bold: "bold",
            italic: "italic",
            underline: "underline",
            strike: "strikeThrough",
            link: "createLink",
          } as const
        )[mark],
        false,
        mark === "link" ? link : undefined,
      );
    }
    setLinkOpen(false);
  };
  const changeKind = (kind: Kind) => {
    const t = saved.current;
    if (!t) return;
    if (t.type === "md")
      sourceAction(changeMarkdownKind(t.element.value, t.start, t.end, kind));
    else onKind(t.ids, kind);
    setTarget(null);
  };
  const current = lines.find((l) => l.id === target?.ids[0])?.kind || "text";
  return (
    <>
      {target && !linkOpen && (
        <div
          className="selection-tools"
          role="toolbar"
          aria-label="选中文字格式"
          style={{
            left: Math.max(
              8,
              Math.min(window.innerWidth - 540, target.x - 235),
            ),
            top: Math.max(70, Math.min(window.innerHeight - 70, target.y - 48)),
          }}
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLSelectElement)) e.preventDefault();
          }}
        >
          <select
            aria-label="文本类型"
            value={
              paragraphOptions.some((p) => p.kind === current)
                ? current
                : "text"
            }
            onChange={(e) => changeKind(e.target.value as Kind)}
          >
            {paragraphOptions.map((p) => (
              <option key={p.kind} value={p.kind}>
                {p.label}
              </option>
            ))}
          </select>
          <i />
          <button aria-label="加粗" title="加粗" onClick={() => mark("bold")}>
            <Bold size={16} />
          </button>
          <button aria-label="斜体" title="斜体" onClick={() => mark("italic")}>
            <Italic size={16} />
          </button>
          <button
            aria-label="下划线"
            title="下划线"
            onClick={() => mark("underline")}
          >
            <Underline size={16} />
          </button>
          <button
            aria-label="删除线"
            title="删除线"
            onClick={() => mark("strike")}
          >
            <Strikethrough size={16} />
          </button>
          <button
            aria-label="添加链接"
            title="添加链接"
            onClick={() => {
              setLinkOpen(true);
              setUrl("https://");
              setError("");
            }}
          >
            <Link2 size={16} />
          </button>
          <i />
          <button
            aria-label="有序列表"
            title="有序列表"
            onClick={() =>
              changeKind(current === "ordered" ? "text" : "ordered")
            }
          >
            <ListOrdered size={17} />
          </button>
          <button
            aria-label="无序列表"
            title="无序列表"
            onClick={() => changeKind(current === "bullet" ? "text" : "bullet")}
          >
            <List size={17} />
          </button>
          <div className="columns-action">
            <button
              aria-label="左右布局"
              title="左右布局"
              onClick={() => setColumns(!columns)}
            >
              <Columns2 size={17} />
            </button>
            {columns && (
              <div className="columns-menu">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      if (target.ids[0]) onColumns(target.ids[0], n);
                      setColumns(false);
                      setTarget(null);
                    }}
                  >
                    {n === 1
                      ? "普通段落"
                      : n === 2
                        ? "左右两栏"
                        : "左 · 中 · 右三栏"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {linkOpen && (
        <div className="modal-backdrop">
          <form
            className="modal link-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="添加链接"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validLink(url)) {
                setError("请输入有效的 http://、https:// 或 mailto: 链接。");
                return;
              }
              mark("link", url);
            }}
          >
            <div className="modal-heading">
              <h2>添加链接</h2>
              <button
                type="button"
                aria-label="关闭链接窗口"
                onClick={() => {
                  setLinkOpen(false);
                  setTarget(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <label>
              链接地址
              <input
                aria-label="链接地址"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="primary" type="submit">
              应用到选中文字
            </button>
          </form>
        </div>
      )}
    </>
  );
}
