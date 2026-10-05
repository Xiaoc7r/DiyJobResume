import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  Undo2,
  Redo2,
  Download,
  Upload,
  SlidersHorizontal,
  ImagePlus,
  GraduationCap,
  X,
  Plus,
  Trash2,
  GripVertical,
  Check,
  ChevronDown,
  FileText,
  HelpCircle,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import {
  PAGE,
  STORAGE_KEY,
  OLD_KEY,
  initialResume,
  readResume,
  toMarkdown,
  parseMarkdown,
  templates,
  applyTemplate,
  modules,
  insertModule,
  kindLabels,
  uid,
  paginate,
  moveGroup,
  groupEnd,
} from "./flow";
import type {
  Resume,
  Line,
  Piece,
  Settings,
  Picture,
  Kind,
  Template,
} from "./flow";
import { lineHtml, editableText, fonts, rowStyle } from "./render";

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { doc: readResume(JSON.parse(saved)), notice: "" };
    const old = localStorage.getItem(OLD_KEY);
    if (old)
      return {
        doc: readResume(JSON.parse(old)),
        notice: "已迁移旧版文字与图片，原草稿仍保留。旧版自由色块不转入正文。",
      };
  } catch {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(STORAGE_KEY + ".recovery", raw);
    } catch {
      /* Keep autosave disabled below if storage is unavailable. */
    }
    return {
      doc: initialResume(),
      notice: "草稿读取失败，原始数据仍保留。请先导出旧稿或导入备份。",
    };
  }
  return { doc: initialResume(), notice: "" };
}
function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function cursorOffset(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !el.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString().length;
}
function placeCursor(el: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length || 0;
    if (offset <= len) {
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    offset -= len;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
function SimpleInput({
  line,
  index,
  onChange,
  onFocus,
}: {
  line: Line;
  index: number;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  const el = useRef<HTMLDivElement>(null),
    composing = useRef(false),
    html = lineHtml(line);
  useLayoutEffect(() => {
    if (
      el.current &&
      !composing.current &&
      editableText(el.current) !== line.text
    ) {
      const offset =
        document.activeElement === el.current ? cursorOffset(el.current) : null;
      el.current.innerHTML = html;
      if (offset !== null) placeCursor(el.current, offset);
    }
  }, [html, line.text]);
  const flush = () => {
    if (el.current && !composing.current) onChange(editableText(el.current));
  };
  return (
    <div
      ref={el}
      className={`simple-input simple-${line.kind}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`${kindLabels[line.kind]} ${index + 1}`}
      onFocus={onFocus}
      onInput={flush}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          document.execCommand("insertLineBreak");
        }
      }}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        flush();
      }}
      onBlur={() => {
        if (el.current) el.current.innerHTML = html;
      }}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand(
          "insertText",
          false,
          e.clipboardData.getData("text/plain"),
        );
      }}
    />
  );
}
function Editable({
  piece,
  template,
  contact,
  settings,
  selected,
  armed,
  onSelect,
  onChange,
  onArm,
  onEnter,
  onRemove,
  onDrop,
  onMove,
  onBlur,
}: {
  piece: Piece;
  template: Template;
  contact: boolean;
  settings: Settings;
  selected: boolean;
  armed: boolean;
  onSelect: () => void;
  onChange: (text: string) => void;
  onArm: () => void;
  onEnter: () => void;
  onRemove: () => void;
  onDrop: (id: string) => void;
  onMove: (target: string) => void;
  onBlur: () => void;
}) {
  const el = useRef<HTMLDivElement>(null),
    composing = useRef(false),
    html = lineHtml(
      piece.line,
      piece.line.text.slice(piece.start, piece.end),
      template,
    );
  useLayoutEffect(() => {
    if (el.current && !composing.current && el.current.innerHTML !== html) {
      const offset =
        document.activeElement === el.current ? cursorOffset(el.current) : null;
      el.current.innerHTML = html;
      if (offset !== null) placeCursor(el.current, offset);
    }
  }, [html, piece]);
  const flush = () => {
    if (el.current && !composing.current) onChange(editableText(el.current));
  };
  return (
    <div
      className={`paper-row ${selected ? "selected" : ""} ${armed ? "armed" : ""}`}
      data-line={piece.line.id}
      data-start={piece.start}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-resume-line")) {
          e.preventDefault();
          e.currentTarget.classList.add("drop-target");
        }
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-target")}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drop-target");
        onDrop(e.dataTransfer.getData("application/x-resume-line"));
      }}
    >
      {armed && (
        <div className="drag-actions">
          <button
            aria-label="拖动这段内容"
            title="拖到另一段之前；标题会连同所属内容一起移动"
            onPointerDown={(e) => {
              e.preventDefault();
              const handle = e.currentTarget;
              handle.setPointerCapture(e.pointerId);
              let target: HTMLElement | null = null;
              const move = (event: PointerEvent) => {
                target?.classList.remove("drop-target");
                target =
                  document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>(".paper-row") || null;
                if (target?.dataset.line !== piece.line.id)
                  target?.classList.add("drop-target");
              };
              const end = (event: PointerEvent) => {
                move(event);
                const id = target?.dataset.line;
                target?.classList.remove("drop-target");
                handle.removeEventListener("pointermove", move);
                if (id && id !== piece.line.id) onMove(id);
              };
              handle.addEventListener("pointermove", move);
              handle.addEventListener("pointerup", end, { once: true });
            }}
          >
            <GripVertical size={15} />
            拖动
          </button>
          <button aria-label="结束拖动" onClick={onBlur}>
            <Check size={15} />
          </button>
        </div>
      )}
      <div
        ref={el}
        data-edit={piece.line.id}
        data-part={piece.start}
        role="textbox"
        aria-label={`简历${kindLabels[piece.line.kind]}：${piece.line.text.slice(0, 25)}`}
        contentEditable={!armed}
        suppressContentEditableWarning
        className={`flow-row row-${piece.line.kind} ${contact ? "row-contact" : ""} ${piece.continued ? "continued" : ""}`}
        style={rowStyle(piece.line, settings, piece.continued)}
        onFocus={onSelect}
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.preventDefault();
          onArm();
          window.getSelection()?.removeAllRanges();
        }}
        onInput={flush}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          flush();
        }}
        onBlur={() => {
          if (el.current) el.current.innerHTML = html;
        }}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand(
            "insertText",
            false,
            e.clipboardData.getData("text/plain"),
          );
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onEnter();
          }
          if (e.key === "Backspace" && !e.currentTarget.textContent) {
            e.preventDefault();
            onRemove();
          }
          if (e.key === "Escape") {
            e.currentTarget.blur();
            onBlur();
          }
        }}
      />
    </div>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 150,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="number-label">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value !== "")
            onChange(Math.max(min, Math.min(max, Number(e.target.value))));
        }}
      />
    </label>
  );
}

export default function Studio() {
  const [initial] = useState(load),
    [doc, setDoc] = useState(initial.doc),
    ref = useRef(doc);
  ref.current = doc;
  const [past, setPast] = useState<Resume[]>([]),
    [future, setFuture] = useState<Resume[]>([]),
    lastGroup = useRef({ key: "", time: 0 });
  const [notice, setNotice] = useState(initial.notice),
    [saved, setSaved] = useState("已保存到本机"),
    [mode, setMode] = useState<"simple" | "md">("simple"),
    [tab, setTab] = useState<"templates" | "modules">("templates");
  const [selected, setSelected] = useState(""),
    [armed, setArmed] = useState(""),
    [leftWidth, setLeftWidth] = useState(360),
    [zoom, setZoom] = useState(0.75),
    [autoZoom, setAutoZoom] = useState(true),
    [modal, setModal] = useState<"type" | "help" | null>(null),
    [fileMenu, setFileMenu] = useState(false),
    [mobile, setMobile] = useState<"editor" | "preview" | "library">("preview");
  const [pages, setPages] = useState<Piece[][]>([[]]),
    [fontVersion, setFontVersion] = useState(0),
    [picSelection, setPicSelection] = useState(""),
    [imageKind, setImageKind] = useState("证件照");
  const measureRef = useRef<HTMLDivElement>(null),
    workspace = useRef<HTMLDivElement>(null),
    mdRef = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    imageRef = useRef<HTMLInputElement>(null),
    editorRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ id: string; offset: number } | null>(null);
  const contactId = doc.lines.find(
    (line, index) =>
      line.kind === "text" && doc.lines[index - 1]?.kind === "name",
  )?.id;
  const pictureBottom = Math.max(
    0,
    ...doc.pictures
      .filter((p) => p.page === 0 && p.y < 150)
      .map((p) => p.y + p.h + 8),
  );
  const nameType = doc.settings.types.name;
  const headerContactHeight = Math.max(
    0,
    pictureBottom -
      doc.settings.top -
      nameType.before -
      nameType.after -
      nameType.size * doc.settings.lineHeight,
  );
  const historyUpdate = (next: Resume, group = "") => {
    if (next === ref.current) return;
    const previous = ref.current;
    const now = Date.now();
    if (
      !group ||
      lastGroup.current.key !== group ||
      now - lastGroup.current.time > 900
    )
      setPast((p) => [...p, previous].slice(-60));
    lastGroup.current = { key: group, time: now };
    setFuture([]);
    ref.current = next;
    setDoc(next);
  };
  const updateLine = (id: string, text: string) => {
    const current = ref.current;
    if (current.lines.find((l) => l.id === id)?.text === text) return;
    historyUpdate(
      {
        ...current,
        lines: current.lines.map((l) => (l.id === id ? { ...l, text } : l)),
      },
      id,
    );
  };
  const undo = () => {
    if (!past.length) return;
    const previous = ref.current;
    setFuture((f) => [previous, ...f]);
    setDoc(past.at(-1)!);
    ref.current = past.at(-1)!;
    setPast((p) => p.slice(0, -1));
    lastGroup.current = { key: "", time: 0 };
  };
  const redo = () => {
    if (!future.length) return;
    const previous = ref.current;
    setPast((p) => [...p, previous]);
    setDoc(future[0]);
    ref.current = future[0];
    setFuture((f) => f.slice(1));
    lastGroup.current = { key: "", time: 0 };
  };
  const settings = (patch: Partial<Settings>) =>
    historyUpdate(
      { ...ref.current, settings: { ...ref.current.settings, ...patch } },
      "settings",
    );
  useEffect(() => {
    setSaved("保存中…");
    const save = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ref.current));
        setSaved("已保存到本机");
      } catch {
        setSaved("保存失败，请下载备份");
      }
    };
    const t = setTimeout(save, 400);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pagehide", save);
    };
  }, [doc]);
  useEffect(() => {
    const loaded = () => setFontVersion((n) => n + 1);
    document.fonts.ready.then(loaded);
    document.fonts.addEventListener("loadingdone", loaded);
    return () => document.fonts.removeEventListener("loadingdone", loaded);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === "Escape") {
        setModal(null);
        setArmed("");
        setPicSelection("");
        setFileMenu(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useLayoutEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    const node = document.createElement("div");
    host.replaceChildren(node);
    const s = doc.settings;
    const measure = (line: Line, text: string, continued: boolean) => {
      node.className = `flow-row row-${line.kind} ${line.id === contactId ? "row-contact" : ""} ${continued ? "continued" : ""}`;
      const st = rowStyle(line, s, continued);
      Object.assign(node.style, {
        fontSize: st.fontSize + "px",
        paddingTop: st.paddingTop + "px",
        paddingBottom: st.paddingBottom + "px",
        lineHeight: String(st.lineHeight),
      });
      node.innerHTML = lineHtml(line, text, doc.template);
      return Math.ceil(node.getBoundingClientRect().height * 100) / 100 + 0.25;
    };
    const active = document.activeElement as HTMLElement;
    if (active?.dataset.edit) {
      const offset = cursorOffset(active);
      if (offset !== null) {
        let total = offset;
        for (const part of document.querySelectorAll<HTMLElement>(
          "[data-edit]",
        )) {
          if (part === active) break;
          if (part.dataset.edit === active.dataset.edit)
            total += part.textContent?.length || 0;
        }
        pendingCaret.current = { id: active.dataset.edit, offset: total };
      }
    }
    setPages(paginate(doc.lines, PAGE.height - s.top - s.bottom, measure));
  }, [
    doc.lines,
    doc.settings,
    doc.template,
    fontVersion,
    headerContactHeight,
    contactId,
  ]);
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (!caret) return;
    pendingCaret.current = null;
    const parts = Array.from(
      document.querySelectorAll<HTMLElement>("[data-edit]"),
    ).filter((el) => el.dataset.edit === caret.id);
    let offset = caret.offset;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i],
        length = part.textContent?.length || 0;
      if (offset <= length || i === parts.length - 1) {
        part.focus({ preventScroll: true });
        placeCursor(part, Math.min(offset, length));
        break;
      }
      offset -= length;
    }
  }, [pages]);
  useLayoutEffect(() => {
    const el = workspace.current;
    if (!el) return;
    const fit = () => {
      if (autoZoom)
        setZoom(
          Math.max(0.25, Math.min(1, (el.clientWidth - 64) / PAGE.width)),
        );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoZoom, leftWidth, mobile]);
  const locate = (id: string) => {
    setSelected(id);
    if (mode === "simple") {
      const el = editorRef.current?.querySelector(`[data-field="${id}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      const index = ref.current.lines.findIndex((l) => l.id === id),
        start =
          toMarkdown(ref.current.lines.slice(0, index)).length +
          (index ? 1 : 0);
      const el = mdRef.current;
      if (el) {
        el.setSelectionRange(
          start,
          start + toMarkdown([ref.current.lines[index]]).length,
        );
        el.scrollTop = Math.max(0, index * 25 - el.clientHeight / 3);
      }
    }
  };
  const addLine = (after: string, kind: Kind = "text") => {
    const lines = [...ref.current.lines],
      index = lines.findIndex((l) => l.id === after),
      line = { id: uid(), kind, text: "" };
    lines.splice(index + 1, 0, line);
    historyUpdate({ ...ref.current, lines });
    setSelected(line.id);
    setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-edit="${line.id}"]`)?.focus();
    }, 50);
  };
  const removeLine = (id: string) => {
    historyUpdate({
      ...ref.current,
      lines: ref.current.lines.filter((l) => l.id !== id),
    });
    setArmed("");
  };
  const updatePiece = (piece: Piece, text: string) => {
    const line = ref.current.lines.find((l) => l.id === piece.line.id);
    if (line)
      updateLine(
        line.id,
        line.text.slice(0, piece.start) + text + line.text.slice(piece.end),
      );
  };
  const source = toMarkdown(doc.lines),
    currentTemplate = templates.find((t) => t.id === doc.template)!;
  const resumeStyle = {
    "--accent": doc.settings.accent,
    "--ink": doc.settings.color,
    "--header-contact-height": headerContactHeight + "px",
    "--header-align":
      doc.settings.headerAlign === "template"
        ? doc.template === "ribbon"
          ? "left"
          : "center"
        : doc.settings.headerAlign,
    fontFamily: fonts[doc.settings.font],
    color: doc.settings.color,
  } as CSSProperties;
  const resizeSidebar = (e: ReactPointerEvent) => {
    const start = e.clientX,
      width = leftWidth;
    e.currentTarget.setPointerCapture(e.pointerId);
    const target = e.currentTarget;
    const move = (event: PointerEvent) =>
      setLeftWidth(
        Math.max(
          260,
          Math.min(window.innerWidth * 0.6, width + event.clientX - start),
        ),
      );
    const end = () => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", end);
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", end, { once: true });
  };
  const dragPicture = (e: ReactPointerEvent, pic: Picture, resize = false) => {
    e.preventDefault();
    e.stopPropagation();
    setPicSelection(pic.id);
    const base = ref.current,
      startX = e.clientX,
      startY = e.clientY;
    setPast((p) => [...p, base].slice(-60));
    setFuture([]);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (event: PointerEvent) => {
      const dx = (event.clientX - startX) / zoom,
        dy = (event.clientY - startY) / zoom;
      const patch = resize
        ? {
            w: Math.max(24, Math.min(300, PAGE.width - pic.x, pic.w + dx)),
            h: Math.max(24, Math.min(300, PAGE.height - pic.y, pic.h + dy)),
          }
        : {
            x: Math.max(0, Math.min(PAGE.width - pic.w, pic.x + dx)),
            y: Math.max(0, Math.min(PAGE.height - pic.h, pic.y + dy)),
          };
      const next = {
        ...ref.current,
        pictures: ref.current.pictures.map((p) =>
          p.id === pic.id ? { ...p, ...patch } : p,
        ),
      };
      ref.current = next;
      setDoc(next);
    };
    const end = () => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", end);
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", end, { once: true });
  };
  const uploadImage = async (file: File) => {
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 1500000
      )
        throw new Error("请选择 1.5 MB 以内的 PNG、JPG 或 WebP 图片。");
      if (ref.current.pictures.length >= 10)
        throw new Error("一份简历最多放置 10 张图片。");
      const src = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const photo = imageKind === "证件照";
      historyUpdate({
        ...ref.current,
        pictures: [
          ...ref.current.pictures,
          {
            id: uid(),
            src,
            label: imageKind,
            page: 0,
            x: photo ? 670 : 42,
            y: 36,
            w: photo ? 72 : 60,
            h: photo ? 96 : 60,
          },
        ],
      });
      setNotice("图片已放到首页。拖动放置，右下角调整大小；选中后可删除。");
    } catch (e) {
      setNotice(String(e instanceof Error ? e.message : e));
    }
  };
  const deleteSection = (id: string) => {
    const start = doc.lines.findIndex((l) => l.id === id),
      end = groupEnd(doc.lines, start);
    historyUpdate({
      ...doc,
      lines: doc.lines.filter((_, i) => i < start || i >= end),
    });
  };
  const formatText = (command: "bold" | "italic") => {
    if (mode === "md") {
      const el = mdRef.current;
      if (!el) return;
      const a = el.selectionStart,
        b = el.selectionEnd,
        marker = command === "bold" ? "**" : "*",
        value =
          source.slice(0, a) +
          marker +
          (source.slice(a, b) || "文字") +
          marker +
          source.slice(b);
      historyUpdate(
        { ...doc, lines: parseMarkdown(value, doc.lines) },
        "markdown",
      );
      el.focus();
    } else {
      const anchor = window.getSelection()?.anchorNode;
      const element =
        anchor instanceof Element ? anchor : anchor?.parentElement;
      if (element?.closest('[contenteditable="true"]'))
        document.execCommand(command);
    }
  };
  return (
    <div
      className="studio"
      style={{ "--editor-width": leftWidth + "px" } as CSSProperties}
    >
      <header className="app-header">
        <a className="brand" href="./">
          <FileText size={23} />
          <span>
            简历工坊<small>把经历，写清楚。</small>
          </span>
        </a>
        <input
          className="document-name"
          aria-label="简历名称"
          value={doc.name}
          onChange={(e) =>
            historyUpdate({ ...doc, name: e.target.value }, "name")
          }
        />
        <span
          className={`save-state ${saved.includes("失败") ? "error" : ""}`}
          role="status"
        >
          {saved}
        </span>
        <div className="header-actions">
          <button
            className="icon-button"
            title="使用帮助"
            aria-label="使用帮助"
            onClick={() => setModal("help")}
          >
            <HelpCircle size={18} />
          </button>
          <div className="file-wrap">
            <button onClick={() => setFileMenu(!fileMenu)}>
              文件
              <ChevronDown size={13} />
            </button>
            {fileMenu && (
              <div className="file-menu">
                <button
                  onClick={() => {
                    saveFile(
                      doc.name + ".json",
                      JSON.stringify(doc, null, 2),
                      "application/json",
                    );
                    setFileMenu(false);
                  }}
                >
                  <Download size={15} />
                  下载可编辑备份
                </button>
                <button
                  onClick={() => {
                    saveFile(doc.name + ".md", source, "text/markdown");
                    setFileMenu(false);
                  }}
                >
                  <Download size={15} />
                  导出 Markdown
                </button>
                <button
                  onClick={() => {
                    historyUpdate(initialResume());
                    setFileMenu(false);
                    setNotice("已载入新版虚构示例，之前的草稿可撤销恢复。");
                  }}
                >
                  <FileText size={15} />
                  使用新版示例（可撤销）
                </button>
                <button
                  onClick={() => {
                    fileRef.current?.click();
                    setFileMenu(false);
                  }}
                >
                  <Upload size={15} />
                  导入备份 / Markdown
                </button>
              </div>
            )}
          </div>
          <button
            className="primary"
            onClick={async () => {
              (document.activeElement as HTMLElement)?.blur();
              await document.fonts.ready;
              window.print();
            }}
          >
            <Download size={16} />
            导出 PDF
          </button>
        </div>
      </header>
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <div className="workbench">
        <aside
          className={`editor-panel ${mobile === "editor" ? "mobile-active" : ""}`}
        >
          <div className="editor-heading">
            <div className="mode-tabs" role="tablist" aria-label="编辑方式">
              <button
                role="tab"
                aria-selected={mode === "simple"}
                onClick={() => setMode("simple")}
              >
                简单编辑
              </button>
              <button
                role="tab"
                aria-selected={mode === "md"}
                onClick={() => setMode("md")}
              >
                Markdown <span>.md</span>
              </button>
            </div>
            <div className="history-buttons">
              <button
                title="撤销 Ctrl+Z"
                aria-label="撤销"
                disabled={!past.length}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                title="重做 Ctrl+Shift+Z"
                aria-label="重做"
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
            </div>
          </div>
          <div className="editor-hint">
            {mode === "simple"
              ? "像写文档一样填写，右侧实时排版。"
              : "# 姓名　## 板块　### 经历　- 要点"}
          </div>
          <div className="text-tools">
            <button
              aria-label="加粗选中文字"
              title="选中文字后加粗"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatText("bold")}
            >
              <b>B</b>
            </button>
            <button
              aria-label="斜体选中文字"
              title="选中文字后设为斜体"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatText("italic")}
            >
              <i>I</i>
            </button>
            <span>
              {mode === "simple"
                ? "选中文字可直接设置强调"
                : "支持标题、列表、链接与标签"}
            </span>
          </div>
          {mode === "md" ? (
            <textarea
              ref={mdRef}
              className="markdown-editor"
              spellCheck={false}
              aria-label="Markdown 简历内容"
              value={source}
              onChange={(e) => {
                try {
                  historyUpdate(
                    { ...doc, lines: parseMarkdown(e.target.value, doc.lines) },
                    "markdown",
                  );
                } catch (err) {
                  setNotice((err as Error).message);
                }
              }}
            />
          ) : (
            <div ref={editorRef} className="simple-editor">
              {doc.lines
                .filter((l) => l.kind !== "blank")
                .map((line, index) => (
                  <div
                    key={line.id}
                    data-field={line.id}
                    className={`edit-field field-${line.kind} ${selected === line.id ? "active" : ""}`}
                  >
                    <div className="field-label">
                      <span>
                        {line.kind === "entry"
                          ? "经历信息 · 用 | 分成两列或三列"
                          : kindLabels[line.kind]}
                      </span>
                      <div>
                        <button
                          aria-label={`在此处添加要点 ${index + 1}`}
                          title="在后面添加一条"
                          onClick={() => addLine(line.id, "bullet")}
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          aria-label={`删除内容 ${index + 1}`}
                          title={
                            line.kind === "section"
                              ? "删除整个板块，可撤销"
                              : "删除这一行，可撤销"
                          }
                          onClick={() =>
                            line.kind === "section"
                              ? deleteSection(line.id)
                              : removeLine(line.id)
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <SimpleInput
                      line={line}
                      index={index}
                      onFocus={() => setSelected(line.id)}
                      onChange={(value) => updateLine(line.id, value)}
                    />
                  </div>
                ))}
              <button
                className="add-paragraph"
                onClick={() => {
                  const line = {
                    id: uid(),
                    kind: "text" as Kind,
                    text: "补充内容",
                  };
                  historyUpdate({ ...doc, lines: [...doc.lines, line] });
                }}
              >
                <Plus size={15} />
                添加一段内容
              </button>
            </div>
          )}
          <footer className="editor-footer">
            内容自动保存到本机 · 无需登录
          </footer>
        </aside>
        <div
          role="separator"
          aria-label="调整编辑区宽度"
          aria-orientation="vertical"
          aria-valuenow={Math.round(leftWidth)}
          tabIndex={0}
          className="panel-resizer"
          onPointerDown={resizeSidebar}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft")
              setLeftWidth((w) => Math.max(260, w - 20));
            if (e.key === "ArrowRight")
              setLeftWidth((w) => Math.min(window.innerWidth * 0.6, w + 20));
          }}
        >
          <GripVertical size={12} />
        </div>
        <main
          className={`preview-panel ${mobile === "preview" ? "mobile-active" : ""}`}
        >
          <div className="preview-toolbar">
            <div className="zoom-control">
              <span>预览大小</span>
              <input
                type="range"
                aria-label="预览缩放"
                min="25"
                max="140"
                value={Math.round(zoom * 100)}
                onChange={(e) => {
                  setAutoZoom(false);
                  setZoom(Number(e.target.value) / 100);
                }}
              />
              <button title="自动适应窗口" onClick={() => setAutoZoom(true)}>
                {Math.round(zoom * 100)}%
              </button>
              <span className="page-count">A4 · {pages.length} 页</span>
            </div>
            <div className="format-toolbar">
              <button
                title="间距与字号"
                aria-label="间距与字号"
                onClick={() => setModal("type")}
              >
                <SlidersHorizontal size={17} />
              </button>
              <label title="正文颜色" className="color-control">
                <span>正文</span>
                <input
                  type="color"
                  aria-label="正文颜色"
                  value={doc.settings.color}
                  onChange={(e) => settings({ color: e.target.value })}
                />
              </label>
              <label title="主题颜色" className="color-control">
                <span>主题</span>
                <input
                  type="color"
                  aria-label="主题颜色"
                  value={doc.settings.accent}
                  onChange={(e) => settings({ accent: e.target.value })}
                />
              </label>
              <i />
              <button
                title="上传证件照"
                aria-label="上传证件照"
                onClick={() => {
                  setImageKind("证件照");
                  imageRef.current?.click();
                }}
              >
                <ImagePlus size={17} />
              </button>
              <button
                title="上传校徽"
                aria-label="上传校徽"
                onClick={() => {
                  setImageKind("校徽");
                  imageRef.current?.click();
                }}
              >
                <GraduationCap size={19} />
              </button>
              <i />
              <NumberField
                label="上下"
                value={doc.settings.top}
                min={12}
                onChange={(n) => settings({ top: n, bottom: n })}
              />
              <NumberField
                label="左右"
                value={doc.settings.left}
                min={12}
                onChange={(n) => settings({ left: n, right: n })}
              />
              <select
                aria-label="简历字体"
                value={doc.settings.font}
                onChange={(e) =>
                  settings({ font: e.target.value as Settings["font"] })
                }
              >
                <option value="sans">Noto 黑体</option>
                <option value="serif">Noto 宋体</option>
                <option value="nunito">Nunito</option>
              </select>
            </div>
          </div>
          <div className="preview-guidance">
            单击文字直接写 · 双击显示拖动手柄 · 页数随内容自动增减
          </div>
          <div
            ref={workspace}
            className="paper-workspace"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setArmed("");
                setPicSelection("");
              }
            }}
          >
            {pages.map((pieces, page) => (
              <div
                className="page-frame"
                key={page}
                style={{ width: PAGE.width * zoom, height: PAGE.height * zoom }}
              >
                <span className="page-caption">第 {page + 1} 页</span>
                <article
                  className={`resume-paper template-${doc.template}`}
                  data-page={page}
                  style={{
                    ...resumeStyle,
                    width: PAGE.width,
                    height: PAGE.height,
                    padding: `${doc.settings.top}px ${doc.settings.right}px ${doc.settings.bottom}px ${doc.settings.left}px`,
                    transform: `scale(${zoom})`,
                  }}
                >
                  {pieces.map((piece) => (
                    <Editable
                      key={piece.line.id + "-" + piece.start}
                      piece={piece}
                      template={doc.template}
                      contact={piece.line.id === contactId}
                      settings={doc.settings}
                      selected={selected === piece.line.id}
                      armed={armed === piece.line.id}
                      onSelect={() => {
                        if (armed !== piece.line.id) setArmed("");
                        locate(piece.line.id);
                        setPicSelection("");
                      }}
                      onChange={(text) => updatePiece(piece, text)}
                      onArm={() => setArmed(piece.line.id)}
                      onEnter={() =>
                        addLine(
                          piece.line.id,
                          piece.line.kind === "bullet" ? "bullet" : "text",
                        )
                      }
                      onRemove={() => removeLine(piece.line.id)}
                      onDrop={(id) => {
                        if (id)
                          historyUpdate(
                            moveGroup(ref.current, id, piece.line.id),
                          );
                        setArmed("");
                      }}
                      onMove={(target) => {
                        historyUpdate(
                          moveGroup(ref.current, piece.line.id, target),
                        );
                        setArmed("");
                      }}
                      onBlur={() => setArmed("")}
                    />
                  ))}
                  {doc.pictures
                    .filter((p) => Math.min(p.page, pages.length - 1) === page)
                    .map((p) => (
                      <div
                        key={p.id}
                        className={`floating-picture ${picSelection === p.id ? "chosen" : ""}`}
                        style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
                        onPointerDown={(e) => dragPicture(e, p)}
                        tabIndex={0}
                        role="img"
                        aria-label={p.label + "，拖动调整位置"}
                        onKeyDown={(e) => {
                          if (e.key === "Delete") {
                            historyUpdate({
                              ...doc,
                              pictures: doc.pictures.filter(
                                (x) => x.id !== p.id,
                              ),
                            });
                          }
                          if (
                            [
                              "ArrowUp",
                              "ArrowDown",
                              "ArrowLeft",
                              "ArrowRight",
                            ].includes(e.key)
                          ) {
                            e.preventDefault();
                            historyUpdate(
                              {
                                ...doc,
                                pictures: doc.pictures.map((x) =>
                                  x.id === p.id
                                    ? {
                                        ...x,
                                        x: Math.max(
                                          0,
                                          Math.min(
                                            PAGE.width - x.w,
                                            x.x +
                                              (e.key === "ArrowLeft"
                                                ? -2
                                                : e.key === "ArrowRight"
                                                  ? 2
                                                  : 0),
                                          ),
                                        ),
                                        y: Math.max(
                                          0,
                                          Math.min(
                                            PAGE.height - x.h,
                                            x.y +
                                              (e.key === "ArrowUp"
                                                ? -2
                                                : e.key === "ArrowDown"
                                                  ? 2
                                                  : 0),
                                          ),
                                        ),
                                      }
                                    : x,
                                ),
                              },
                              "picture",
                            );
                          }
                        }}
                      >
                        <img src={p.src} alt={p.label} draggable={false} />
                        {picSelection === p.id && (
                          <>
                            <button
                              className="picture-delete"
                              aria-label={"删除" + p.label}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() =>
                                historyUpdate({
                                  ...doc,
                                  pictures: doc.pictures.filter(
                                    (x) => x.id !== p.id,
                                  ),
                                })
                              }
                            >
                              <X size={16} />
                            </button>
                            <button
                              className="picture-resize"
                              aria-label={"调整" + p.label + "大小"}
                              onPointerDown={(e) => dragPicture(e, p, true)}
                            />
                            <div
                              className="picture-page"
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <label>
                                页{" "}
                                <select
                                  aria-label="图片所在页"
                                  value={page}
                                  onChange={(e) =>
                                    historyUpdate({
                                      ...doc,
                                      pictures: doc.pictures.map((x) =>
                                        x.id === p.id
                                          ? {
                                              ...x,
                                              page: Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    })
                                  }
                                >
                                  {pages.map((_, i) => (
                                    <option value={i} key={i}>
                                      {i + 1}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </article>
              </div>
            ))}
            <div className="paper-end">内容写到哪里，纸张就延伸到哪里。</div>
          </div>
        </main>
        <aside
          className={`library-panel ${mobile === "library" ? "mobile-active" : ""}`}
        >
          <div className="library-heading">
            <h2>简历样式</h2>
            <p>先选统一风格，再补充你的经历。</p>
          </div>
          <div className="library-tabs" role="tablist" aria-label="模板与内容">
            <button
              role="tab"
              aria-selected={tab === "templates"}
              onClick={() => setTab("templates")}
            >
              整套模板
            </button>
            <button
              role="tab"
              aria-selected={tab === "modules"}
              onClick={() => setTab("modules")}
            >
              拼接内容
            </button>
          </div>
          <div className="library-scroll">
            {tab === "templates" ? (
              <>
                {templates.map((t) => (
                  <button
                    className={`template-card ${doc.template === t.id ? "active" : ""}`}
                    key={t.id}
                    aria-label={"使用" + t.name + "模板"}
                    onClick={() => historyUpdate(applyTemplate(doc, t.id))}
                  >
                    <div
                      className={`mini-paper mini-${t.id}`}
                      style={{ "--mini-accent": t.color } as CSSProperties}
                    >
                      <strong>炒肉多</strong>
                      <small>138 0000 2468 | xxiaocr@gmail.com</small>
                      {["教育背景", "实习经历", "项目经历", "专业技能"].map(
                        (s, i) => (
                          <div key={s}>
                            <b>{s}</b>
                            <span />
                            <span />
                            <span className={i === 1 ? "long" : ""} />
                          </div>
                        ),
                      )}
                    </div>
                    <div className="template-name">
                      {t.name}
                      {doc.template === t.id && <Check size={15} />}
                    </div>
                    <p>{t.desc}</p>
                  </button>
                ))}
                <p className="library-note">
                  切换模板只改变样式，已填写的内容会保留。
                </p>
              </>
            ) : (
              <>
                <div className="current-style">
                  <span style={{ background: doc.settings.accent }} />
                  {currentTemplate.name}
                  <small>所有新增内容沿用这套风格</small>
                </div>
                <section className="module-group">
                  <h3>个人信息 · 表头形式</h3>
                  <button onClick={() => settings({ headerAlign: "center" })}>
                    <span>
                      <strong>姓名与联系方式居中</strong>
                      <small>保留内容，调整表头排列</small>
                    </span>
                    <Check size={15} />
                  </button>
                  <button onClick={() => settings({ headerAlign: "left" })}>
                    <span>
                      <strong>姓名与联系方式左对齐</strong>
                      <small>与当前标题风格保持一致</small>
                    </span>
                    <Check size={15} />
                  </button>
                </section>
                {modules.map((module) => (
                  <section className="module-group" key={module.name}>
                    <h3>{module.name}</h3>
                    {module.variants.map((v) => (
                      <button
                        key={v.name}
                        onClick={() => {
                          const next = insertModule(doc, module.name, v.body);
                          historyUpdate(next);
                          const added = next.lines.find(
                            (l) => !doc.lines.some((old) => old.id === l.id),
                          );
                          if (added) {
                            setSelected(added.id);
                            setTimeout(() => locate(added.id), 50);
                          }
                          setNotice(
                            "已加入" + module.name + "，并沿用当前模板。",
                          );
                        }}
                      >
                        <span>
                          <strong>{v.name}</strong>
                          <small>
                            {module.name === "专业技能"
                              ? "同一风格，不同表达方式"
                              : "加入对应板块，不重复创建标题"}
                          </small>
                        </span>
                        <Plus size={16} />
                      </button>
                    ))}
                  </section>
                ))}
                <button
                  className="custom-module"
                  onClick={() =>
                    historyUpdate(
                      insertModule(doc, "自定义板块", "填写你的补充经历。"),
                    )
                  }
                >
                  <Plus size={15} />
                  添加自定义板块
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
      <nav className="mobile-nav">
        <button
          className={mobile === "editor" ? "active" : ""}
          onClick={() => setMobile("editor")}
        >
          <PanelLeft size={17} />
          编辑
        </button>
        <button
          className={mobile === "preview" ? "active" : ""}
          onClick={() => setMobile("preview")}
        >
          <FileText size={17} />
          简历
        </button>
        <button
          className={mobile === "library" ? "active" : ""}
          onClick={() => setMobile("library")}
        >
          <PanelRight size={17} />
          模板与内容
        </button>
      </nav>
      <div
        ref={measureRef}
        className={`measure-host template-${doc.template}`}
        aria-hidden="true"
        style={{
          ...resumeStyle,
          width: PAGE.width - doc.settings.left - doc.settings.right,
        }}
      />
      <input
        hidden
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadImage(f);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={fileRef}
        type="file"
        accept=".json,.md,.txt"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 22000000) throw new Error("文件过大。");
            const text = await file.text();
            const next = file.name.endsWith(".json")
              ? readResume(JSON.parse(text))
              : { ...doc, lines: parseMarkdown(text, doc.lines) };
            historyUpdate(next);
            setNotice("已导入，原来的内容可通过撤销恢复。");
          } catch (error) {
            setNotice((error as Error).message);
          }
        }}
      />
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "type" ? "间距与字号" : "使用帮助"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>
                  {modal === "type" ? "让排版恰到好处" : "写一份清晰的简历"}
                </h2>
                <p>
                  {modal === "type"
                    ? "整份简历统一调整，变化实时可见。单位：px"
                    : "内容为主，样式跟随。"}
                </p>
              </div>
              <button
                autoFocus
                aria-label="关闭窗口"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            {modal === "type" ? (
              <>
                <div className="type-grid">
                  <span>内容类型</span>
                  <span>上间距</span>
                  <span>下间距</span>
                  <span>字号</span>
                  {(
                    Object.keys(
                      doc.settings.types,
                    ) as (keyof Settings["types"])[]
                  ).map((k) => (
                    <div className="type-row" key={k}>
                      <strong>{kindLabels[k]}</strong>
                      {(["before", "after", "size"] as const).map((field) => (
                        <input
                          key={field}
                          type="number"
                          aria-label={`${kindLabels[k]}${field === "before" ? "上间距" : field === "after" ? "下间距" : "字号"}`}
                          value={doc.settings.types[k][field]}
                          min={field === "size" ? 10 : 0}
                          max={field === "size" ? 36 : 40}
                          onChange={(e) => {
                            if (e.target.value !== "")
                              settings({
                                types: {
                                  ...doc.settings.types,
                                  [k]: {
                                    ...doc.settings.types[k],
                                    [field]: Math.max(
                                      field === "size" ? 10 : 0,
                                      Math.min(
                                        field === "size" ? 36 : 40,
                                        Number(e.target.value),
                                      ),
                                    ),
                                  },
                                },
                              });
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="page-settings">
                  <NumberField
                    label="行距倍数"
                    value={doc.settings.lineHeight}
                    min={1.1}
                    max={2.2}
                    step={0.05}
                    onChange={(n) => settings({ lineHeight: n })}
                  />
                  {(["top", "bottom", "left", "right"] as const).map(
                    (key, i) => (
                      <NumberField
                        key={key}
                        label={
                          ["上页边距", "下页边距", "左页边距", "右页边距"][i]
                        }
                        value={doc.settings[key]}
                        min={12}
                        onChange={(n) => settings({ [key]: n })}
                      />
                    ),
                  )}
                </div>
                <button className="primary" onClick={() => setModal(null)}>
                  完成调整
                </button>
              </>
            ) : (
              <div className="help-body">
                <p>
                  <b>1. 写内容：</b>左侧简单编辑可直接填写；支持
                  **加粗**、*斜体*、`标签` 和
                  [链接](https://example.com)。专业用户可以切换 Markdown。
                </p>
                <p>
                  <b>2. 定风格：</b>
                  右侧三套模板分别对应蓝色细线、黑色横线、黑色标签。拼接内容只选择经历的组织方式，自动继承当前风格。
                </p>
                <p>
                  <b>3. 纸上编辑：</b>单击文字输入，Enter
                  添加下一段，Shift+Enter
                  段内换行。双击显示拖动手柄，拖到另一段之前；拖动标题会带上其所属内容。
                </p>
                <p>
                  <b>4. 自动分页：</b>
                  文字增加自动续页，减少后自动收页。长段落可跨页。空白行不产生空白页，用间距设置控制留白。
                </p>
                <p>
                  <b>5. 图片：</b>
                  上传照片或校徽后直接拖动，右下角调整尺寸。选中图片可删除或选择所在页，图片不挤占正文，放置后请检查遮挡。
                </p>
                <p>
                  <b>6. 导出：</b>打印窗口选择“另存为 PDF”，A4、100%
                  缩放、关闭页眉页脚，开启背景图形。重要版本请下载 JSON 备份。
                </p>
                <p className="muted">
                  Markdown
                  支持标题、段落、列表、两/三列经历、加粗、斜体、标签、链接；不执行
                  HTML，不支持任意 Markdown 表格或脚本。图片与样式保存在 JSON
                  备份中。
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
