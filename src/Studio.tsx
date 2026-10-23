import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  Code2,
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
  Sparkles,
  PanelLeft,
  PanelRight,
  FilePlus2,
  Copy,
  Trash2,
} from "lucide-react";
import {
  PAGE,
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
  moveGroupToBoundary,
  resolveDropBoundary,
  blockRange,
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

import {
  blankResume,
  cloneResume,
  loadLibrary,
  saveLibrary,
  uniqueName,
} from "./docs";
import type { DocEntry } from "./docs";
import { CustomCss, compileCustomCss } from "./CustomCss";
import { AgentPanel } from "./AgentPanel";

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
function textRangeOf(root: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode(),
    pos = 0,
    startNode: Node | null = null,
    startOffset = 0,
    endNode: Node | null = null,
    endOffset = 0;
  while (node) {
    const len = node.textContent?.length || 0;
    if (!startNode && start <= pos + len) {
      startNode = node;
      startOffset = start - pos;
    }
    if (startNode && end <= pos + len) {
      endNode = node;
      endOffset = Math.max(startOffset, end - pos);
      break;
    }
    pos += len;
    node = walker.nextNode();
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}
function mdCaretTop(el: HTMLTextAreaElement, position: number) {
  const style = window.getComputedStyle(el),
    mirror = document.createElement("div");
  [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "line-height",
    "text-transform",
    "text-indent",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "box-sizing",
    "tab-size",
  ].forEach((name) => mirror.style.setProperty(name, style.getPropertyValue(name)));
  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.width = el.clientWidth + "px";
  mirror.textContent = el.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  // 用两个 rect 的差，避免 offsetTop 在不同浏览器里对 padding 解释不一致
  const top =
    marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
  mirror.remove();
  return top;
}
function measureRow(
  node: HTMLDivElement,
  settings: Settings,
  template: Template,
  contact: boolean,
  line: Line,
  text: string,
  continued: boolean,
) {
  node.className = `flow-row row-${line.kind} ${contact ? "row-contact" : ""} ${continued ? "continued" : ""}`;
  node.dataset.order = String(line.order || 1);
  const st = rowStyle(line, settings, continued);
  Object.assign(node.style, {
    fontSize: st.fontSize + "px",
    paddingTop: st.paddingTop + "px",
    paddingBottom: st.paddingBottom + "px",
    lineHeight: String(st.lineHeight),
  });
  node.innerHTML = lineHtml(line, text, template);
  return Math.ceil(node.getBoundingClientRect().height * 100) / 100 + 0.25;
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
  flashing = false,
  allowDrop,
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
  onMove: (target: string, after: boolean) => void;
  onBlur: () => void;
  ghost?: boolean;
  flashing?: boolean;
  allowDrop?: (id: string) => boolean;
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
      className={`paper-row ${ghost ? "ghost-row" : ""} ${selected ? "selected" : ""} ${armed ? "armed" : ""} ${flashing ? "flash-row" : ""}`}
      data-preview={ghost ? "true" : undefined}
      onPointerDown={(e) => {
        if (!ghost) holdDrag(e, piece.line.id, onMove, 350, allowDrop);
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
  const [boot] = useState(loadLibrary),
    [docs, setDocs] = useState(boot.library.items),
    [activeId, setActiveId] = useState(boot.library.activeId);
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const [doc, setDoc] = useState(
    () =>
      boot.library.items.find((item) => item.id === boot.library.activeId)!
        .doc,
  );
  const ref = useRef(doc);
  ref.current = doc;
  const [past, setPast] = useState<Resume[]>([]),
    [future, setFuture] = useState<Resume[]>([]),
    lastGroup = useRef({ key: "", time: 0 });
  const [notice, setNotice] = useState(boot.notice),
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
    [docMenu, setDocMenu] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [mobile, setMobile] = useState<"editor" | "preview" | "library">("preview");
  const [pages, setPages] = useState<Piece[][]>([[]]),
    [fontVersion, setFontVersion] = useState(0),
    [picSelection, setPicSelection] = useState(""),
    [imageKind, setImageKind] = useState("证件照");
  const [hovered, setHovered] = useState(""),
    [hoverGroup, setHoverGroup] = useState(""),
    [flash, setFlash] = useState("");
  const [panelPosition, setPanelPosition] = useState({ x: 16, y: 82 });
  const [cssOpen, setCssOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(true);
  const [rightWidth, setRightWidth] = useState(248);
  const pinnedPreview = useRef(false);
  const agentPreviewApi = useRef<{
    accept: () => void;
    reject: () => void;
  } | null>(null);
  const registerAgentPreview = useCallback(
    (api: { accept: () => void; reject: () => void } | null) => {
      agentPreviewApi.current = api;
    },
    [],
  );
  const [preview, setPreview] = useState<{
    key: string;
    doc: Resume;
    ids: string[];
    label: string;
    kind?: "agent";
  } | null>(null);
  const [blockMenu, setBlockMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const view = preview?.doc ?? doc;
  const customCss = useMemo(() => {
    try {
      return compileCustomCss(view.settings.customCss);
    } catch {
      return "";
    }
  }, [view.settings.customCss]);
  const previewScroll = useRef<number | null>(null),
    previewReveal = useRef(false);
  const measureRef = useRef<HTMLDivElement>(null),
    workspace = useRef<HTMLDivElement>(null),
    mdRef = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    imageRef = useRef<HTMLInputElement>(null),
    editorRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ id: string; offset: number } | null>(null);
  const flashTimer = useRef(0);
  const mdSyncing = useRef(false);
  const markWord = useRef<HTMLDivElement>(null),
    markBar = useRef<HTMLDivElement>(null);
  const caretMark = useRef<{ id: string; offset: number } | null>(null);
  const markTimer = useRef(0);
  const mdMarkRef = useRef<HTMLDivElement>(null),
    mdMarkTimer = useRef(0),
    mdShowTimer = useRef(0);
  const markScrolling = useRef(false);
  const pendingMdMark = useRef<{
    start: number;
    length: number;
    target: number;
  } | null>(null);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
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
  // 把当前文档写回简历列表（切文档、新建、删除前也会调用一次）
  const flushSave = () => {
    const current = ref.current,
      name = current.name.trim() || "未命名简历",
      id = activeIdRef.current;
    const items = docsRef.current.map((item) =>
      item.id === id
        ? { ...item, name, updatedAt: Date.now(), doc: current }
        : item,
    );
    docsRef.current = items;
    setDocs(items);
    saveLibrary({ activeId: id, items });
    return items;
  };
  useEffect(() => {
    setSaved("保存中…");
    const save = () => {
      try {
        flushSave();
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

  // 换到某一份：撤销栈、预览、选中都按文档隔离，避免跨文档撤销
  const activate = (entry: DocEntry, items: DocEntry[]) => {
    docsRef.current = items;
    setDocs(items);
    activeIdRef.current = entry.id;
    setActiveId(entry.id);
    ref.current = entry.doc;
    setDoc(entry.doc);
    setPast([]);
    setFuture([]);
    lastGroup.current = { key: "", time: 0 };
    pinnedPreview.current = false;
    setPreview(null);
    previewScroll.current = null;
    setSelected("");
    setDocMenu(false);
    setConfirmDelete(false);
    setSaved("已保存到本机");
    saveLibrary({ activeId: entry.id, items });
  };
  const openDoc = (id: string) => {
    setDocMenu(false);
    setConfirmDelete(false);
    if (id === activeIdRef.current) return;
    flushSave();
    const target = docsRef.current.find((item) => item.id === id);
    if (target) activate(target, docsRef.current);
  };
  const createDoc = (mode: "blank" | "copy") => {
    flushSave();
    const items = docsRef.current,
      name = uniqueName(
        items.map((item) => item.name),
        mode === "blank" ? "未命名简历" : `${doc.name || "简历"} 副本`,
      ),
      next =
        mode === "blank"
          ? blankResume(doc.template, name)
          : cloneResume(doc, name),
      entry: DocEntry = { id: uid(), name, updatedAt: Date.now(), doc: next };
    activate(entry, [entry, ...items]);
    setNotice(`已新建「${name}」`);
  };
  const importDoc = (incoming: Resume) => {
    flushSave();
    const items = docsRef.current,
      name = uniqueName(
        items.map((item) => item.name),
        (incoming.name || "导入的简历").slice(0, 40),
      ),
      entry: DocEntry = {
        id: uid(),
        name,
        updatedAt: Date.now(),
        doc: { ...incoming, name },
      };
    activate(entry, [entry, ...items]);
    setNotice(`已导入「${name}」`);
  };
  const removeDoc = () => {
    if (docsRef.current.length < 2) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const index = docsRef.current.findIndex(
      (item) => item.id === activeIdRef.current,
    );
    const removed = docsRef.current[index];
    const remaining = docsRef.current.filter((item) => item.id !== removed.id);
    activate(remaining[Math.max(0, index - 1)], remaining);
    setNotice(`已删除「${removed.name}」`);
  };
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
        setDocMenu(false);
        setConfirmDelete(false);
        setBlockMenu(null);
        cancelPreview();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  // 「简历列表」下拉：点别处收起，点列表自己不算
  useEffect(() => {
    if (!docMenu) return;
    const close = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest(".doc-switch")) return;
      setDocMenu(false);
      setConfirmDelete(false);
    };
    const timer = window.setTimeout(
      () => document.addEventListener("pointerdown", close),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", close);
    };
  }, [docMenu]);
  // 「文件」下拉：点页面任何其他地方都收起（点菜单自己和触发按钮不关）
  useEffect(() => {
    if (!fileMenu) return;
    const close = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest(".file-wrap")) return;
      setFileMenu(false);
    };
    const timer = window.setTimeout(
      () => document.addEventListener("pointerdown", close),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", close);
    };
  }, [fileMenu]);
  const measureNode = useRef<HTMLDivElement | null>(null);
  const measureHost = () => {
    const host = measureRef.current;
    if (!host) return null;
    if (!measureNode.current) measureNode.current = document.createElement("div");
    if (measureNode.current.parentElement !== host)
      host.replaceChildren(measureNode.current);
    return measureNode.current;
  };
  useLayoutEffect(() => {
    const node = measureHost();
    if (!node) return;
    const measure = (line: Line, text: string, continued: boolean) =>
      measureRow(
        node,
        view.settings,
        view.template,
        line.id === contactId,
        line,
        text,
        continued,
      );
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
    setPages(
      paginate(
        view.lines,
        PAGE.height - view.settings.top - view.settings.bottom,
        measure,
      ),
    );
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
  // Markdown 里把「跳到的那一行」画一条高亮带（不抢焦点，右边还能继续编辑）
  const showMdLineMark = (
    el: HTMLTextAreaElement,
    start: number,
    length: number,
    scrollTop = el.scrollTop,
  ) => {
    const mark = mdMarkRef.current;
    if (!mark) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const style = window.getComputedStyle(el),
      borderTop = parseFloat(style.borderTopWidth) || 0,
      borderLeft = parseFloat(style.borderLeftWidth) || 0,
      padLeft = parseFloat(style.paddingLeft) || 0,
      padRight = parseFloat(style.paddingRight) || 0,
      lineHeight = parseFloat(style.lineHeight) || 20,
      top = mdCaretTop(el, start),
      // 下一行行首的位置就是本行底边（长行折行也能盖全）
      next = mdCaretTop(el, Math.min(el.value.length, start + length + 1));
    Object.assign(mark.style, {
      display: "block",
      left: rect.left + borderLeft + padLeft + "px",
      top: rect.top + borderTop + top - scrollTop + "px",
      width: Math.max(0, el.clientWidth - padLeft - padRight) + "px",
      height: (next > top ? next - top : lineHeight) + "px",
    });
    // 重新触发一次动画，连续点击也能看到亮
    mark.classList.remove("flash");
    void mark.offsetWidth;
    mark.classList.add("flash");
    window.clearTimeout(mdMarkTimer.current);
    mdMarkTimer.current = window.setTimeout(() => {
      if (mdMarkRef.current) mdMarkRef.current.style.display = "none";
    }, 1400);
  };
  const showPendingMdMark = (el: HTMLTextAreaElement) => {
    const pending = pendingMdMark.current;
    if (!pending) return;
    pendingMdMark.current = null;
    markScrolling.current = false;
    showMdLineMark(el, pending.start, pending.length, pending.target);
  };
  const locate = (id: string) => {
    setSelected(id);
    flashLine(id);
    if (mode === "simple") {
      const scroller = editorRef.current,
        row = scroller?.querySelector<HTMLElement>(`[data-field="${id}"]`);
      if (!scroller || !row) return;
      const box = scroller.getBoundingClientRect(),
        at = row.getBoundingClientRect();
      scroller.scrollTo({
        top: Math.max(0, scroller.scrollTop + at.top - box.top - 6),
        behavior: "smooth",
      });
    } else {
      const lines = ref.current.lines,
        index = lines.findIndex((l) => l.id === id),
        el = mdRef.current;
      if (index < 0 || !el) return;
      const start =
          toMarkdown(lines.slice(0, index)).length + (index ? 1 : 0),
        length = toMarkdown([lines[index]]).length,
        reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        top = mdCaretTop(el, start),
        target = Math.min(
          Math.max(0, el.scrollHeight - el.clientHeight),
          Math.max(0, top - Math.min(24, el.clientHeight / 4)),
        );
      mdSyncing.current = true;
      el.setSelectionRange(start, start + length);
      window.setTimeout(() => {
        mdSyncing.current = false;
      }, 150);
      // 平滑滚动，滚到位（滚动事件停下来）之后再亮，避免高亮带悬在半路
      pendingMdMark.current = { start, length, target };
      markScrolling.current = true;
      el.scrollTo({ top: target, behavior: reduced ? "auto" : "smooth" });
      if (mdMarkRef.current) mdMarkRef.current.style.display = "none";
      window.clearTimeout(mdShowTimer.current);
      // 本来就在目标位置、压根不会滚的情况，也要亮
      mdShowTimer.current = window.setTimeout(
        () => showPendingMdMark(el),
        reduced ? 0 : 170,
      );
    }
  };
  const flashLine = (id: string) => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setFlash(id);
    flashTimer.current = window.setTimeout(() => setFlash(""), 1200);
  };
  const scrollPaperTo = (id: string) => {
    const scroller = workspace.current,
      row = scroller?.querySelector<HTMLElement>(`[data-line="${id}"]`);
    if (!scroller || !row) return;
    const box = scroller.getBoundingClientRect(),
      at = row.getBoundingClientRect();
    // 已经在视野里就不动，避免编辑时来回抖
    if (at.top >= box.top + 8 && at.bottom <= box.bottom - 8) return;
    scroller.scrollTo({
      top: Math.max(
        0,
        scroller.scrollTop + at.top - box.top - (box.height - at.height) / 2,
      ),
      behavior: "smooth",
    });
  };
  const revealInPaper = (id: string, switchView = false) => {
    setSelected(id);
    setPicSelection("");
    flashLine(id);
    if (switchView && window.innerWidth <= 900 && mobile !== "preview") {
      setMobile("preview");
      window.setTimeout(() => scrollPaperTo(id), 90);
    } else scrollPaperTo(id);
  };
  // Markdown 模式下：光标在哪一行，右边纸张就滚到对应的那块
  const jumpFromCaret = () => {
    const el = mdRef.current;
    if (!el || mdSyncing.current) return;
    window.clearTimeout(mdShowTimer.current);
    pendingMdMark.current = null;
    markScrolling.current = false;
    if (mdMarkRef.current) mdMarkRef.current.style.display = "none";
    const lines = ref.current.lines;
    if (!lines.length) return;
    // 按每行在 Markdown 里占的字符数累加，兼容行内换行
    const caret = el.selectionStart ?? 0;
    let start = 0,
      at = 0;
    for (let i = 0; i < lines.length; i++) {
      at = i;
      const len = toMarkdown([lines[i]]).length;
      if (caret <= start + len) break;
      start += len + 1;
    }
    let index = at;
    while (index < lines.length && lines[index].kind === "blank") index++;
    if (index >= lines.length) {
      index = at;
      while (index > 0 && lines[index].kind === "blank") index--;
    }
    const id = lines[index]?.id;
    if (!id) return;
    setSelected(id);
    scrollPaperTo(id);
  };
  // 光标同步：左边编辑器里光标在哪，右边纸张同一个字上也标出来
  const hideCaretMark = () => {
    if (markWord.current) markWord.current.style.display = "none";
    if (markBar.current) markBar.current.style.display = "none";
  };
  const clearCaretMark = () => {
    caretMark.current = null;
    hideCaretMark();
  };
  const showCaretMark = (id: string, offset: number) => {
    const row = workspace.current?.querySelector<HTMLElement>(
        `[data-edit="${id}"]`,
      ),
      word = markWord.current,
      bar = markBar.current;
    caretMark.current = { id, offset };
    if (!row || !word || !bar) return hideCaretMark();
    const text = row.textContent || "";
    if (!text) return hideCaretMark();
    const at = Math.max(0, Math.min(offset, text.length));
    const boundary = /[\s\u3000，。、；：！？,.;:!?()（）【】\[\]{}<>|/·"'“”‘’]/;
    const isWord = (c: string) => c && !boundary.test(c);
    let from = at,
      to = at;
    while (from > 0 && isWord(text[from - 1])) from--;
    while (to < text.length && isWord(text[to])) to++;
    if (from === to) {
      from = Math.min(at, Math.max(0, text.length - 1));
      to = Math.min(text.length, from + 1);
    }
    const wordRect = textRangeOf(row, from, to)?.getBoundingClientRect(),
      caretRect = textRangeOf(row, at, at)?.getBoundingClientRect();
    if (!wordRect) return hideCaretMark();
    Object.assign(word.style, {
      display: "block",
      left: wordRect.left + "px",
      top: wordRect.top + "px",
      width: Math.max(2, wordRect.width) + "px",
      height: wordRect.height + "px",
    });
    Object.assign(bar.style, {
      display: "block",
      left: (caretRect && caretRect.height ? caretRect.left : wordRect.left) + "px",
      top: (caretRect && caretRect.height ? caretRect.top : wordRect.top) + "px",
      height: (caretRect && caretRect.height ? caretRect.height : wordRect.height) + "px",
    });
  };
  // Markdown 模式下把 textarea 光标换算成「第几行 + 第几个可见字符」
  const mdCaretSpot = () => {
    const el = mdRef.current,
      lines = ref.current.lines;
    if (!el || !lines.length || document.activeElement !== el) return null;
    const caret = el.selectionStart ?? 0;
    let start = 0,
      at = 0,
      within = 0;
    for (let i = 0; i < lines.length; i++) {
      at = i;
      const md = toMarkdown([lines[i]]);
      if (caret <= start + md.length) {
        within = Math.max(0, caret - start);
        break;
      }
      start += md.length + 1;
    }
    const visible = toMarkdown([lines[at]])
      .slice(0, within)
      .replace(/^(#{1,6}|[-*+]|\d+\.)\s+/, "")
      .replace(/\*\*|__|~~|`|<u>|<\/u>|\*|_/g, "").length;
    return { id: lines[at].id, offset: visible };
  };
  useEffect(() => {
    const sync = () => {
      if (mode === "simple") {
        const holder = (
          document.activeElement as HTMLElement | null
        )?.closest?.("[data-simple]") as HTMLElement | null;
        if (!holder?.dataset.simple) return clearCaretMark();
        showCaretMark(holder.dataset.simple, cursorOffset(holder) ?? 0);
        return;
      }
      const spot = mdCaretSpot();
      if (spot) showCaretMark(spot.id, spot.offset);
      else clearCaretMark();
    };
    document.addEventListener("selectionchange", sync);
    return () => {
      document.removeEventListener("selectionchange", sync);
      clearCaretMark();
    };
  }, [mode]);
  // 重新排版或缩放后，标记得重新按新位置算一遍
  useEffect(() => {
    const mark = caretMark.current;
    if (mark) showCaretMark(mark.id, mark.offset);
  }, [pages, zoom]);
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
  const resizeRight = (e: ReactPointerEvent) => {
    e.preventDefault();
    const start = e.clientX,
      width = rightWidth,
      target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (event: PointerEvent) =>
      setRightWidth(
        Math.max(
          220,
          Math.min(window.innerWidth * 0.5, width + (start - event.clientX)),
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
  // 把 dragId 这块挪到 target 那一行前面（after=true 表示挪到它后面）
  const dropLineAt = (dragId: string, target: string, after: boolean) => {
    const lines = ref.current.lines,
      at = lines.findIndex((l) => l.id === target);
    if (at < 0) return;
    const boundary = resolveDropBoundary(
      lines,
      dragId,
      after ? groupEnd(lines, at) : at,
    );
    const next = moveGroupToBoundary(ref.current, dragId, boundary);
    if (next !== ref.current) historyUpdate(next);
  };
  // 普通行只允许落在自己板块内，拖动时的落点提示也只认这些行
  const blockAllow = (lineId: string) => {
    const lines = ref.current.lines,
      from = lines.findIndex((l) => l.id === lineId);
    if (from < 0 || lines[from].kind === "section") return undefined;
    const { start, end } = blockRange(lines, from),
      ids = new Set(lines.slice(start + 1, end).map((l) => l.id));
    return (id: string) => ids.has(id);
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
    if (agentPreviewApi.current) {
      agentPreviewApi.current.reject();
      return;
    }
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
    // 别的预览（模板/模块）接管画面时，让助手的接受/不接受按钮失效，避免误报“已放弃”
    agentPreviewApi.current = null;
    // 别的预览（模板/模块）接管画面时，让助手的接受/不接受按钮失效，避免误报“已放弃”
    agentPreviewApi.current = null;
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
    if (agentPreviewApi.current) {
      agentPreviewApi.current.accept();
      return;
    }
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
      <style>{customCss}</style>
      {cssOpen && (
        <CustomCss
          value={doc.settings.customCss}
          onApply={(css) => settings({ customCss: css })}
          onClose={() => setCssOpen(false)}
        />
      )}
      <header className="app-header">
        <a className="brand" href="./">
          <FileText size={23} />
          <span>
            简历工坊<small>炒肉多，写简历。</small>
          </span>
        </a>
        <div className="doc-switch">
          <input
            className="document-name"
            aria-label="简历名称"
            value={doc.name}
            onChange={(e) =>
              historyUpdate({ ...doc, name: e.target.value }, "name")
            }
          />
          <button
            className="doc-toggle"
            aria-label="我的简历"
            title="切换 / 新建 / 删除简历"
            aria-expanded={docMenu}
            onClick={() => {
              setDocMenu((open) => !open);
              setConfirmDelete(false);
              setFileMenu(false);
            }}
          >
            <ChevronDown size={14} />
            <small>{docs.length}</small>
          </button>
          {docMenu && (
            <div className="doc-menu" role="menu" aria-label="我的简历">
              <div className="doc-menu-head">我的简历（{docs.length}）</div>
              <div className="doc-list">
                {docs.map((item) => (
                  <button
                    key={item.id}
                    role="menuitemradio"
                    aria-checked={item.id === activeId}
                    className={item.id === activeId ? "active" : ""}
                    title={item.name}
                    onClick={() => openDoc(item.id)}
                  >
                    <span>{item.name}</span>
                    {item.id === activeId && <Check size={13} />}
                  </button>
                ))}
              </div>
              <div className="doc-actions">
                <button onClick={() => createDoc("blank")} title="新建一份空白简历">
                  <FilePlus2 size={14} />
                  新建
                </button>
                <button onClick={() => createDoc("copy")} title="复制当前这份">
                  <Copy size={14} />
                  复制
                </button>
                <button
                  className={confirmDelete ? "danger confirm" : "danger"}
                  disabled={docs.length < 2}
                  onClick={removeDoc}
                  title={
                    docs.length < 2 ? "至少保留一份简历" : "删除当前这份简历"
                  }
                >
                  <Trash2 size={14} />
                  {confirmDelete ? "确定删除？" : "删除"}
                </button>
              </div>
            </div>
          )}
        </div>
        <span
          className={`save-state ${saved.includes("失败") ? "error" : ""}`}
          role="status"
        >
          {saved}
        </span>
        <div className="header-actions">
          <div className="header-history">
            <button
              className="icon-button"
              title="撤销 Ctrl+Z"
              aria-label="撤销"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              className="icon-button"
              title="重做 Ctrl+Shift+Z"
              aria-label="重做"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
          </div>
          <button
            className="header-mode"
            title={editorOpen ? "收起左侧编辑区，让纸张更宽" : "展开左侧编辑区"}
            aria-label="编辑区"
            aria-pressed={editorOpen}
            onClick={() => setEditorOpen((open) => !open)}
          >
            <PanelLeft size={16} />
            <span>编辑区</span>
          </button>
          <button
            className="header-mode"
            title={libraryOpen && !agentOpen ? "收起右侧的简历样式面板" : "展开简历样式面板"}
            aria-label="简历样式"
            aria-pressed={libraryOpen && !agentOpen}
            onClick={() => {
              if (libraryOpen && !agentOpen) setLibraryOpen(false);
              else {
                setAgentOpen(false);
                setLibraryOpen(true);
              }
            }}
          >
            <PanelRight size={16} />
            <span>简历样式</span>
          </button>
          <button
            className="header-mode agent-mode"
            title="打开 AI 排版助手：用一句话让它调排版"
            aria-label="排版助手"
            aria-pressed={agentOpen}
            onClick={() => {
              if (agentOpen) {
                setAgentOpen(false);
                setLibraryOpen(true);
              } else {
                setAgentOpen(true);
                setLibraryOpen(false);
                setRightWidth((w) => Math.max(w, 320));
              }
            }}
          >
            <Sparkles size={16} />
            <span>AI 排版</span>
          </button>
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
        {editorOpen && (
          <>
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
                title="收起编辑区"
                aria-label="收起编辑区"
                onClick={() => setEditorOpen(false)}
              >
                <PanelLeft size={16} />
              </button>
            </div>
          </div>
          <div className="editor-hint">
            {mode === "simple"
              ? "直接输入 · 选中文字设置格式 · 长按一行可以拖动排序"
              : "选中文字设置格式 · 支持一级至六级标题与列表"}
          </div>
          {mode === "md" ? (
            <textarea
              ref={mdRef}
              className="markdown-editor"
              spellCheck={false}
              aria-label="Markdown 简历内容"
              value={source}
              onClick={jumpFromCaret}
              onSelect={jumpFromCaret}
              onScroll={() => {
                if (markScrolling.current) {
                  const el = mdRef.current;
                  window.clearTimeout(mdShowTimer.current);
                  mdShowTimer.current = window.setTimeout(() => {
                    if (el) showPendingMdMark(el);
                  }, 130);
                  return;
                }
                if (mdMarkRef.current) mdMarkRef.current.style.display = "none";
              }}
              onKeyUp={(e) => {
                if (
                  ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(
                    e.key,
                  )
                )
                  jumpFromCaret();
              }}
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
                    className={`edit-field field-${line.kind} ${selected === line.id ? "active" : ""} ${hovered === line.id ? "hovered" : ""} ${flash === line.id ? "flash-line" : ""}`}
                    onMouseEnter={() => setHovered(line.id)}
                    onMouseLeave={() => setHovered("")}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      setSelected(line.id);
                      scrollPaperTo(line.id);
                    }}
                    onPointerDown={(e) =>
                      holdDrag(
                        e,
                        line.id,
                        (target, after) => dropLineAt(line.id, target, after),
                        350,
                        blockAllow(line.id),
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
                      onFocus={() => {
                        setSelected(line.id);
                        revealInPaper(line.id);
                      }}
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
          </>
        )}
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
              <button
                title="自定义 CSS"
                aria-label="自定义 CSS"
                onClick={() => setCssOpen(true)}
              >
                <Code2 size={19} />
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
                <b>{preview.kind === "agent" ? "排版预览" : "插入预览"}</b>{" "}
                {preview.label}
                {preview.kind === "agent"
                  ? "。这是助手改完的效果，确认后才写进简历。"
                  : "。单击固定预览，双击卡片直接加入。"}
              </span>
              <button onClick={confirmPreview}>
                {preview.kind === "agent" ? "接受" : "确认应用"}
              </button>
              <button onClick={cancelPreview}>
                {preview.kind === "agent" ? "不接受" : "取消"}
              </button>
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
            onScroll={() => {
              if (!caretMark.current) return;
              hideCaretMark();
              window.clearTimeout(markTimer.current);
              markTimer.current = window.setTimeout(() => {
                const mark = caretMark.current;
                if (mark) showCaretMark(mark.id, mark.offset);
              }, 240);
            }}
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
                      flashing={flash === piece.line.id}
                      allowDrop={blockAllow(piece.line.id)}
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
                        if (id) dropLineAt(id, piece.line.id, false);
                        setArmed("");
                      }}
                      onMove={(target, after) => {
                        dropLineAt(piece.line.id, target, after);
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
        {(agentOpen || libraryOpen) && (
          <div
            role="separator"
            aria-label="调整右侧面板宽度"
            aria-orientation="vertical"
            aria-valuenow={Math.round(rightWidth)}
            tabIndex={0}
            className="panel-resizer panel-resizer-right"
            onPointerDown={resizeRight}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft")
                setRightWidth((w) => Math.min(window.innerWidth * 0.5, w + 20));
              if (e.key === "ArrowRight")
                setRightWidth((w) => Math.max(220, w - 20));
            }}
          >
            <GripVertical size={12} />
          </div>
        )}
        {agentOpen ? (
          <aside
            className={`library-panel agent-side ${mobile === "library" ? "mobile-active" : ""}`}
            style={{ width: rightWidth, minWidth: rightWidth }}
            aria-label="排版助手"
          >
            <AgentPanel
              key={activeId}
              docked
              doc={doc}
              docId={activeId}
              pageCount={pages.length}
              onApply={(next) => historyUpdate(next)}
              onPreview={(next) => {
                pinnedPreview.current = false;
                previewScroll.current = workspace.current?.scrollTop ?? 0;
                previewReveal.current = false;
                setPreview({
                  key: "agent",
                  doc: next,
                  ids: [],
                  label: "排版助手建议",
                  kind: "agent",
                });
              }}
              onClearPreview={() => {
                agentPreviewApi.current = null;
                setPreview(null);
                previewScroll.current = null;
              }}
              registerPreviewApi={registerAgentPreview}
              onClose={() => {
                agentPreviewApi.current = null;
                setPreview(null);
                setAgentOpen(false);
                setLibraryOpen(true);
              }}
            />
          </aside>
        ) : (
          libraryOpen && (
        <aside
          className={`library-panel ${mobile === "library" ? "mobile-active" : ""}`}
          style={{ width: rightWidth, minWidth: rightWidth }}
        >
          <div className="library-heading">
            <div className="library-heading-row">
              <h2>简历样式</h2>
              <button
                className="icon-button"
                title="收起样式面板"
                aria-label="收起样式面板"
                onClick={() => setLibraryOpen(false)}
              >
                <PanelRight size={16} />
              </button>
            </div>
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
                      <small>138 0000 2468 | zhangxiaoming@example.com</small>
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
          )
        )}
      </div>
      <nav className="mobile-nav">
        <button
          className={mobile === "editor" ? "active" : ""}
          onClick={() => {
            setEditorOpen(true);
            setMobile("editor");
          }}
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
          onClick={() => {
            if (!agentOpen) setLibraryOpen(true);
            setMobile("library");
          }}
        >
          <PanelRight size={17} />
          模板与内容
        </button>
      </nav>
      <div ref={markWord} className="caret-word" aria-hidden="true" />
      <div ref={markBar} className="caret-bar" aria-hidden="true" />
      <div ref={mdMarkRef} className="md-line-mark" aria-hidden="true" />
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
            if (file.name.endsWith(".json")) {
              // 备份文件当成一份新简历，不覆盖当前这份
              importDoc(readResume(JSON.parse(text)));
            } else {
              historyUpdate({
                ...doc,
                lines: parseMarkdown(text, doc.lines),
              });
              setNotice("已导入正文，原来的内容可通过撤销恢复。");
            }
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
                  {modal === "type" ? "让排版恰到好处" : "这个网站怎么用"}
                </h2>
                <p>
                  {modal === "type"
                    ? "整份简历统一调整，变化实时可见。单位：px"
                    : "左边写内容，中间看效果，右边调样式。"}
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
                  <b>1. 界面分三栏：</b>左边写内容，中间看效果，右边调样式。
                  顶栏的「编辑区」「简历样式」「AI 排版」控制这三栏：点一下收起，再点展开；
                  两栏之间的竖线可以左右拖动改宽度。右边「简历样式」和「AI 排版」是互斥的，
                  打开一个会自动关掉另一个。
                </p>
                <p>
                  <b>2. 多份简历：</b>顶栏简历名称右边的 <b>▾</b> 打开「我的简历」：新建空白、
                  复制当前这份、删除当前这份（会问一次，且至少保留一份）。
                  每份简历的撤销记录和 AI 对话各自独立；以前只存过一份的草稿会自动收进列表。
                </p>
                <p>
                  <b>3. 写内容（左栏）：</b>
                  默认「直接编辑」，点任意一行就能改；选中文字会浮出格式工具（加粗、斜体、
                  下划线、标签、链接）。<code>Enter</code> 新增下一段，
                  <code>Shift+Enter</code> 行内换行。鼠标移到某行，左边会出现 <b>+</b>，
                  从模块库插入板块或条目；在文字上长按约 0.4 秒可以拖动排序
                  （拖板块标题会带着整段内容走）。
                  需要大段替换时，切到 Markdown 看/改整篇源码。
                </p>
                <p>
                  <b>4. 点哪跳哪：</b>
                  在左栏点某一行，中间纸张会滚到对应位置并闪一下；反过来点纸上某一行，
                  左边也会跳到那一行并高亮。Markdown 模式下同样有效。
                </p>
                <p>
                  <b>5. 调样式（右栏）：</b>
                  六套模板（炒肉多经典、黑线、标签式、学术、青岚、红序）点一下即换，内容不受影响。
                  「拼接内容」把选好的板块或经历模板插到当前行后面。
                  「间距与字号」能按内容类型分别调上下间距和字号，也能改行距和四边页边距；
                  底部还可以写自定义 CSS。
                </p>
                <p>
                  <b>6. 预览区（中间）：</b>
                  纸张就是 A4（794×1123px），缩放只改显示大小、不改变排版，所以预览和导出 PDF 一致。
                  内容变多会自动续页，单条太长会切到下一页继续。
                  工具栏的图片按钮可以上传照片或校徽，拖到合适位置，右下角拉大小。
                </p>
                <p>
                  <b>7. 撤销与保存：</b>
                  顶栏 <b>↶ ↷</b> 或 <code>Ctrl+Z</code> / <code>Ctrl+Shift+Z</code>，
                  最多 60 步，连续打字会合并成一步。改动会自动存到本机浏览器，
                  顶栏右侧显示「已保存到本机」。
                </p>
                <p>
                  <b>8. AI 排版（对话）：</b>
                  点顶栏「AI 排版」打开助手。首次使用先填三项参数，点「测试连接」、
                  勾选授权说明，再「保存并启用」：
                </p>
                <ul className="help-list">
                  <li>
                    <b>接口地址</b>：填到 <code>/v1</code> 为止，例如
                    <code>https://api.openai.com/v1</code>；兼容 OpenAI
                    接口的服务都能用（DeepSeek、通义、Kimi、硅基流动、自建中转等）。
                  </li>
                  <li>
                    <b>模型名</b>：填服务商文档里的完整名字，例如
                    <code>gpt-4o-mini</code>、<code>deepseek-chat</code>。
                  </li>
                  <li>
                    <b>API Key</b>：只保存在这台电脑的浏览器里。
                  </li>
                </ul>
                <p>
                  填好后在「对话」里说人话即可，例如「排宽松点」「换成学术风」
                  「把教育背景放最前面」「把第三条写短些」。
                  它会先列出将要改动的项目，右侧纸张先显示效果，你点「接受」才写进简历。
                  对话会记住上下文，关掉面板、刷新页面都还在；右上角 🧹 可清空。
                </p>
                <p>
                  <b>9. 一键排版：</b>
                  助手顶部切到「一键排版」，把整段简历粘进大输入框，点「开始排版」。
                  它会识别姓名、联系方式、【板块】、经历行和要点，按当前模板排好，
                  过程中显示「正在排版… N%」。排完直接写进简历，结果旁边有
                  <b>撤销排版</b> 可以回退。配置了接口时会自动再做一次 AI 复核
                  （能改结构甚至整篇重排，默认不改文字）；没配接口就只用本地规则。
                </p>
                <p>
                  <b>10. 导出与备份：</b>
                  「导出 PDF」打开打印窗口，选“另存为 PDF”，A4、100% 缩放、关闭页眉页脚、
                  勾选背景图形。「文件」菜单可下载 JSON 备份、导出 Markdown、导入备份或 Markdown；
                  导入 JSON 会新增一份简历，不会覆盖当前这份。
                </p>
                <p className="muted">
                  <b>数据存在哪：</b>
                  全部保存在这台电脑的浏览器本地，没有账号、不上传。清除浏览器数据、
                  换浏览器或换设备都会看不到；照片以 base64 存在简历里，浏览器容量约 5MB，
                  放多张大图可能保存失败。重要版本请下载 JSON 备份。
                </p>
                <p className="muted">
                  <b>联网范围：</b>
                  只有「AI 排版」会联网——点发送时把排版参数、板块标题和简历正文发到你填的接口。
                  编辑、排版、导出等其余功能都在本机运行。
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
