import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  Github,
  Mail,
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
  SunMoon,
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
import "./ui-theme.css";
import { MarkdownNumbers } from "./MarkdownNumbers";
import { PreviewZoom } from "./PreviewZoom";
import { ColorControl } from "./ColorControl";
import { ImageUploadDialog } from "./ImageUploadDialog";
import { FreeLoading } from "./FreeLoading";

import {
  blankResume,
  cloneResume,
  loadLibrary,
  saveLibrary,
  uniqueName,
} from "./docs";
import type { DocEntry } from "./docs";
import { CustomCss, compileCustomCss } from "./CustomCss";
import { checkContent, checkRendered } from "./productTools";
import type { ExportIssue } from "./productTools";
import { ExportReview } from "./ExportReview";
import { AgentPanel } from "./AgentPanel";
import type { FreeStudioApi } from "./FreeStudio";
import type { FreeDocument, SourceDesign } from "./freeform";
import {
  sourceContentStyle,
  sourceFrameStyle,
  applySourceContentStyle,
} from "./freeform";
import { FreeLayers } from "./FreeLayers";
import type { LayerSvg } from "./FreeLayers";
import { readViewPrefs, saveViewPrefs } from "./viewPrefs";
import {
  cursorOffset,
  placeCursor,
  textRangeOf,
  selectedRows,
  outsideSelection,
} from "./editorDom";
const FreeStudio = lazy(() => import("./FreeStudio"));

function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  ].forEach((name) =>
    mirror.style.setProperty(name, style.getPropertyValue(name)),
  );
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
  design?: SourceDesign,
) {
  node.style.cssText = "";
  node.className = `flow-row row-${line.kind} ${contact ? "row-contact" : ""} ${continued ? "continued" : ""}`;
  node.dataset.order = String(line.order || 1);
  const st = rowStyle(line, settings, continued);
  Object.assign(node.style, {
    fontSize: st.fontSize + "px",
    paddingTop: st.paddingTop + "px",
    paddingBottom: st.paddingBottom + "px",
    lineHeight: String(st.lineHeight),
  });
  applySourceContentStyle(node, design);
  if (design?.width) node.style.width = design.width + "px";
  node.innerHTML = lineHtml(line, text, template);
  node
    .querySelectorAll<HTMLElement>("code")
    .forEach((code, i) => applySourceContentStyle(code, design?.tags?.[i]));
  return Math.ceil(node.getBoundingClientRect().height * 100) / 100;
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
      const offset = el.current.contains(
        window.getSelection()?.anchorNode || null,
      )
        ? cursorOffset(el.current)
        : null;
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
      tabIndex={0}
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
          const range = window.getSelection()?.rangeCount
            ? window.getSelection()!.getRangeAt(0)
            : null;
          if (
            range &&
            (!e.currentTarget.contains(range.startContainer) ||
              !e.currentTarget.contains(range.endContainer))
          )
            return;
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
  design,
  freeMode = false,
}: {
  piece: Piece;
  design?: SourceDesign;
  freeMode?: boolean;
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
    if (
      el.current &&
      !composing.current &&
      editableText(el.current) !== piece.line.text.slice(piece.start, piece.end)
    ) {
      const offset =
        document.activeElement === el.current ? cursorOffset(el.current) : null;
      el.current.innerHTML = html;
      if (offset !== null) placeCursor(el.current, offset);
    }
    el.current?.querySelectorAll<HTMLElement>("code").forEach((code, i) => {
      code.dataset.freeTag = String(i);
      code.removeAttribute("style");
      applySourceContentStyle(code, design?.tags?.[i]);
    });
  }, [html, piece, design]);
  const flush = () => {
    if (el.current && !composing.current) onChange(editableText(el.current));
  };
  return (
    <div
      className={`paper-row ${ghost ? "ghost-row" : ""} ${selected ? "selected" : ""} ${armed ? "armed" : ""} ${flashing ? "flash-row" : ""}`}
      style={sourceFrameStyle(design)}
      data-preview={ghost ? "true" : undefined}
      onPointerDown={(e) => {
        if (!ghost && !freeMode)
          holdDrag(e, piece.line.id, onMove, 350, allowDrop);
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
        style={{
          ...rowStyle(piece.line, settings, piece.continued),
          ...sourceContentStyle(design),
        }}
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
      boot.library.items.find((item) => item.id === boot.library.activeId)!.doc,
  );
  const freeApi = useRef<FreeStudioApi | null>(null);
  const [freeEntering, setFreeEntering] = useState(false);
  const ref = useRef(doc);
  ref.current = doc;
  const [past, setPast] = useState<Resume[]>([]),
    [future, setFuture] = useState<Resume[]>([]),
    lastGroup = useRef({ key: "", time: 0 });
  const [notice, setNotice] = useState(boot.notice),
    [saved, setSaved] = useState("已保存到本机"),
    [mode, setMode] = useState<"simple" | "md" | "free">("simple"),
    [tab, setTab] = useState<"templates" | "modules">("templates");
  const [selected, setSelected] = useState(""),
    [armed, setArmed] = useState(""),
    [leftWidth, setLeftWidth] = useState(() =>
      Math.min(
        window.innerWidth * 0.6,
        readViewPrefs().leftWidth ??
          Math.min(760, Math.max(360, window.innerWidth * 0.26)),
      ),
    ),
    [zoom, setZoom] = useState(() => readViewPrefs().zoom ?? 1),
    [autoZoom, setAutoZoom] = useState(
      () => readViewPrefs().autoZoom ?? readViewPrefs().zoom === undefined,
    ),
    [modal, setModal] = useState<"type" | "help" | null>(null),
    [fileMenu, setFileMenu] = useState(false),
    [docMenu, setDocMenu] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [mobile, setMobile] = useState<"editor" | "preview" | "library">("preview");
  useEffect(
    () => saveViewPrefs({ zoom, leftWidth, autoZoom }),
    [zoom, leftWidth, autoZoom],
  );
  const [pages, setPages] = useState<Piece[][]>([[]]),
    [fontVersion, setFontVersion] = useState(0),
    [picSelection, setPicSelection] = useState("");
  const [hovered, setHovered] = useState(""),
    [hoverGroup, setHoverGroup] = useState(""),
    [flash, setFlash] = useState("");
  const [panelPosition, setPanelPosition] = useState({ x: 16, y: 82 });
  const [cssOpen, setCssOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<"证件照" | "校徽" | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [exportIssues, setExportIssues] = useState<ExportIssue[] | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const exportLock = useRef(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(true);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("diyjobresume.appearance") === "dark";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("diyjobresume.appearance", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  const rightWidth = 248;
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
  const paperWidth =
    view.freeform?.base === "flow" ? view.freeform.pages[0].width : PAGE.width;
  const paperHeight =
    view.freeform?.base === "flow"
      ? view.freeform.pages[0].height
      : PAGE.height;
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
    editorRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ id: string; offset: number } | null>(null);
  const pendingSimpleCaret = useRef<{ id: string; offset: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const caret = pendingSimpleCaret.current;
    if (!caret || mode !== "simple") return;
    const el = editorRef.current?.querySelector<HTMLElement>(
      `[data-simple="${caret.id}"]`,
    );
    if (!el) return;
    pendingSimpleCaret.current = null;
    el.focus({ preventScroll: true });
    placeCursor(el, caret.offset);
  }, [doc.lines, mode]);
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
      .filter((p) => !p.anchor && p.page === 0 && p.y < 150)
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
  useEffect(() => {
    const replaceSelection = (event: InputEvent | ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const anchor =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      const simple = anchor?.closest(".simple-editor");
      const rows = selectedRows(
        range,
        simple || document,
        simple ? "[data-simple]" : ".paper-workspace [data-edit]",
      );
      const start = rows[0],
        end = rows.at(-1);
      if (
        !start ||
        !end ||
        (start === end &&
          start.contains(range.startContainer) &&
          end.contains(range.endContainer))
      )
        return;
      const side = simple ? "simple" : "edit";
      const current = ref.current,
        a = current.lines.findIndex((l) => l.id === start.dataset[side]),
        b = current.lines.findIndex((l) => l.id === end.dataset[side]);
      if (a < 0 || b < a) return;
      if (
        event instanceof InputEvent &&
        !/^(delete|insert)/.test(event.inputType)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      const { prefix, suffix } = outsideSelection(range, start, end);
      const serialize = (fragment: DocumentFragment) => {
        const el = document.createElement("div");
        el.append(fragment);
        return editableText(el);
      };
      const before = serialize(prefix),
        after = serialize(suffix),
        insert =
          event instanceof ClipboardEvent
            ? event.clipboardData?.getData("text/plain") || ""
            : ["insertParagraph", "insertLineBreak"].includes(event.inputType)
              ? "\n"
              : event.inputType.startsWith("insert")
                ? event.data || ""
                : "";
      const line = {
        ...current.lines[a],
        kind:
          current.lines[a].kind === "blank"
            ? ("text" as Kind)
            : current.lines[a].kind,
        text: before + insert + after,
      };
      const replacement = insert.includes("\n")
        ? parseMarkdown(line.text)
        : [line];
      replacement[0] = { ...replacement[0], id: line.id };
      if (side === "simple")
        pendingSimpleCaret.current = {
          id: line.id,
          offset: before.length + insert.length,
        };
      historyUpdate({
        ...current,
        lines: [
          ...current.lines.slice(0, a),
          ...replacement,
          ...current.lines.slice(b + 1),
        ],
      });
      if (side !== "simple")
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(
            `[data-${side}="${line.id}"]`,
          );
          if (el) {
            el.focus();
            placeCursor(el, before.length + insert.length);
          }
        });
    };
    document.addEventListener("beforeinput", replaceSelection, true);
    document.addEventListener("paste", replaceSelection, true);
    return () => {
      document.removeEventListener("beforeinput", replaceSelection, true);
      document.removeEventListener("paste", replaceSelection, true);
    };
  }, []);
  const updateLine = (id: string, text: string) => {
    const current = ref.current;
    if (current.lines.find((l) => l.id === id)?.text === text) return;
    historyUpdate(
      {
        ...current,
        lines: current.lines.map((l) =>
          l.id === id
            ? {
                ...l,
                kind: l.kind === "blank" ? ("text" as Kind) : l.kind,
                text,
              }
            : l,
        ),
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
    freeApi.current?.flush();
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
    try {
      saveLibrary({ activeId: id, items });
      setSaved("已保存到本机");
    } catch {
      setSaved("保存失败，请下载备份");
    }
    return items;
  };
  useEffect(() => {
    setSaved("保存中…");
    const save = () => {
      try {
        flushSave();
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
    try {
      saveLibrary({ activeId: entry.id, items });
    } catch {
      setSaved("保存失败，请下载备份");
      setNotice("无法保存，未切换或删除简历。请先下载备份。");
      return false;
    }
    setMode(entry.doc.freeform && mode === "free" ? "free" : "simple");
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
    return true;
  };
  const openDoc = (id: string) => {
    setDocMenu(false);
    setConfirmDelete(false);
    if (id === activeIdRef.current) return;
    flushSave();
    const target = docsRef.current.find((item) => item.id === id);
    if (target) activate(target, docsRef.current);
  };
  const createDoc = (mode: "blank" | "copy", template = doc.template) => {
    flushSave();
    const items = docsRef.current,
      name = uniqueName(
        items.map((item) => item.name),
        mode === "blank"
          ? template === "blank"
            ? "空白简历"
            : "未命名简历"
          : `${doc.name || "简历"} 副本`,
      ),
      next =
        mode === "blank" ? blankResume(template, name) : cloneResume(doc, name),
      entry: DocEntry = { id: uid(), name, updatedAt: Date.now(), doc: next };
    if (!activate(entry, [entry, ...items])) return;
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
    if (!activate(entry, [entry, ...items])) return;
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
    if (!activate(remaining[Math.max(0, index - 1)], remaining)) return;
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
      if (
        mode === "free" ||
        uploadKind ||
        (e.target as Element)?.closest(".color-popover")
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === "Escape") {
        setExportIssues(null);
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
    if (!measureNode.current)
      measureNode.current = document.createElement("div");
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
        view.freeform?.sourceDesign?.[line.id],
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
        paperHeight - view.settings.top - view.settings.bottom,
        measure,
      ),
    );
  }, [
    view.lines,
    view.settings,
    view.template,
    paperWidth,
    paperHeight,
    fontVersion,
    JSON.stringify(view.freeform?.sourceDesign || {}),
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
    if (!el || mode === "free") return;
    const fit = () => {
      if (autoZoom && el.clientWidth > 0)
        setZoom(
          Math.max(
            0.2,
            Math.min(
              2,
              (el.clientWidth -
                parseFloat(getComputedStyle(el).paddingLeft) -
                parseFloat(getComputedStyle(el).paddingRight) -
                2) /
                paperWidth,
            ),
          ),
        );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoZoom, leftWidth, mobile, paperWidth, mode]);
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
      const start = toMarkdown(lines.slice(0, index)).length + (index ? 1 : 0),
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
    const boundary =
      /[\s\u3000，。、；：！？,.;:!?()（）【】\[\]{}<>|/·"'“”‘’]/;
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
      left:
        (caretRect && caretRect.height ? caretRect.left : wordRect.left) + "px",
      top:
        (caretRect && caretRect.height ? caretRect.top : wordRect.top) + "px",
      height:
        (caretRect && caretRect.height ? caretRect.height : wordRect.height) +
        "px",
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
      const paper = target.closest(".resume-paper") as HTMLElement | null;
      const scale = paper
        ? paper.getBoundingClientRect().width / paperWidth
        : zoom;
      const dx = (event.clientX - startX) / scale,
        dy = (event.clientY - startY) / scale;
      const patch = resize
        ? {
            w: Math.max(24, Math.min(300, paperWidth - pic.x, pic.w + dx)),
            h: Math.max(24, Math.min(300, paperHeight - pic.y, pic.h + dy)),
          }
        : {
            x: Math.max(0, Math.min(paperWidth - pic.w, pic.x + dx)),
            y: Math.max(0, Math.min(paperHeight - pic.h, pic.y + dy)),
          };
      const next = {
        ...ref.current,
        pictures: ref.current.pictures.map((p) =>
          p.id === pic.id ? { ...p, ...patch, anchor: undefined } : p,
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
    let previousIndex = i - 1;
    while (previousIndex > 0 && lines[previousIndex].kind === "blank")
      previousIndex--;
    const previous = lines[previousIndex],
      offset = previous.text.replace(/[*_~`]/g, "").length;
    lines[previousIndex] = {
      ...previous,
      kind: previous.kind === "blank" ? "text" : previous.kind,
      text: previous.text + lines[i].text,
    };
    lines.splice(previousIndex + 1, i - previousIndex);
    pendingSimpleCaret.current = { id: previous.id, offset };
    historyUpdate({ ...ref.current, lines });
  };
  const simpleComposing = useRef(false);
  const syncSimple = () => {
    if (simpleComposing.current) return;
    const current = ref.current,
      values = new Map(
        [
          ...(editorRef.current?.querySelectorAll<HTMLElement>(
            "[data-simple]",
          ) || []),
        ].map((el) => [el.dataset.simple!, editableText(el)]),
      );
    let changed = false;
    const lines = current.lines.map((line) => {
      const value = values.get(line.id);
      if (value === undefined || value === line.text) return line;
      changed = true;
      return {
        ...line,
        kind: line.kind === "blank" ? ("text" as Kind) : line.kind,
        text: value,
      };
    });
    if (changed) historyUpdate({ ...current, lines }, "simple-input");
  };
  const simpleCaretRow = () => {
    const node = window.getSelection()?.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    return element?.closest<HTMLElement>("[data-simple]");
  };
  const splitSimple = (id: string) => {
    const row = editorRef.current?.querySelector<HTMLElement>(
        `[data-simple="${id}"]`,
      ),
      selection = window.getSelection();
    if (!row || !selection?.rangeCount) return;
    const current = ref.current,
      at = current.lines.findIndex((line) => line.id === id);
    if (at < 0) return;
    const range = selection.getRangeAt(0);
    const { prefix, suffix } = outsideSelection(range, row, row);
    const read = (part: DocumentFragment) => {
      const el = document.createElement("div");
      el.append(part);
      return editableText(el);
    };
    const line = current.lines[at],
      next: Line = {
        id: uid(),
        kind: ["bullet", "ordered"].includes(line.kind) ? line.kind : "text",
        text: read(suffix),
        ...(line.kind === "ordered" ? { order: (line.order || 1) + 1 } : {}),
      };
    pendingSimpleCaret.current = { id: next.id, offset: 0 };
    historyUpdate({
      ...current,
      lines: [
        ...current.lines.slice(0, at),
        { ...line, text: read(prefix) },
        next,
        ...current.lines.slice(at + 1),
      ],
    });
  };
  const simpleKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.defaultPrevented ||
      e.nativeEvent.isComposing ||
      (e.target as Element).closest("button")
    )
      return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(e.currentTarget);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    const row = simpleCaretRow();
    if (!row) return;
    const line = ref.current.lines.find(
      (line) => line.id === row.dataset.simple,
    );
    if (!line) return;
    const selection = window.getSelection(),
      range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (e.key === "Enter") {
      // Let beforeinput handle ranges spanning rows without letting the browser remove React containers.
      if (
        range &&
        (!row.contains(range.startContainer) ||
          !row.contains(range.endContainer))
      )
        return;
      e.preventDefault();
      if (e.shiftKey) document.execCommand("insertLineBreak");
      else splitSimple(line.id);
    } else if (
      e.key === "Backspace" &&
      selection?.isCollapsed &&
      cursorOffset(row) === 0
    ) {
      e.preventDefault();
      backspaceLine(line.id);
    } else if (
      e.key === "Delete" &&
      selection?.isCollapsed &&
      cursorOffset(row) === (row.textContent?.length || 0)
    ) {
      e.preventDefault();
      const lines = [...ref.current.lines],
        at = lines.findIndex((l) => l.id === line.id);
      let next = at + 1;
      while (next < lines.length && lines[next].kind === "blank") next++;
      if (next < lines.length) {
        const offset = row.textContent?.length || 0;
        lines[at] = { ...lines[at], text: lines[at].text + lines[next].text };
        lines.splice(at + 1, next - at);
        pendingSimpleCaret.current = { id: line.id, offset };
        historyUpdate({ ...ref.current, lines });
      }
    } else if (e.key === "/" && !line.text) {
      e.preventDefault();
      openBlockMenu(line.id);
    }
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
  const updateFreeform = (data: FreeDocument) => {
    if (activeIdRef.current !== activeId) return;
    const next = { ...ref.current, freeform: data };
    historyUpdate(next);
  };
  const restoreFreeLayout = () => {
    const current = ref.current,
      baseline = current.freeformBaseline;
    if (!baseline) return;
    const freeform = baseline.freeform
      ? structuredClone(baseline.freeform)
      : {
          ...current.freeform!,
          sourceDesign: {},
          pages: Array.from({ length: Math.max(1, pages.length) }, () => ({
            id: uid(),
            width: PAGE.width,
            height: PAGE.height,
            background: "#ffffff",
            canvas: { objects: [] },
          })),
        };
    historyUpdate({ ...current, ...structuredClone(baseline), freeform });
  };
  const enterFree = async (rebuild = false) => {
    if (freeEntering) return;
    setAutoZoom(false);
    (document.activeElement as HTMLElement)?.blur();
    cancelPreview();
    if (!ref.current.freeformBaseline) {
      const current = ref.current;
      const next = {
        ...current,
        freeformBaseline: {
          settings: structuredClone(current.settings),
          template: current.template,
          pictures: structuredClone(current.pictures),
          ...(current.freeform
            ? { freeform: structuredClone(current.freeform) }
            : {}),
        },
      };
      ref.current = next;
      setDoc(next);
    }
    if (ref.current.freeform?.base === "flow" && !rebuild) {
      setMode("free");
      return;
    }
    if (
      ref.current.freeform &&
      !rebuild &&
      !window.confirm(
        "将按当前简历启用无损编辑，旧自由稿会完整保留为备份。取消可继续编辑旧稿。是否继续？",
      )
    ) {
      setMode("free");
      return;
    }
    setFreeEntering(true);
    setMobile("preview");
    try {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const { captureFreeform, promoteAnchoredPictures } = await import(
        "./freeCapture"
      );
      const root = workspace.current;
      if (!root) throw new Error("请先返回简历预览，再进入自由模式。");
      const sourceDoc = ref.current,
        sourceId = activeIdRef.current;
      const captured = await captureFreeform(root, sourceDoc);
      const prepared = await promoteAnchoredPictures(root, sourceDoc, captured);
      if (activeIdRef.current !== sourceId || ref.current !== sourceDoc)
        throw new Error("简历内容已变化，请重新进入自由模式，最新编辑已保留。");
      const next = {
        ...ref.current,
        ...(ref.current.freeform && !ref.current.freeformArchive
          ? { freeformArchive: ref.current.freeform }
          : {}),
        freeform: prepared.freeform,
        pictures: prepared.pictures,
        ...(prepared.promoted &&
        sourceDoc.freeformBaseline &&
        !sourceDoc.freeformBaseline.freeform
          ? {
              freeformBaseline: {
                ...sourceDoc.freeformBaseline,
                freeform: structuredClone(prepared.freeform),
                pictures: structuredClone(prepared.pictures),
              },
            }
          : {}),
      };
      ref.current = next;
      setDoc(next);
      setMode("free");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "自由模式未能打开，原简历已保留。",
      );
    } finally {
      setFreeEntering(false);
    }
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
  const previewModule = (name: string, body: string, label: string) => {
    const next = insertModule(ref.current, name, body);
    const addedAt = next.lines.findIndex(
      (l) => !ref.current.lines.some((old) => old.id === l.id),
    );
    const destination =
      [...next.lines.slice(0, addedAt + 1)]
        .reverse()
        .find((l) => l.kind === "section")?.text ?? name;
    beginPreview(
      name + label,
      next,
      `将在「${destination}」末尾加入「${label}」`,
    );
  };
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
  const renderPaper = (
    page: number,
    scale = 1,
    options: { hideDecorations?: boolean; layers?: LayerSvg } = {},
  ) => {
    const pieces = pages[page] || [];
    const visiblePictures = doc.pictures.flatMap((p) => {
      if (p.anchor) {
        let top = view.settings.top;
        for (let pi = 0; pi < pages.length; pi++) {
          top = view.settings.top;
          for (const piece of pages[pi]) {
            if (piece.line.id === p.anchor && piece.start === 0) {
              const design = view.freeform?.sourceDesign?.[p.anchor];
              return pi === page
                ? [
                    {
                      ...p,
                      x: p.x + (design?.dx || 0),
                      y: top + p.y + (design?.dy || 0),
                    },
                  ]
                : [];
            }
            top += piece.height;
          }
        }
        return [];
      }
      return Math.min(p.page, pages.length - 1) === page ? [p] : [];
    });
    return (
      <article
        className={`resume-paper template-${view.template}`}
        data-page={page}
        style={{
          ...resumeStyle,
          backgroundColor:
            view.freeform?.base === "flow"
              ? view.freeform.pages[page]?.background
              : undefined,
          width: paperWidth,
          height: paperHeight,
          padding: `${view.settings.top}px ${view.settings.right}px ${view.settings.bottom}px ${view.settings.left}px`,
          transform: scale === 1 ? undefined : `scale(${scale})`,
        }}
      >
        {view.freeform?.base === "flow" && !options.hideDecorations && (
          <FreeLayers
            page={view.freeform.pages[page]}
            plane="background"
            ready={options.layers}
          />
        )}
        {pieces.map((piece) => (
          <Editable
            key={piece.line.id + "-" + piece.start}
            piece={piece}
            freeMode={mode === "free"}
            design={view.freeform?.sourceDesign?.[piece.line.id]}
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
        {visiblePictures.map((p) => (
          <div
            key={p.id}
            data-picture-id={p.id}
            data-anchor={p.anchor}
            className={`floating-picture ${picSelection === p.id ? "chosen" : ""}`}
            style={{
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
            }}
            onPointerDown={(e) => dragPicture(e, p)}
            tabIndex={0}
            role="img"
            aria-label={p.label + "，拖动调整位置"}
            onKeyDown={(e) => {
              if (e.key === "Delete") {
                historyUpdate({
                  ...doc,
                  pictures: doc.pictures.filter((x) => x.id !== p.id),
                });
              }
              if (
                ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                  e.key,
                )
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
                                paperWidth - x.w,
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
                                paperHeight - x.h,
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
                      pictures: doc.pictures.filter((x) => x.id !== p.id),
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
              </>
            )}
          </div>
        ))}
        {view.freeform?.base === "flow" && !options.hideDecorations && (
          <FreeLayers
            page={view.freeform.pages[page]}
            plane="foreground"
            ready={options.layers}
          />
        )}
      </article>
    );
  };
  const renderAgentSide = () => (
    <aside
      className={`library-panel agent-side ${mode === "free" || mobile === "library" ? "mobile-active" : ""}`}
      style={{ width: rightWidth, minWidth: rightWidth }}
      aria-label="排版助手"
    >
      <AgentPanel
        key={activeId}
        docked
        doc={doc}
        docId={activeId}
        pageCount={pages.length}
        onApply={(next, base) => {
          if (activeIdRef.current !== activeId || ref.current !== base)
            return false;
          historyUpdate(next);
          return true;
        }}
        onPreview={(next) => {
          if (activeIdRef.current !== activeId) return;
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
  );
  return (
    <div
      className={`studio ${mode === "free" ? "free-mode" : ""} ${dark ? "is-dark" : ""}`}
      style={{ "--editor-width": leftWidth + "px" } as CSSProperties}
    >
      <style>{customCss}</style>
      {view.freeform?.base === "flow" && (
        <style>{`@media print{@page{size:${(paperWidth * 25.4) / 96}mm ${(paperHeight * 25.4) / 96}mm;margin:0}html,body,#root,.studio,.workbench,.preview-panel,.paper-workspace,.page-frame{width:${(paperWidth * 25.4) / 96}mm!important}.page-frame{height:${(paperHeight * 25.4) / 96}mm!important}}`}</style>
      )}
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
            DiyJobResume<small>让简历回归本源</small>
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
                <button
                  onClick={() => createDoc("blank")}
                  title="新建一份空白简历"
                >
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
          <button
            className="icon-button theme-toggle"
            aria-label="夜间模式"
            aria-pressed={dark}
            title={dark ? "切换日间模式" : "切换夜间模式"}
            onClick={() => setDark((value) => !value)}
          >
            <SunMoon size={20} />
          </button>
          <a
            className="icon-button github-link"
            href="https://github.com/Xiaoc7r/DiyJobResume"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub 仓库"
            aria-label="GitHub 仓库"
          >
            <Github size={20} />
          </a>
          <div className="contact-wrap">
            <button
              className="icon-button"
              title="联系方式"
              aria-label="联系方式"
              aria-expanded={contactOpen}
              onClick={() => setContactOpen(!contactOpen)}
            >
              <Mail size={19} />
            </button>
            {contactOpen && (
              <div className="contact-popover">
                <span>联系炒肉多</span>
                <a href="mailto:xxiaocr@gmail.com">xxiaocr@gmail.com</a>
              </div>
            )}
          </div>

          <button
            className="icon-button agent-mode"
            title="打开 AI 排版助手：用一句话让它调排版"
            aria-label="排版助手"
            aria-pressed={agentOpen}
            onClick={() => {
              freeApi.current?.flush();
              setMobile("library");
              if (agentOpen) {
                setAgentOpen(false);
                setLibraryOpen(true);
              } else {
                setAgentOpen(true);
                setLibraryOpen(false);
              }
            }}
          >
            <Sparkles size={18} />
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
                    freeApi.current?.flush();
                    saveFile(
                      doc.name + ".json",
                      JSON.stringify(ref.current, null, 2),
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
                    saveFile(doc.name + "-板块稿.md", source, "text/markdown");
                    setFileMenu(false);
                  }}
                >
                  <Download size={15} />
                  导出板块稿 Markdown
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
            disabled={exportBusy}
            onClick={async () => {
              if (mode === "free") {
                await freeApi.current?.print();
                return;
              }
              if (exportLock.current) return;
              exportLock.current = true;
              setExportBusy(true);
              try {
                (document.activeElement as HTMLElement)?.blur();
                cancelPreview();
                await new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                );
                if (ref.current.freeform?.base === "flow") {
                  const { sceneSvg } = await import("./freeScene");
                  await Promise.all(
                    ref.current.freeform.pages.flatMap((p) => [
                      sceneSvg(p, "background"),
                      sceneSvg(p, "foreground"),
                    ]),
                  );
                }
                let timeout: ReturnType<typeof setTimeout> | undefined;
                const fontsReady = await Promise.race([
                  document.fonts.ready.then(() => true),
                  new Promise<boolean>((resolve) => {
                    timeout = setTimeout(() => resolve(false), 5000);
                  }),
                ]);
                clearTimeout(timeout);
                await new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                );
                const root = workspace.current;
                const issues = checkContent(
                  ref.current,
                  root?.querySelectorAll(".resume-paper").length ?? 1,
                );
                if (root) issues.push(...checkRendered(root));
                if (!fontsReady || document.fonts.status !== "loaded")
                  issues.push({
                    message:
                      "字体仍在加载，导出效果可能与最终排版不同。可稍后重试。",
                  });
                if (issues.length) setExportIssues(issues);
                else window.print();
              } finally {
                exportLock.current = false;
                setExportBusy(false);
              }
            }}
          >
            <Download size={16} />
            {exportBusy ? "准备导出…" : "导出 PDF"}
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
      {!editorOpen && (
        <button
          className="edge-tab edge-left"
          aria-label="展开编辑区"
          title="展开编辑区"
          onClick={() => {
            setEditorOpen(true);
            setMobile("editor");
          }}
        >
          <PanelLeft size={17} />
        </button>
      )}
      {!libraryOpen && !agentOpen && (
        <button
          className="edge-tab edge-right"
          aria-label="展开右侧面板"
          title="展开右侧面板"
          onClick={() => {
            setLibraryOpen(true);
            setMobile("library");
          }}
        >
          <PanelRight size={17} />
        </button>
      )}
      {mode === "free" && doc.freeform ? (
        <Suspense fallback={<FreeLoading />}>
          <FreeStudio
            key={activeId}
            doc={doc}
            apiRef={freeApi}
            onChange={updateFreeform}
            renderPaper={renderPaper}
            sourcePageCount={pages.length}
            onUndo={undo}
            onRedo={redo}
            canUndo={!!past.length}
            canRedo={!!future.length}
            onSourceText={(id, value) => updateLine(id, value)}
            onMode={(next) => {
              freeApi.current?.flush();
              setMode(next);
              setEditorOpen(true);
            }}
            leftOpen={editorOpen}
            rightOpen={libraryOpen || agentOpen}
            onCloseLeft={() => setEditorOpen(false)}
            onCloseRight={() => {
              setLibraryOpen(false);
              setAgentOpen(false);
            }}
            onOpenLeft={() => setEditorOpen(true)}
            onOpenRight={() => setLibraryOpen(true)}
            rightPanel={agentOpen ? renderAgentSide() : undefined}
            onResizeLeft={resizeSidebar}
            onNudgeLeft={(delta) =>
              setLeftWidth((width) =>
                Math.max(260, Math.min(window.innerWidth * 0.6, width + delta)),
              )
            }
            previewZoom={zoom}
            fitPreview={autoZoom}
            onFitZoom={setZoom}
            onFitPreview={() => setAutoZoom(true)}
            onZoomChange={(value) => {
              setAutoZoom(false);
              setZoom(value);
            }}
            onRestore={restoreFreeLayout}
          />
        </Suspense>
      ) : (
        <div className="workbench">
          {editorOpen && (
            <>
              <aside
                className={`editor-panel ${mobile === "editor" ? "mobile-active" : ""}`}
              >
                <div className="editor-heading">
                  <div
                    className="mode-tabs"
                    role="tablist"
                    aria-label="编辑方式"
                  >
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
                      Markdown
                    </button>
                    <button
                      role="tab"
                      aria-selected={false}
                      disabled={freeEntering}
                      onClick={() => {
                        void enterFree();
                      }}
                    >
                      自由模式
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
                {mode === "md" ? (
                  <div className="markdown-pane">
                    <MarkdownNumbers text={source} editor={mdRef} />
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
                        if (mdMarkRef.current)
                          mdMarkRef.current.style.display = "none";
                      }}
                      onKeyUp={(e) => {
                        if (
                          [
                            "ArrowUp",
                            "ArrowDown",
                            "PageUp",
                            "PageDown",
                            "Home",
                            "End",
                          ].includes(e.key)
                        )
                          jumpFromCaret();
                      }}
                      onChange={(e) => {
                        try {
                          historyUpdate(
                            {
                              ...doc,
                              lines: parseMarkdown(e.target.value, doc.lines),
                            },
                            "markdown",
                          );
                        } catch (err) {
                          setNotice((err as Error).message);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div
                    ref={editorRef}
                    className="simple-editor"
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="简单编辑内容"
                    aria-multiline="true"
                    onInput={syncSimple}
                    onKeyDown={simpleKeys}
                    onCompositionStart={() => {
                      simpleComposing.current = true;
                    }}
                    onCompositionEnd={() => {
                      simpleComposing.current = false;
                      syncSimple();
                    }}
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) {
                        e.preventDefault();
                        const row =
                          e.currentTarget.querySelector<HTMLElement>(
                            "[data-simple]:last-child",
                          ) ||
                          [
                            ...e.currentTarget.querySelectorAll<HTMLElement>(
                              "[data-simple]",
                            ),
                          ].at(-1);
                        if (row) {
                          row.focus();
                          placeCursor(row, row.textContent?.length || 0);
                        }
                      }
                    }}
                  >
                    {(doc.lines.some((l) => l.kind !== "blank")
                      ? doc.lines.filter((l) => l.kind !== "blank")
                      : [{ ...doc.lines[0], kind: "text" as Kind }]
                    ).map((line, index) => (
                      <div
                        key={line.id}
                        data-field={line.id}
                        className={`edit-field field-${line.kind} ${selected === line.id ? "active" : ""} ${hovered === line.id ? "hovered" : ""} ${flash === line.id ? "flash-line" : ""}`}
                        onMouseEnter={() => setHovered(line.id)}
                        onMouseLeave={() => setHovered("")}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button"))
                            return;
                          setSelected(line.id);
                          scrollPaperTo(line.id);
                        }}
                        onPointerDown={(e) =>
                          holdDrag(
                            e,
                            line.id,
                            (target, after) =>
                              dropLineAt(line.id, target, after),
                            350,
                            blockAllow(line.id),
                          )
                        }
                      >
                        <div className="block-gutter" contentEditable={false}>
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
                          onEnter={() => splitSimple(line.id)}
                          onSlash={() => openBlockMenu(line.id)}
                          onBackspace={() => backspaceLine(line.id)}
                        />
                      </div>
                    ))}
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
                    setLeftWidth((w) =>
                      Math.min(window.innerWidth * 0.6, w + 20),
                    );
                }}
              >
                <GripVertical size={12} />
              </div>
            </>
          )}
          <main
            className={`preview-panel ${mobile === "preview" ? "mobile-active" : ""}`}
          >
            {freeEntering && <FreeLoading overlay />}
            <div className="preview-toolbar">
              <PreviewZoom
                value={zoom}
                onChange={(value) => {
                  setAutoZoom(false);
                  setZoom(value);
                }}
                onFit={() => setAutoZoom(true)}
              />
              <div className="format-toolbar">
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
                <button
                  title="上传证件照"
                  aria-label="上传证件照"
                  onClick={() => setUploadKind("证件照")}
                >
                  <ImagePlus size={17} />
                </button>
                <button
                  title="上传校徽"
                  aria-label="上传校徽"
                  onClick={() => setUploadKind("校徽")}
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
                <button
                  title="间距与字号"
                  aria-label="间距与字号"
                  onClick={() => setModal("type")}
                >
                  <SlidersHorizontal size={17} />
                </button>
                <ColorControl
                  label="正文"
                  value={doc.settings.color}
                  defaultValue="#171717"
                  onChange={(color) => settings({ color })}
                />
                <ColorControl
                  label="主题"
                  value={doc.settings.accent}
                  defaultValue={currentTemplate.color}
                  presets
                  onChange={(accent) => settings({ accent })}
                />
                <i />
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
              </div>
            </div>
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
              {Array.from(
                {
                  length: Math.max(
                    pages.length,
                    view.freeform?.base === "flow"
                      ? view.freeform.pages.length
                      : 0,
                  ),
                },
                (_, page) => (
                  <div
                    className="page-frame"
                    key={page}
                    style={{
                      width: paperWidth * zoom,
                      height: paperHeight * zoom,
                    }}
                  >
                    <span className="page-caption">第 {page + 1} 页</span>
                    {renderPaper(page, zoom)}
                  </div>
                ),
              )}
            </div>
          </main>
          {agentOpen
            ? renderAgentSide()
            : libraryOpen && (
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
                  </div>
                  <div
                    className="library-tabs"
                    role="tablist"
                    aria-label="模板与内容"
                  >
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
                            onClick={() =>
                              t.id === "blank"
                                ? createDoc("blank", "blank")
                                : historyUpdate(applyTemplate(doc, t.id))
                            }
                          >
                            <div
                              className={`mini-paper mini-${t.id}`}
                              style={
                                { "--mini-accent": t.color } as CSSProperties
                              }
                            >
                              {t.id !== "blank" && (
                                <>
                                  <strong>炒肉多</strong>
                                  <small>
                                    138 0000 2468 | xxiaocr@gmail.com
                                  </small>
                                  {[
                                    "教育背景",
                                    "实习经历",
                                    "项目经历",
                                    "专业技能",
                                  ].map((s, i) => (
                                    <div key={s}>
                                      <b>{s}</b>
                                      <span />
                                      <span />
                                      <span className={i === 1 ? "long" : ""} />
                                    </div>
                                  ))}
                                </>
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
                          {doc.template === "blank"
                            ? "清空当前白板"
                            : "载入当前模板示例"}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="current-style">
                          <span style={{ background: doc.settings.accent }} />
                          {currentTemplate.name}
                          <small>所有新增内容沿用这套风格</small>
                        </div>
                        <section className="module-group">
                          <button
                            className="custom-section"
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
                              if (window.innerWidth <= 900)
                                setMobile("preview");
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
                            <Plus size={18} />
                            添加自定义板块
                          </button>
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
                                  if (window.innerWidth <= 900)
                                    setMobile("preview");
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
                                    {v.description ||
                                      (module.name === "专业技能"
                                        ? "同一风格，不同表达方式"
                                        : `预览加入「${module.name}」末尾`)}
                                  </small>
                                  {v.description && (
                                    <small className="block-destination">
                                      悬停看效果 · 单击固定 · 双击加入
                                    </small>
                                  )}
                                </span>
                                <Plus size={16} />
                              </button>
                            ))}
                          </section>
                        ))}
                      </>
                    )}
                  </div>
                </aside>
              )}
        </div>
      )}
      {mode !== "free" && (
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
      )}
      <div ref={markWord} className="caret-word" aria-hidden="true" />
      <div ref={markBar} className="caret-bar" aria-hidden="true" />
      <div ref={mdMarkRef} className="md-line-mark" aria-hidden="true" />
      <SelectionTools
        lines={doc.lines}
        onRichChange={syncSimple}
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
          width: paperWidth - view.settings.left - view.settings.right,
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
      {exportIssues && (
        <ExportReview
          issues={exportIssues}
          onClose={() => setExportIssues(null)}
          onLocate={(issue) => {
            setExportIssues(null);
            setMobile("preview");
            if (issue.lineId) setSelected(issue.lineId);
            requestAnimationFrame(() => {
              const selector = issue.lineId
                ? `[data-line="${CSS.escape(issue.lineId)}"]`
                : `[data-page="${Math.min(issue.page ?? 0, pages.length - 1)}"]`;
              workspace.current
                ?.querySelector(selector)
                ?.scrollIntoView({ block: "center", behavior: "smooth" });
            });
          }}
          onContinue={() => {
            setExportIssues(null);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => window.print()),
            );
          }}
        />
      )}
      {uploadKind && (
        <ImageUploadDialog
          kind={uploadKind}
          current={doc.pictures.find((p) => p.label.includes(uploadKind))?.src}
          onClose={() => setUploadKind(null)}
          onConfirm={(src) => {
            const current = ref.current,
              picture = current.pictures.find((p) =>
                p.label.includes(uploadKind),
              );
            if (!picture && current.pictures.length >= 10)
              throw new Error("一份简历最多放置 10 张图片。");
            historyUpdate({
              ...current,
              pictures: picture
                ? current.pictures.map((p) =>
                    p.id === picture.id ? { ...p, src } : p,
                  )
                : [
                    ...current.pictures,
                    {
                      id: uid(),
                      label: uploadKind,
                      src,
                      page: 0,
                      x:
                        uploadKind === "证件照"
                          ? Math.max(
                              0,
                              paperWidth - current.settings.right - 72,
                            )
                          : current.settings.left,
                      y: 20,
                      w: uploadKind === "证件照" ? 72 : 60,
                      h: uploadKind === "证件照" ? 96 : 60,
                    },
                  ],
            });
          }}
        />
      )}
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
                <h2>{modal === "type" ? "间距与字号" : "这个网站怎么用"}</h2>
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
                  <label className="number-label">
                    <span>字体</span>{" "}
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
                  </label>
                </div>
                <button className="primary" onClick={() => setModal(null)}>
                  完成调整
                </button>
              </>
            ) : (
              <div className="help-body">
                <p>
                  <b>1. 界面分三栏：</b>左边写内容，中间看效果，右边调样式。
                  顶栏的「编辑区」「简历样式」「AI
                  排版」控制这三栏：点一下收起，再点展开；
                  两栏之间的竖线可以左右拖动改宽度。右边「简历样式」和「AI
                  排版」是互斥的， 打开一个会自动关掉另一个。
                </p>
                <p>
                  <b>2. 多份简历：</b>顶栏简历名称右边的 <b>▾</b>{" "}
                  打开「我的简历」：新建空白、
                  复制当前这份、删除当前这份（会问一次，且至少保留一份）。
                  每份简历的撤销记录和 AI
                  对话各自独立；以前只存过一份的草稿会自动收进列表。
                </p>
                <p>
                  <b>3. 写内容（左栏）：</b>
                  默认「直接编辑」，点任意一行就能改；选中文字会浮出格式工具（加粗、斜体、
                  下划线、标签、链接）。<code>Enter</code> 新增下一段，
                  <code>
                    Shift+Enter
                  </code> 行内换行。鼠标移到某行，左边会出现 <b>+</b>，
                  从模块库插入板块或条目；在文字上长按约 0.4 秒可以拖动排序
                  （拖板块标题会带着整段内容走）。 需要大段替换时，切到 Markdown
                  看/改整篇源码。
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
                  纸张就是
                  A4（794×1123px），缩放只改显示大小、不改变排版，所以预览和导出
                  PDF 一致。 内容变多会自动续页，单条太长会切到下一页继续。
                  工具栏的图片按钮可以上传照片或校徽，拖到合适位置，右下角拉大小。
                </p>
                <p>
                  <b>7. 撤销与保存：</b>
                  顶栏 <b>↶ ↷</b> 或 <code>Ctrl+Z</code> /{" "}
                  <code>Ctrl+Shift+Z</code>， 最多 60
                  步，连续打字会合并成一步。改动会自动存到本机浏览器，
                  顶栏右侧显示「已保存到本机」。
                </p>
                <p>
                  <b>8. AI 排版（对话）：</b>
                  点顶栏「AI
                  排版」打开助手。首次使用先填三项参数，点「测试连接」、
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
                  「导出 PDF」打开打印窗口，选“另存为 PDF”，A4、100%
                  缩放、关闭页眉页脚、 勾选背景图形。「文件」菜单可下载 JSON
                  备份、导出 Markdown、导入备份或 Markdown； 导入 JSON
                  会新增一份简历，不会覆盖当前这份。
                </p>
                <p className="muted">
                  <b>数据存在哪：</b>
                  全部保存在这台电脑的浏览器本地，没有账号、不上传。清除浏览器数据、
                  换浏览器或换设备都会看不到；照片以 base64
                  存在简历里，浏览器容量约 5MB，
                  放多张大图可能保存失败。重要版本请下载 JSON 备份。
                </p>
                <p className="muted">
                  <b>联网范围：</b>
                  只有「AI
                  排版」会联网——点发送时把排版参数、板块标题和简历正文发到你填的接口。
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
