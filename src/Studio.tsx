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
import { SelectionTools, paragraphOptions } from "./SelectionTools";
import { withColumns } from "./formatting";
import { NumericInput, holdDrag } from "./interaction";

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
  onEnter,
  onSlash,
  onBackspace,
}: {
  line: Line;
  index: number;
  onChange: (value: string) => void;
  onFocus: () => void;
  onEnter: () => void;
  onSlash: () => void;
  onBackspace: () => void;
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
      data-simple={line.id}
      data-order={line.order || 1}
      className={`simple-input simple-${line.kind}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`${kindLabels[line.kind]} ${index + 1}`}
      onFocus={onFocus}
      onInput={flush}
      onKeyDown={(e) => {
        if (e.key === "/" && !line.text && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSlash();
          return;
        }
        if (
          e.key === "Backspace" &&
          !e.nativeEvent.isComposing &&
          (cursorOffset(e.currentTarget) === 0 ||
            !e.currentTarget.textContent) &&
          window.getSelection()?.isCollapsed
        ) {
          e.preventDefault();
          onBackspace();
          return;
        }
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          if (e.shiftKey) document.execCommand("insertLineBreak");
          else onEnter();
        }
      }}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        flush();
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
  onEnter,
  onRemove,
  onDrop,
  onMove,
  onBlur,
  ghost = false,
}: {
  piece: Piece;
  template: Template;
  contact: boolean;
  settings: Settings;
  selected: boolean;
  armed: boolean;
  onSelect: () => void;
  onChange: (text: string) => void;
  onEnter: () => void;
  onRemove: () => void;
  onDrop: (id: string) => void;
  onMove: (target: string) => void;
  onBlur: () => void;
  ghost?: boolean;
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
      className={`paper-row ${ghost ? "ghost-row" : ""} ${selected ? "selected" : ""} ${armed ? "armed" : ""}`}
      data-preview={ghost ? "true" : undefined}
      onPointerDown={(e) => {
        if (!ghost) holdDrag(e, piece.line.id, onMove);
      }}
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
      <div
        ref={el}
        data-edit={piece.line.id}
        data-order={piece.line.order || 1}
        data-part={piece.start}
        role="textbox"
        aria-label={`简历${kindLabels[piece.line.kind]}：${piece.line.text.slice(0, 25)}`}
        contentEditable={!ghost}
        suppressContentEditableWarning
        className={`flow-row row-${piece.line.kind} ${contact ? "row-contact" : ""} ${piece.continued ? "continued" : ""}`}
        style={rowStyle(piece.line, settings, piece.continued)}
        onFocus={onSelect}
        onClick={onSelect}
        onInput={flush}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          flush();
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
      <NumericInput
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
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
    [leftWidth, setLeftWidth] = useState(() =>
      Math.min(560, Math.max(420, window.innerWidth * 0.28)),
    ),
    [zoom, setZoom] = useState(0.75),
    [autoZoom, setAutoZoom] = useState(true),
    [modal, setModal] = useState<"type" | "help" | null>(null),
    [fileMenu, setFileMenu] = useState(false),
    [mobile, setMobile] = useState<"editor" | "preview" | "library">("preview");
  const [pages, setPages] = useState<Piece[][]>([[]]),
    [fontVersion, setFontVersion] = useState(0),
    [picSelection, setPicSelection] = useState(""),
    [imageKind, setImageKind] = useState("证件照");
  const [hovered, setHovered] = useState(""),
    [hoverGroup, setHoverGroup] = useState("");
  const [panelPosition, setPanelPosition] = useState({ x: 16, y: 82 });
  const pinnedPreview = useRef(false);
  const [preview, setPreview] = useState<{
    key: string;
    doc: Resume;
    ids: string[];
    label: string;
  } | null>(null);
  const [blockMenu, setBlockMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const view = preview?.doc ?? doc;
  const previewScroll = useRef<number | null>(null),
    previewReveal = useRef(false);
  const measureRef = useRef<HTMLDivElement>(null),
    workspace = useRef<HTMLDivElement>(null),
    mdRef = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    imageRef = useRef<HTMLInputElement>(null),
    editorRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ id: string; offset: number } | null>(null);
  const contactId = view.lines.find(
    (line, index) =>
      line.kind === "text" && view.lines[index - 1]?.kind === "name",
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
    pinnedPreview.current = false;
    setPreview(null);
    previewScroll.current = null;
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
    pinnedPreview.current = false;
    setPreview(null);
    previewScroll.current = null;
    const previous = ref.current;
    setFuture((f) => [previous, ...f]);
    setDoc(past.at(-1)!);
    ref.current = past.at(-1)!;
    setPast((p) => p.slice(0, -1));
    lastGroup.current = { key: "", time: 0 };
  };
  const redo = () => {
    if (!future.length) return;
    pinnedPreview.current = false;
    setPreview(null);
    previewScroll.current = null;
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
        setBlockMenu(null);
        cancelPreview();
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
    const s = view.settings;
    const measure = (line: Line, text: string, continued: boolean) => {
      node.className = `flow-row row-${line.kind} ${line.id === contactId ? "row-contact" : ""} ${continued ? "continued" : ""}`;
      node.dataset.order = String(line.order || 1);
      const st = rowStyle(line, s, continued);
      Object.assign(node.style, {
        fontSize: st.fontSize + "px",
        paddingTop: st.paddingTop + "px",
        paddingBottom: st.paddingBottom + "px",
        lineHeight: String(st.lineHeight),
      });
      node.innerHTML = lineHtml(line, text, view.template);
      return Math.ceil(node.getBoundingClientRect().height * 100) / 100 + 0.25;
    };
    const active = document.activeElement as HTMLElement;
    if (!preview && active?.dataset.edit) {
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
    setPages(paginate(view.lines, PAGE.height - s.top - s.bottom, measure));
  }, [
    view.lines,
    view.settings,
    view.template,
    fontVersion,
    headerContactHeight,
    contactId,
  ]);
  useLayoutEffect(() => {
    if (preview && previewReveal.current) {
      previewReveal.current = false;
      const ghost = workspace.current?.querySelector<HTMLElement>(
        '[data-preview="true"]',
      );
      if (ghost && workspace.current) {
        const host = workspace.current;
        host.scrollTop +=
          ghost.getBoundingClientRect().top -
          host.getBoundingClientRect().top -
          80;
      }
    }
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
  const addLine = (
    after: string,
    kind: Kind = "text",
    side: "simple" | "paper" = "paper",
    columns = 1,
  ) => {
    const lines = [...ref.current.lines],
      index = lines.findIndex((l) => l.id === after),
      line: Line = {
        id: uid(),
        kind,
        text: columns > 1 ? Array(columns).fill("").join(" | ") : "",
        ...(kind === "ordered"
          ? { order: (lines[index]?.order || 0) + 1 }
          : {}),
      };
    lines.splice(index + 1, 0, line);
    historyUpdate({ ...ref.current, lines });
    setSelected(line.id);
    setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          `[data-${side === "simple" ? "simple" : "edit"}="${line.id}"]`,
        )
        ?.focus();
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
    "--accent": view.settings.accent,
    "--ink": view.settings.color,
    "--header-contact-height": headerContactHeight + "px",
    "--header-align":
      view.settings.headerAlign === "template"
        ? view.template === "ribbon"
          ? "left"
          : "center"
        : view.settings.headerAlign,
    fontFamily: fonts[view.settings.font],
    color: view.settings.color,
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
  const sectionStart = (id: string) => {
    const lines = ref.current.lines;
    let index = lines.findIndex((l) => l.id === id);
    for (let i = index; i >= 0; i--)
      if (lines[i].kind === "section") return lines[i].id;
    return id;
  };
  const inHoveredGroup = (id: string) => {
    if (!hoverGroup) return false;
    const start = doc.lines.findIndex((l) => l.id === hoverGroup),
      at = doc.lines.findIndex((l) => l.id === id);
    return start >= 0 && at >= start && at < groupEnd(doc.lines, start);
  };
  const backspaceLine = (id: string) => {
    const lines = [...ref.current.lines],
      i = lines.findIndex((l) => l.id === id);
    if (i < 0) return;
    if (i === 0) {
      if (lines[i].kind !== "text") {
        lines[i] = { ...lines[i], kind: "text" };
        historyUpdate({ ...ref.current, lines });
      }
      return;
    }
    const previous = lines[i - 1],
      offset = previous.text.replace(/[*_~`]/g, "").length;
    lines[i - 1] = { ...previous, text: previous.text + lines[i].text };
    lines.splice(i, 1);
    historyUpdate({ ...ref.current, lines });
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-simple="${previous.id}"]`,
      );
      el?.focus();
      if (el) placeCursor(el, offset);
    });
  };
  const dragPanel = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement,
      startX = e.clientX,
      startY = e.clientY,
      base = panelPosition;
    el.setPointerCapture(e.pointerId);
    const move = (event: PointerEvent) =>
      setPanelPosition({
        x: Math.max(
          0,
          Math.min(window.innerWidth - 240, base.x + event.clientX - startX),
        ),
        y: Math.max(
          0,
          Math.min(window.innerHeight - 80, base.y + event.clientY - startY),
        ),
      });
    const end = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };
  const cancelPreview = () => {
    pinnedPreview.current = false;
    setPreview(null);
    previewReveal.current = false;
    const savedScroll = previewScroll.current;
    previewScroll.current = null;
    if (savedScroll !== null && workspace.current)
      workspace.current.scrollTop = savedScroll;
  };
  const leavePreview = () => {
    if (!pinnedPreview.current) cancelPreview();
  };
  const beginPreview = (
    key: string,
    next: Resume,
    label: string,
    ids?: string[],
  ) => {
    if (preview?.key === key || pinnedPreview.current) return;
    if (previewScroll.current === null)
      previewScroll.current = workspace.current?.scrollTop ?? 0;
    previewReveal.current = true;
    setPreview({
      key,
      doc: next,
      label,
      ids:
        ids ??
        next.lines
          .filter((l) => !doc.lines.some((old) => old.id === l.id))
          .map((l) => l.id),
    });
  };
  const previewModule = (name: string, body: string, label: string) =>
    beginPreview(
      name + label,
      insertModule(ref.current, name, body),
      `将在「${name}」末尾加入「${label}」`,
    );
  const confirmModule = (name: string, body: string, label: string) => {
    const next =
      preview?.key === name + label
        ? preview.doc
        : insertModule(ref.current, name, body);
    pinnedPreview.current = false;
    setPreview(null);
    previewScroll.current = null;
    previewReveal.current = false;
    historyUpdate(next);
    const added = next.lines.find(
      (l) => !doc.lines.some((old) => old.id === l.id),
    );
    if (added) {
      setSelected(added.id);
      setTimeout(() => locate(added.id), 50);
    }
  };
  const previewHeader = (align: "left" | "center") =>
    beginPreview(
      "header-" + align,
      { ...doc, settings: { ...doc.settings, headerAlign: align } },
      "预览表头" + (align === "left" ? "左对齐" : "居中"),
      doc.lines
        .filter((l) => l.kind === "name" || l.id === contactId)
        .map((l) => l.id),
    );
  const confirmHeader = (align: "left" | "center") => {
    pinnedPreview.current = false;
    setPreview(null);
    previewScroll.current = null;
    previewReveal.current = false;
    settings({ headerAlign: align });
  };
  const confirmPreview = () => {
    if (!preview) return;
    const next = preview.doc;
    previewScroll.current = null;
    previewReveal.current = false;
    setPreview(null);
    historyUpdate(next);
  };
  const openBlockMenu = (id: string) => {
    const el = editorRef.current?.querySelector<HTMLElement>(
        `[data-field="${id}"]`,
      ),
      rect = el?.getBoundingClientRect();
    setBlockMenu({
      id,
      x: rect?.left ?? 30,
      y: Math.min(window.innerHeight - 330, rect?.top ?? 120),
    });
  };
  const chooseBlock = (kind: Kind, columns = 1) => {
    if (!blockMenu) return;
    const line = doc.lines.find((l) => l.id === blockMenu.id);
    if (line && !line.text) {
      historyUpdate({
        ...doc,
        lines: doc.lines.map((l) =>
          l.id === line.id
            ? {
                ...l,
                kind,
                text: columns > 1 ? Array(columns).fill("").join(" | ") : "",
              }
            : l,
        ),
      });
      setTimeout(
        () =>
          document
            .querySelector<HTMLElement>(`[data-simple="${line.id}"]`)
            ?.focus(),
        30,
      );
    } else addLine(blockMenu.id, kind, "simple", columns);
    setBlockMenu(null);
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
            简历工坊<small>炒肉多，写简历。</small>
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
                    historyUpdate(initialResume(doc.template));
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
              cancelPreview();
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
              await document.fonts.ready;
              window.print();
            }}
          >
            <Download size={16} />
            导出 PDF
          </button>
        </div>
      </header>
      {notice && !/^已(加入|应用|载入|导入)/.test(notice) && (
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
              ? "直接输入 · 选中文字设置格式 · 空行输入 / 添加内容"
              : "选中文字设置格式 · 支持一级至六级标题与列表"}
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
                    className={`edit-field field-${line.kind} ${selected === line.id ? "active" : ""} ${hovered === line.id ? "hovered" : ""}`}
                    onMouseEnter={() => setHovered(line.id)}
                    onMouseLeave={() => setHovered("")}
                    onPointerDown={(e) =>
                      holdDrag(e, line.id, (target) =>
                        historyUpdate(moveGroup(ref.current, line.id, target)),
                      )
                    }
                  >
                    <div className="block-gutter">
                      <div>
                        <button
                          aria-label={`添加内容 ${index + 1}`}
                          title="选择要添加的内容"
                          onClick={() => openBlockMenu(line.id)}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                    <SimpleInput
                      line={line}
                      index={index}
                      onFocus={() => setSelected(line.id)}
                      onChange={(value) => updateLine(line.id, value)}
                      onEnter={() =>
                        addLine(
                          line.id,
                          ["bullet", "ordered"].includes(line.kind)
                            ? line.kind
                            : "text",
                          "simple",
                        )
                      }
                      onSlash={() => openBlockMenu(line.id)}
                      onBackspace={() => backspaceLine(line.id)}
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
          <div className="preview-spacer" />
          {preview && (
            <div className="preview-banner" role="status">
              <span>
                <b>插入预览</b> {preview.label}
                。单击固定预览，双击卡片直接加入。
              </span>
              <button onClick={confirmPreview}>确认应用</button>
              <button onClick={cancelPreview}>取消</button>
            </div>
          )}
          <div
            ref={workspace}
            onMouseMove={(e) => {
              const row = (e.target as HTMLElement).closest<HTMLElement>(
                "[data-line]",
              );
              setHoverGroup(row ? sectionStart(row.dataset.line!) : "");
            }}
            onMouseLeave={() => setHoverGroup("")}
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
                  className={`resume-paper template-${view.template}`}
                  data-page={page}
                  style={{
                    ...resumeStyle,
                    width: PAGE.width,
                    height: PAGE.height,
                    padding: `${view.settings.top}px ${view.settings.right}px ${view.settings.bottom}px ${view.settings.left}px`,
                    transform: `scale(${zoom})`,
                  }}
                >
                  {pieces.map((piece) => (
                    <Editable
                      key={piece.line.id + "-" + piece.start}
                      piece={piece}
                      template={view.template}
                      contact={piece.line.id === contactId}
                      settings={view.settings}
                      ghost={preview?.ids.includes(piece.line.id)}
                      selected={
                        selected === piece.line.id ||
                        hovered === piece.line.id ||
                        inHoveredGroup(piece.line.id)
                      }
                      armed={armed === piece.line.id}
                      onSelect={() => {
                        if (armed !== piece.line.id) setArmed("");
                        locate(piece.line.id);
                        setPicSelection("");
                      }}
                      onChange={(text) => updatePiece(piece, text)}
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
                          moveGroup(
                            ref.current,
                            sectionStart(piece.line.id),
                            sectionStart(target),
                          ),
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
                      <small>123 4567 8910 | xxiaocr@gmail.com</small>
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
                <button
                  className="custom-module"
                  onClick={() => {
                    historyUpdate(initialResume(doc.template));
                    setNotice("已载入当前模板示例，可撤销回到原稿。");
                  }}
                >
                  载入当前模板示例
                </button>
                <p className="library-note">
                  已改写的内容会保留。载入示例可重新开始，也可撤销。
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
                  <button
                    onMouseEnter={() => previewHeader("center")}
                    onFocus={() => previewHeader("center")}
                    onMouseLeave={leavePreview}
                    onClick={() => {
                      pinnedPreview.current = false;
                      previewHeader("center");
                      pinnedPreview.current = true;
                    }}
                    onDoubleClick={() => confirmHeader("center")}
                  >
                    <span>
                      <strong>姓名与联系方式居中</strong>
                      <small>保留内容，调整表头排列</small>
                    </span>
                    <Check size={15} />
                  </button>
                  <button
                    onMouseEnter={() => previewHeader("left")}
                    onFocus={() => previewHeader("left")}
                    onMouseLeave={leavePreview}
                    onClick={() => {
                      pinnedPreview.current = false;
                      previewHeader("left");
                      pinnedPreview.current = true;
                    }}
                    onDoubleClick={() => confirmHeader("left")}
                  >
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
                        onMouseEnter={() =>
                          previewModule(module.name, v.body, v.name)
                        }
                        onFocus={() =>
                          previewModule(module.name, v.body, v.name)
                        }
                        onMouseLeave={leavePreview}
                        onClick={() => {
                          pinnedPreview.current = false;
                          previewModule(module.name, v.body, v.name);
                          pinnedPreview.current = true;
                          if (window.innerWidth <= 900) setMobile("preview");
                        }}
                        onDoubleClick={() =>
                          confirmModule(module.name, v.body, v.name)
                        }
                        className={
                          preview?.key === module.name + v.name
                            ? "previewing"
                            : ""
                        }
                        title="单击固定预览 · 双击加入"
                      >
                        <span>
                          <strong>{v.name}</strong>
                          <small>
                            {module.name === "专业技能"
                              ? "同一风格，不同表达方式"
                              : `预览加入「${module.name}」末尾`}
                          </small>
                        </span>
                        <Plus size={16} />
                      </button>
                    ))}
                  </section>
                ))}
                <button
                  className="custom-module"
                  onMouseEnter={() =>
                    previewModule(
                      "自定义板块",
                      "填写你的补充经历。",
                      "自定义内容",
                    )
                  }
                  onFocus={() =>
                    previewModule(
                      "自定义板块",
                      "填写你的补充经历。",
                      "自定义内容",
                    )
                  }
                  onMouseLeave={leavePreview}
                  onClick={() => {
                    pinnedPreview.current = false;
                    previewModule(
                      "自定义板块",
                      "填写你的补充经历。",
                      "自定义内容",
                    );
                    pinnedPreview.current = true;
                    if (window.innerWidth <= 900) setMobile("preview");
                  }}
                  onDoubleClick={() =>
                    confirmModule(
                      "自定义板块",
                      "填写你的补充经历。",
                      "自定义内容",
                    )
                  }
                  title="单击固定预览 · 双击加入"
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
      <SelectionTools
        lines={doc.lines}
        onSource={(value, start, end) => {
          historyUpdate(
            { ...ref.current, lines: parseMarkdown(value, ref.current.lines) },
            "format",
          );
          requestAnimationFrame(() => {
            mdRef.current?.focus();
            mdRef.current?.setSelectionRange(start, end);
          });
        }}
        onKind={(ids, kind) => {
          let order = 0;
          historyUpdate({
            ...ref.current,
            lines: ref.current.lines.map((l) =>
              ids.includes(l.id)
                ? {
                    ...l,
                    kind,
                    ...(kind === "ordered" ? { order: ++order } : {}),
                  }
                : l,
            ),
          });
        }}
        onColumns={(id, count) =>
          historyUpdate({
            ...ref.current,
            lines: ref.current.lines.map((l) =>
              l.id === id ? withColumns(l, count) : l,
            ),
          })
        }
      />
      {blockMenu && (
        <>
          <div
            className="block-menu-dismiss"
            onPointerDown={() => setBlockMenu(null)}
          />
          <div
            className="block-menu"
            role="menu"
            aria-label="添加内容菜单"
            style={{ left: blockMenu.x, top: Math.max(90, blockMenu.y) }}
          >
            {paragraphOptions.map((p) => (
              <button
                key={p.kind}
                role="menuitem"
                onClick={() => chooseBlock(p.kind)}
              >
                {p.label}
              </button>
            ))}
            <button role="menuitem" onClick={() => chooseBlock("bullet")}>
              无序列表
            </button>
            <button role="menuitem" onClick={() => chooseBlock("ordered")}>
              有序列表
            </button>
            <button role="menuitem" onClick={() => chooseBlock("entry", 2)}>
              左右两栏
            </button>
            <button role="menuitem" onClick={() => chooseBlock("entry", 3)}>
              左 · 中 · 右三栏
            </button>
          </div>
        </>
      )}
      <div
        ref={measureRef}
        className={`measure-host template-${view.template}`}
        aria-hidden="true"
        style={{
          ...resumeStyle,
          width: PAGE.width - view.settings.left - view.settings.right,
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
        <div
          className={`modal-backdrop ${modal === "type" ? "type-backdrop" : ""}`}
          onClick={() => setModal(null)}
        >
          <section
            className={`modal ${modal === "type" ? "type-panel" : ""}`}
            style={
              modal === "type"
                ? {
                    left: Math.min(
                      panelPosition.x,
                      Math.max(
                        0,
                        window.innerWidth -
                          Math.min(390, window.innerWidth - 24) -
                          16,
                      ),
                    ),
                    top: Math.min(
                      panelPosition.y,
                      Math.max(0, window.innerHeight - 100),
                    ),
                  }
                : undefined
            }
            role="dialog"
            aria-modal="true"
            aria-label={modal === "type" ? "间距与字号" : "使用帮助"}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-heading"
              onPointerDown={modal === "type" ? dragPanel : undefined}
            >
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
                        <NumericInput
                          key={field}
                          label={`${kindLabels[k]}${field === "before" ? "上间距" : field === "after" ? "下间距" : "字号"}`}
                          value={doc.settings.types[k][field]}
                          min={field === "size" ? 1 : 0}
                          max={field === "size" ? 300 : 40}
                          step={field === "size" ? 0.5 : 1}
                          onChange={(n) =>
                            settings({
                              types: {
                                ...doc.settings.types,
                                [k]: { ...doc.settings.types[k], [field]: n },
                              },
                            })
                          }
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
                  右侧六套模板可直接使用。拼接内容只选择经历的组织方式，自动继承当前风格。
                </p>
                <p>
                  <b>3. 纸上编辑：</b>单击文字输入，Enter
                  添加下一段，Shift+Enter
                  段内换行。长按后拖到另一板块之前；纸上拖动会带上板块内的内容。
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
