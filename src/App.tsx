import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Award,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  GripVertical,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Maximize2,
  Minus,
  MousePointer2,
  Move,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  Shapes,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  PAGE,
  STORAGE_KEY,
  accents,
  addBlock,
  arrange,
  constrain,
  createBlock,
  historyReducer,
  initialResume,
  labels,
  loadResume,
  parseResume,
  templateInfo,
  uid,
} from "./model";
import type { Block, Font, Kind, Resume, Variant } from "./model";

const kindIcons: Record<Kind, typeof Type> = {
  header: UserRound,
  education: BookOpen,
  experience: BriefcaseBusiness,
  project: Layers,
  skills: Sparkles,
  awards: Award,
  text: Type,
  divider: Minus,
  shape: Square,
  image: ImagePlus,
};
const contentKinds: Kind[] = [
  "header",
  "education",
  "experience",
  "project",
  "skills",
  "awards",
];
const variantLabels: Record<Variant, string> = {
  minimal: "留白",
  line: "线条",
  soft: "柔和",
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function MiniResume({ template = "linen" }: { template?: string }) {
  return (
    <div className={`mini-resume mini-${template}`} aria-hidden="true">
      <div className="mini-head">
        <i />
        <span />
        <span />
      </div>
      <div className="mini-columns">
        <div>
          {[0, 1, 2].map((i) => (
            <div className="mini-section" key={i}>
              <b />
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
        <div>
          {[0, 1].map((i) => (
            <div className="mini-section" key={i}>
              <b />
              <span />
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function BlockContent({
  block: b,
  editing,
  onPatch,
}: {
  block: Block;
  editing: boolean;
  onPatch: (patch: Partial<Block>) => void;
}) {
  const editable = (field: "title" | "subtitle" | "meta" | "body") => ({
    contentEditable: editing,
    suppressContentEditableWarning: true,
    onPaste: (e: React.ClipboardEvent<HTMLElement>) => {
      e.preventDefault();
      document.execCommand(
        "insertText",
        false,
        e.clipboardData.getData("text/plain"),
      );
    },
    "aria-label": `${labels[b.kind]}${field === "title" ? "标题" : field === "body" ? "内容" : field === "meta" ? "时间" : "副标题"}`,
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const next = e.currentTarget.innerText;
      if (next !== b[field]) onPatch({ [field]: next });
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      e.stopPropagation();
      if (e.key === "Escape") e.currentTarget.blur();
    },
  });
  if (b.kind === "image")
    return b.image ? (
      <img
        className="user-image"
        src={b.image}
        alt={b.title || "简历图片"}
        draggable={false}
      />
    ) : (
      <div className="image-placeholder">
        <UserRound size={28} />
        <span>添加照片</span>
      </div>
    );
  if (b.kind === "shape") return <div className="shape-content" />;
  if (b.kind === "divider") return <div className="divider-content" />;
  if (b.kind === "header")
    return (
      <div className="header-content">
        <div className="resume-name" {...editable("title")}>
          {b.title}
        </div>
        <div className="resume-role" {...editable("subtitle")}>
          {b.subtitle}
        </div>
        <div className="resume-contact" {...editable("body")}>
          {b.body}
        </div>
      </div>
    );
  return (
    <>
      <div className="section-heading" {...editable("title")}>
        {b.title}
      </div>
      {(b.subtitle || b.meta || editing) && (
        <div className="entry-heading">
          <div className="entry-subtitle" {...editable("subtitle")}>
            {b.subtitle}
          </div>
          <div className="entry-date" {...editable("meta")}>
            {b.meta}
          </div>
        </div>
      )}
      <div className="entry-body" {...editable("body")}>
        {b.body}
      </div>
    </>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function App() {
  const [initial] = useState(loadResume);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.doc,
    future: [],
    timestamp: 0,
  });
  const doc = history.present;
  const docRef = useRef(doc);
  docRef.current = doc;
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [tab, setTab] = useState<"templates" | "blocks" | "layers">(
    "templates",
  );
  const [libraryKind, setLibraryKind] = useState<Kind>("experience");
  const [free, setFree] = useState(false);
  const [zoom, setZoom] = useState(0.68);
  const [saved, setSaved] = useState<"saving" | "saved" | "error">("saving");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"help" | "export" | "new" | null>(null);
  const [menu, setMenu] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<
    "library" | "properties" | null
  >(null);
  const [overflows, setOverflows] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const photoTarget = useRef<string | null>(null);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    block: Block;
    resize: boolean;
  } | null>(null);
  const pendingLayout = useRef(false);
  const active = doc.blocks.find((b) => b.id === selected);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  };
  const setDoc = (next: Resume, group?: string, record = true) =>
    dispatch({ type: "set", doc: next, group, record });
  const patchBlock = (id: string, patch: Partial<Block>, group?: string) => {
    const current = docRef.current;
    setDoc(
      {
        ...current,
        blocks: current.blocks.map((b) =>
          b.id === id ? constrain({ ...b, ...patch }) : b,
        ),
      },
      group,
    );
  };
  const patchSelected = (patch: Partial<Block>, group?: string) => {
    if (selected) patchBlock(selected, patch, group);
  };
  const fit = () => {
    if (viewportRef.current)
      setZoom(
        clamp((viewportRef.current.clientWidth - 96) / PAGE.width, 0.35, 1),
      );
  };
  useEffect(() => {
    fit();
  }, []);
  useEffect(() => {
    if (initial.recovered) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) localStorage.setItem(`${STORAGE_KEY}.recovery`, raw);
      } catch {
        /* Preserve a visible warning if storage is unavailable. */
      }
      notify("旧草稿暂时无法读取，已打开示例。你可以尝试导入之前的备份。");
    }
    return () => clearTimeout(toastTimer.current);
  }, [initial.recovered]);
  useEffect(() => {
    setSaved("saving");
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
        setSaved("saved");
      } catch {
        setSaved("error");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [doc]);
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(docRef.current));
      } catch {
        /* The on-screen save status provides recovery guidance. */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (pendingLayout.current) {
        pendingLayout.current = false;
        const measured = doc.blocks.map((b) => {
          if (["image", "shape", "divider"].includes(b.kind)) return b;
          const el = document.getElementById(`content-${b.id}`);
          if (!el) return b;
          const top = el.getBoundingClientRect().top;
          const children =
            b.kind === "header"
              ? [...(el.querySelector(".header-content")?.children ?? [])]
              : [...el.children];
          const bottom = Math.max(
            top,
            ...children.map((c) => c.getBoundingClientRect().bottom),
          );
          return {
            ...b,
            h: Math.min(
              PAGE.height - 96,
              Math.ceil((bottom - top) / zoom) + (b.kind === "header" ? 20 : 8),
            ),
          };
        });
        setDoc(arrange({ ...doc, blocks: measured }), undefined, false);
        return;
      }
      const ids = doc.blocks
        .filter((b) => {
          const el = document.getElementById(`content-${b.id}`);
          return (
            el &&
            b.kind !== "shape" &&
            b.kind !== "divider" &&
            b.kind !== "image" &&
            (el.scrollHeight > el.clientHeight + 3 ||
              el.scrollWidth > el.clientWidth + 3)
          );
        })
        .map((b) => b.id);
      setOverflows(ids);
    });
    return () => cancelAnimationFrame(raf);
  }, [doc, editing]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setMenu(false);
        setEditing(null);
        setMobilePanel(null);
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,[contenteditable="true"],select'))
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const current = docRef.current;
        setDoc({
          ...current,
          blocks: current.blocks.filter((b) => b.id !== selected),
        });
        setSelected(null);
        return;
      }
      if (
        free &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const b = docRef.current.blocks.find((b) => b.id === selected);
        if (!b) return;
        const d = e.shiftKey ? 10 : 1;
        patchBlock(
          b.id,
          {
            x:
              b.x +
              (e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0),
            y: b.y + (e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0),
          },
          `nudge-${b.id}`,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, free]);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / zoom,
        dy = (e.clientY - d.startY) / zoom;
      const snap = (v: number) => (e.altKey ? v : Math.round(v / 4) * 4);
      const patch = d.resize
        ? { w: snap(d.block.w + dx), h: snap(d.block.h + dy) }
        : { x: snap(d.block.x + dx), y: snap(d.block.y + dy) };
      const next = constrain({ ...d.block, ...patch });
      const current = docRef.current;
      setDoc(
        {
          ...current,
          blocks: current.blocks.map((b) => (b.id === d.id ? next : b)),
        },
        undefined,
        false,
      );
    };
    const end = () => {
      drag.current = null;
      document.body.classList.remove("dragging");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [zoom]);
  const startDrag = (e: ReactPointerEvent, b: Block, resize = false) => {
    if (!free || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(b.id);
    setEditing(null);
    dispatch({ type: "checkpoint" });
    drag.current = {
      id: b.id,
      startX: e.clientX,
      startY: e.clientY,
      block: { ...b },
      resize,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add("dragging");
  };
  const insert = (kind: Kind, variant: Variant = "minimal") => {
    const b = createBlock(kind, variant);
    if (docRef.current.pages >= 20) {
      notify("这份简历已经有 20 页了，请先整理内容。");
      return;
    }
    if (docRef.current.blocks.length >= 100) {
      notify("这份简历最多放入 100 个模块。");
      return;
    }
    const next = addBlock(docRef.current, b);
    setDoc(next);
    setSelected(b.id);
    setMobilePanel(null);
    setEditing(null);
    notify(`已添加${labels[kind]}，点击右侧就能修改`);
    setTimeout(
      () =>
        document
          .getElementById(`block-${b.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      80,
    );
  };
  const duplicate = () => {
    if (!active) return;
    if (doc.blocks.length >= 100) {
      notify("最多添加 100 个模块");
      return;
    }
    const b = constrain({
      ...active,
      id: uid(),
      x: active.x + 16,
      y: active.y + 16,
    });
    setDoc({ ...doc, blocks: [...doc.blocks, b] });
    setSelected(b.id);
    notify("已复制这个模块");
  };
  const remove = () => {
    if (!active) return;
    setDoc({ ...doc, blocks: doc.blocks.filter((b) => b.id !== active.id) });
    setSelected(null);
    setEditing(null);
    notify("已移除模块，可以撤销");
  };
  const tidy = () => {
    pendingLayout.current = true;
    setEditing(null);
    setDoc(arrange(docRef.current));
    notify("已整理好间距与位置，内容没有改变");
  };
  const applyTemplate = (id: string) => {
    const next = arrange(doc, id);
    next.accent = templateInfo.find((t) => t.id === id)!.accent;
    pendingLayout.current = true;
    setDoc(next);
    setEditing(null);
    notify("已换好版式，你填写的内容都还在");
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(docRef.current, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docRef.current.name.replace(/[\\/:*?"<>|]/g, "-")}.resume.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("备份已下载，下次可以继续编辑");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      notify("备份文件太大，请选择 8 MB 以内的文件");
      return;
    }
    try {
      const next = parseResume(JSON.parse(await file.text()));
      setDoc(next);
      setSelected(null);
      setEditing(null);
      notify("简历已导入，可以继续编辑；原内容可撤销恢复");
    } catch (e) {
      notify(e instanceof Error ? e.message : "导入失败，请选择本站导出的备份");
    }
  };
  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1.5 * 1024 * 1024
    ) {
      notify("请选择 1.5 MB 以内的 JPG、PNG 或 WebP 图片");
      return;
    }
    const image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!image) {
      notify("图片读取失败，请重新选择");
      return;
    }
    if (photoTarget.current) {
      patchBlock(photoTarget.current, { image });
    } else {
      if (docRef.current.blocks.length >= 100) {
        notify("最多添加 100 个模块");
        return;
      }
      const b = { ...createBlock("image"), image, x: 650, y: 48, page: 0 };
      setDoc({ ...docRef.current, blocks: [...docRef.current.blocks, b] });
      setSelected(b.id);
    }
    photoTarget.current = null;
    notify("图片已添加，仅保存在你的浏览器");
  };
  const adaptHeight = () => {
    if (!active) return;
    const el = document.getElementById(`content-${active.id}`);
    if (!el) return;
    patchSelected({ h: Math.ceil(el.scrollHeight) + 4 });
    notify("已按内容调整高度，可用「一键整理」重新排列");
  };
  const print = async () => {
    (document.activeElement as HTMLElement)?.blur();
    setEditing(null);
    setSelected(null);
    setModal(null);
    await document.fonts.ready;
    const previous = document.title;
    document.title = docRef.current.name;
    // Let React remove selection UI before opening the native PDF / print dialog.
    setTimeout(() => {
      window.print();
      document.title = previous;
    }, 150);
  };
  const reorder = (id: string, direction: number) => {
    const index = doc.blocks.findIndex((b) => b.id === id);
    const target = index + direction;
    if (target < 0 || target >= doc.blocks.length) return;
    const blocks = [...doc.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    setDoc({ ...doc, blocks });
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="./" aria-label="简历工坊首页">
          <span className="brand-mark">
            <Sparkles size={22} />
          </span>
          <span>
            简历工坊<small>DIY JOB RESUME</small>
          </span>
        </a>
        <div className="document-bar">
          <span className="bar-divider" />
          <input
            aria-label="简历名称"
            value={doc.name}
            onChange={(e) =>
              setDoc({ ...doc, name: e.target.value.slice(0, 100) }, "name")
            }
          />
          <span
            className={`save-indicator ${saved === "error" ? "error" : ""}`}
          >
            {saved === "saved" ? (
              <CheckCheck size={14} />
            ) : (
              <span className="status-dot" />
            )}
            {saved === "saved"
              ? "已保存到本机"
              : saved === "saving"
                ? "保存中…"
                : "保存失败，请下载备份"}
          </span>
        </div>
        <div className="top-actions">
          <IconButton label="使用帮助" onClick={() => setModal("help")}>
            <CircleHelp size={19} />
          </IconButton>
          <div className="file-menu">
            <button
              className="button subtle"
              aria-label="文件"
              onClick={() => setMenu(!menu)}
            >
              <FolderOpen size={16} />
              <span>文件</span>
              <ChevronDown size={14} />
            </button>
            {menu && (
              <>
                <button
                  className="menu-backdrop"
                  aria-label="关闭文件菜单"
                  onClick={() => setMenu(false)}
                />
                <div className="dropdown">
                  <button
                    onClick={() => {
                      setMenu(false);
                      download();
                    }}
                  >
                    <Download size={16} />
                    下载可编辑备份
                  </button>
                  <button
                    onClick={() => {
                      setMenu(false);
                      importRef.current?.click();
                    }}
                  >
                    <FolderOpen size={16} />
                    导入简历备份
                  </button>
                  <button
                    onClick={() => {
                      setMenu(false);
                      setModal("new");
                    }}
                  >
                    <FilePlus2 size={16} />
                    开始一份新简历
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            className="button primary export-button"
            onClick={() => setModal("export")}
          >
            <Download size={16} />
            <span>导出简历</span>
          </button>
        </div>
      </header>
      <div className="workspace">
        {mobilePanel && (
          <button
            className="panel-backdrop"
            aria-label="关闭面板"
            onClick={() => setMobilePanel(null)}
          />
        )}
        <aside
          className={`library panel ${mobilePanel === "library" ? "mobile-open" : ""}`}
        >
          <div className="sidebar-intro">
            <div className="eyebrow">A LITTLE STRUCTURE. ALL YOU.</div>
            <h1>
              好简历，从这里开始<span>。</span>
            </h1>
            <p>选个喜欢的，再把它变成你的。</p>
            <button
              className="mobile-close icon-button"
              aria-label="关闭模块库"
              onClick={() => setMobilePanel(null)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="tabs" role="tablist" aria-label="素材库">
            <button
              role="tab"
              aria-selected={tab === "templates"}
              className={tab === "templates" ? "selected" : ""}
              onClick={() => setTab("templates")}
            >
              <LayoutTemplate size={15} />
              整套模板
            </button>
            <button
              role="tab"
              aria-selected={tab === "blocks"}
              className={tab === "blocks" ? "selected" : ""}
              onClick={() => setTab("blocks")}
            >
              <Shapes size={15} />
              拼模块
            </button>
            <button
              role="tab"
              aria-selected={tab === "layers"}
              className={tab === "layers" ? "selected" : ""}
              onClick={() => setTab("layers")}
            >
              <Layers size={15} />
              图层
            </button>
          </div>
          <div className="library-scroll">
            {tab === "templates" && (
              <>
                <div className="section-label">
                  一个起点，无数种可能 <span>03</span>
                </div>
                <div className="template-list">
                  {templateInfo.map((t, i) => (
                    <button
                      key={t.id}
                      className={`template-card ${doc.template === t.id ? "chosen" : ""}`}
                      onClick={() => applyTemplate(t.id)}
                      aria-label={`使用${t.name}模板`}
                    >
                      <div className={`template-cover cover-${t.id}`}>
                        <span className="template-number">0{i + 1}</span>
                        <MiniResume template={t.id} />
                        <span className="template-tag">{t.tag}</span>
                        {doc.template === t.id && (
                          <span className="template-check">
                            <Check size={13} />
                          </span>
                        )}
                      </div>
                      <div className="template-caption">
                        <strong>{t.name}</strong>
                        <ArrowUpRight size={15} />
                        <p>{t.detail}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="library-note">
                  <ShieldCheck size={17} />
                  <p>
                    放心尝试不同模板
                    <br />
                    <span>已经写好的内容会完整保留。</span>
                  </p>
                </div>
              </>
            )}
            {tab === "blocks" && (
              <>
                <div className="section-label">像搭积木一样，拼出你的经历</div>
                <div className="kind-grid">
                  {contentKinds.map((kind) => {
                    const Icon = kindIcons[kind];
                    return (
                      <button
                        key={kind}
                        className={libraryKind === kind ? "selected" : ""}
                        onClick={() => setLibraryKind(kind)}
                      >
                        <Icon size={18} />
                        {labels[kind]}
                      </button>
                    );
                  })}
                </div>
                <div className="section-label module-heading">
                  {labels[libraryKind]} <span>选择一种样式</span>
                </div>
                {(["minimal", "line", "soft"] as Variant[]).map((v) => (
                  <button
                    className={`module-card module-${v}`}
                    key={v}
                    onClick={() => insert(libraryKind, v)}
                    aria-label={`添加${variantLabels[v]}${labels[libraryKind]}`}
                  >
                    <div className="module-sample">
                      <strong>{labels[libraryKind]}</strong>
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="module-caption">
                      {variantLabels[v]}样式 <Plus size={16} />
                    </div>
                  </button>
                ))}
                <div className="section-label module-heading">再加一点个性</div>
                <div className="extras-grid">
                  <button onClick={() => insert("text")}>
                    <Type size={18} />
                    自由文本
                  </button>
                  <button
                    onClick={() => {
                      photoTarget.current = null;
                      imageRef.current?.click();
                    }}
                  >
                    <ImagePlus size={18} />
                    照片图片
                  </button>
                  <button
                    onClick={() => {
                      insert("shape");
                      setFree(true);
                    }}
                  >
                    <Square size={18} />
                    装饰色块
                  </button>
                  <button onClick={() => insert("divider")}>
                    <Minus size={18} />
                    分割线
                  </button>
                </div>
              </>
            )}
            {tab === "layers" && (
              <>
                <div className="section-label">
                  每一个模块，都在这里 <span>{doc.blocks.length}</span>
                </div>
                <p className="panel-tip">
                  点击定位模块。上下调整图层，点击「一键整理」可按此顺序重新排版。
                </p>
                <div className="layer-list">
                  {doc.blocks.map((b) => {
                    const Icon = kindIcons[b.kind];
                    return (
                      <div
                        key={b.id}
                        className={`layer-row ${selected === b.id ? "selected" : ""}`}
                      >
                        <button
                          className="layer-select"
                          onClick={() => {
                            setSelected(b.id);
                            document
                              .getElementById(`block-${b.id}`)
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                          }}
                        >
                          <Icon size={16} />
                          <span>
                            {b.title || labels[b.kind]}
                            <small>
                              第 {b.page + 1} 页 · {labels[b.kind]}
                            </small>
                          </span>
                        </button>
                        <div className="layer-actions">
                          <IconButton
                            label={`上移${b.title}`}
                            onClick={() => reorder(b.id, -1)}
                          >
                            <ArrowUp size={13} />
                          </IconButton>
                          <IconButton
                            label={`下移${b.title}`}
                            onClick={() => reorder(b.id, 1)}
                          >
                            <ArrowDown size={13} />
                          </IconButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="sidebar-footer">
            <span className="tiny-spark">✳</span>
            <span>你的经历，值得被好好看见。</span>
          </div>
        </aside>
        <main className="canvas-area">
          <div className="canvas-toolbar">
            <div className="history-buttons">
              <IconButton
                label="撤销 Ctrl Z"
                disabled={!history.past.length}
                onClick={() => {
                  dispatch({ type: "undo" });
                  setEditing(null);
                }}
              >
                <Undo2 size={17} />
              </IconButton>
              <IconButton
                label="重做 Ctrl Shift Z"
                disabled={!history.future.length}
                onClick={() => {
                  dispatch({ type: "redo" });
                  setEditing(null);
                }}
              >
                <Redo2 size={17} />
              </IconButton>
              <span className="toolbar-separator" />
              <button className="tidy-button" onClick={tidy}>
                <Sparkles size={15} />
                <span>一键整理</span>
              </button>
            </div>
            <div className="mode-switch" aria-label="编辑模式">
              <button
                className={!free ? "selected" : ""}
                onClick={() => setFree(false)}
              >
                <MousePointer2 size={14} />
                轻松编辑
              </button>
              <button
                className={free ? "selected" : ""}
                onClick={() => {
                  setFree(true);
                  setEditing(null);
                }}
              >
                <Move size={14} />
                自由排版
              </button>
            </div>
            <div className="canvas-paper-info">
              A4 <span>·</span> {doc.pages} 页
            </div>
          </div>
          <div
            className="canvas-scroll"
            ref={viewportRef}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelected(null);
                setEditing(null);
              }
            }}
          >
            <div className="canvas-intro">
              <span className="canvas-intro-mark">
                <Sparkles size={15} />
              </span>
              <span>
                {free
                  ? "拖动模块和右下角，排出你想要的样子"
                  : "点击模块改内容，双击文字直接写"}
              </span>
              <span className="demo-label">示例内容 · 请替换为你的经历</span>
            </div>
            {Array.from({ length: doc.pages }, (_, page) => (
              <div
                className="page-wrap"
                key={page}
                style={{ width: PAGE.width * zoom, height: PAGE.height * zoom }}
              >
                <div className="page-index">
                  {String(page + 1).padStart(2, "0")}{" "}
                  <span>/ {String(doc.pages).padStart(2, "0")}</span>
                </div>
                <div
                  className={`paper font-${doc.font} ${free ? "free-mode" : ""}`}
                  data-page={page}
                  style={
                    {
                      width: PAGE.width,
                      height: PAGE.height,
                      transform: `scale(${zoom})`,
                      "--resume-accent": doc.accent,
                    } as CSSProperties
                  }
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelected(null);
                      setEditing(null);
                    }
                  }}
                >
                  {doc.blocks
                    .filter((b) => b.page === page)
                    .map((b) => (
                      <div
                        key={b.id}
                        id={`block-${b.id}`}
                        tabIndex={0}
                        role="group"
                        aria-label={`${labels[b.kind]}模块：${b.title}`}
                        className={`resume-block block-${b.kind} variant-${b.variant} ${selected === b.id ? "is-selected" : ""} ${editing === b.id ? "is-editing" : ""} ${overflows.includes(b.id) ? "is-overflow" : ""}`}
                        style={
                          {
                            left: b.x,
                            top: b.y,
                            width: b.w,
                            height: b.h,
                            color: b.color,
                            background: b.fill,
                            borderRadius: b.radius,
                            fontSize: b.fontSize,
                            lineHeight: b.lineHeight,
                            textAlign: b.align,
                          } as CSSProperties
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(b.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelected(b.id);
                          if (b.kind === "image") {
                            photoTarget.current = b.id;
                            imageRef.current?.click();
                          } else setEditing(b.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setSelected(b.id);
                            setEditing(b.id);
                          }
                        }}
                        onPointerDown={(e) => {
                          if (free && editing !== b.id) startDrag(e, b);
                        }}
                      >
                        {selected === b.id && (
                          <div
                            className="block-floating-toolbar"
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <span className="selected-label">
                              {labels[b.kind]}
                            </span>
                            <button
                              title="编辑内容"
                              aria-label="编辑选中模块内容"
                              onClick={() => {
                                setEditing(b.id);
                                setMobilePanel(
                                  window.innerWidth < 1100
                                    ? "properties"
                                    : null,
                                );
                              }}
                            >
                              编辑
                            </button>
                            <button
                              title="复制模块"
                              aria-label="复制选中模块"
                              onClick={duplicate}
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              title="删除模块"
                              aria-label="删除选中模块"
                              onClick={remove}
                            >
                              <Trash2 size={13} />
                            </button>
                            {free && (
                              <button
                                className="drag-handle"
                                title="拖动模块"
                                aria-label="拖动选中模块"
                                onPointerDown={(e) => startDrag(e, b)}
                              >
                                <GripVertical size={15} />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="block-content" id={`content-${b.id}`}>
                          <BlockContent
                            block={b}
                            editing={editing === b.id}
                            onPatch={(patch) => patchBlock(b.id, patch)}
                          />
                        </div>
                        {selected === b.id && free && (
                          <>
                            <span className="corner corner-tl" />
                            <span className="corner corner-tr" />
                            <span className="corner corner-bl" />
                            <button
                              className="resize-handle"
                              title="拖动调整大小"
                              aria-label="调整选中模块大小"
                              onPointerDown={(e) => startDrag(e, b, true)}
                            />
                          </>
                        )}
                        {overflows.includes(b.id) && selected === b.id && (
                          <button
                            className="overflow-badge"
                            onClick={adaptHeight}
                          >
                            内容有点多，自动增高 ↗
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
            <button
              className="add-page"
              disabled={doc.pages >= 20}
              onClick={() => {
                setDoc({ ...doc, pages: doc.pages + 1 });
                notify("已添加一页，可以在右侧把模块移到新页");
              }}
            >
              <Plus size={16} />
              添加一页
            </button>
            <div className="canvas-bottom-note">
              <ShieldCheck size={13} />
              无需登录 · 本机保存 · 自由创作
            </div>
          </div>
          <div className="canvas-bottom-bar">
            <span>
              {overflows.length ? (
                <button
                  className="overflow-status"
                  onClick={() => {
                    const id = overflows[0];
                    setSelected(id);
                    document
                      .getElementById(`block-${id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  有 {overflows.length} 个模块内容溢出，点此检查
                </button>
              ) : (
                <>
                  <span className="status-dot" />
                  一切就绪，慢慢打磨你的下一步。
                </>
              )}
            </span>
            <div className="zoom-controls">
              <IconButton
                label="缩小画布"
                onClick={() => setZoom((z) => clamp(z - 0.1, 0.3, 1.5))}
              >
                <ZoomOut size={16} />
              </IconButton>
              <button className="zoom-value" onClick={fit} title="适应窗口">
                {Math.round(zoom * 100)}%
              </button>
              <IconButton
                label="放大画布"
                onClick={() => setZoom((z) => clamp(z + 0.1, 0.3, 1.5))}
              >
                <ZoomIn size={16} />
              </IconButton>
              <span className="toolbar-separator" />
              <IconButton label="适应窗口" onClick={fit}>
                <Maximize2 size={15} />
              </IconButton>
            </div>
          </div>
        </main>
        <aside
          className={`properties panel ${mobilePanel === "properties" ? "mobile-open" : ""}`}
        >
          <div className="properties-title">
            <span>
              <Settings2 size={17} />
              调整细节
            </span>
            <button
              className="mobile-close icon-button"
              aria-label="关闭属性面板"
              onClick={() => setMobilePanel(null)}
            >
              <X size={18} />
            </button>
            <span className="property-dot" />
          </div>
          <div className="properties-scroll">
            {active ? (
              <>
                <div className="selection-summary">
                  <div className="selection-icon">
                    {(() => {
                      const Icon = kindIcons[active.kind];
                      return <Icon size={21} />;
                    })()}
                  </div>
                  <div>
                    <strong>{labels[active.kind]}</strong>
                    <span>选中的模块 · 第 {active.page + 1} 页</span>
                  </div>
                  <IconButton
                    label="取消选择"
                    onClick={() => {
                      setSelected(null);
                      setEditing(null);
                    }}
                  >
                    <X size={15} />
                  </IconButton>
                </div>
                {!["image", "shape", "divider"].includes(active.kind) && (
                  <div className="property-section">
                    <div className="property-label">
                      写下你的故事 <span>内容</span>
                    </div>
                    <Field
                      label={active.kind === "header" ? "你的名字" : "模块标题"}
                    >
                      <input
                        value={active.title}
                        onChange={(e) =>
                          patchSelected(
                            { title: e.target.value },
                            `${active.id}-title`,
                          )
                        }
                      />
                    </Field>
                    {!["skills", "awards", "text"].includes(active.kind) && (
                      <>
                        <Field
                          label={
                            active.kind === "header"
                              ? "期望职位"
                              : "学校 / 公司 / 项目"
                          }
                        >
                          <input
                            value={active.subtitle}
                            onChange={(e) =>
                              patchSelected(
                                { subtitle: e.target.value },
                                `${active.id}-subtitle`,
                              )
                            }
                          />
                        </Field>
                        {active.kind !== "header" && (
                          <Field label="时间 / 说明">
                            <input
                              value={active.meta}
                              onChange={(e) =>
                                patchSelected(
                                  { meta: e.target.value },
                                  `${active.id}-meta`,
                                )
                              }
                            />
                          </Field>
                        )}
                      </>
                    )}
                    <Field
                      label={
                        active.kind === "header"
                          ? "联系方式"
                          : "内容 · 换行即可分段"
                      }
                    >
                      <textarea
                        rows={active.kind === "header" ? 3 : 7}
                        value={active.body}
                        onChange={(e) =>
                          patchSelected(
                            { body: e.target.value },
                            `${active.id}-body`,
                          )
                        }
                      />
                    </Field>
                    <button
                      className="button full subtle small"
                      onClick={adaptHeight}
                    >
                      <Maximize2 size={14} />
                      高度适应内容
                    </button>
                  </div>
                )}
                {active.kind === "image" && (
                  <div className="property-section">
                    <button
                      className="button full subtle"
                      onClick={() => {
                        photoTarget.current = active.id;
                        imageRef.current?.click();
                      }}
                    >
                      <ImagePlus size={16} />
                      {active.image ? "更换图片" : "上传图片"}
                    </button>
                    <p className="panel-tip">
                      JPG / PNG / WebP，1.5 MB 以内。照片仅保存在本机。
                    </p>
                  </div>
                )}
                <div className="property-section">
                  <div className="property-label">
                    外观 <span>你的风格</span>
                  </div>
                  {!["shape", "divider", "image"].includes(active.kind) && (
                    <>
                      <div className="variant-selector">
                        {(["minimal", "line", "soft"] as Variant[]).map((v) => (
                          <button
                            key={v}
                            className={active.variant === v ? "selected" : ""}
                            onClick={() => patchSelected({ variant: v })}
                          >
                            {variantLabels[v]}
                          </button>
                        ))}
                      </div>
                      <div className="field-row">
                        <Field label="字号">
                          <input
                            type="number"
                            min={9}
                            max={32}
                            value={active.fontSize}
                            onChange={(e) =>
                              patchSelected(
                                {
                                  fontSize: clamp(
                                    Number(e.target.value) || 13,
                                    9,
                                    32,
                                  ),
                                },
                                `${active.id}-font`,
                              )
                            }
                          />
                        </Field>
                        <Field label="行距">
                          <input
                            type="number"
                            step={0.1}
                            min={1}
                            max={2.5}
                            value={active.lineHeight}
                            onChange={(e) =>
                              patchSelected(
                                {
                                  lineHeight: clamp(
                                    Number(e.target.value) || 1.75,
                                    1,
                                    2.5,
                                  ),
                                },
                                `${active.id}-line`,
                              )
                            }
                          />
                        </Field>
                      </div>
                      <Field label="文字对齐">
                        <select
                          value={active.align}
                          onChange={(e) =>
                            patchSelected({
                              align: e.target.value as Block["align"],
                            })
                          }
                        >
                          <option value="left">左对齐</option>
                          <option value="center">居中</option>
                          <option value="right">右对齐</option>
                        </select>
                      </Field>
                      <Field label="文字颜色">
                        <div className="color-input">
                          <input
                            type="color"
                            value={active.color}
                            onChange={(e) =>
                              patchSelected(
                                { color: e.target.value },
                                `${active.id}-color`,
                              )
                            }
                          />
                          <span>{active.color.toUpperCase()}</span>
                        </div>
                      </Field>
                    </>
                  )}
                  <Field label="背景颜色">
                    <div className="color-input">
                      <input
                        type="color"
                        value={
                          active.fill === "transparent"
                            ? "#ffffff"
                            : active.fill
                        }
                        onChange={(e) =>
                          patchSelected(
                            { fill: e.target.value },
                            `${active.id}-fill`,
                          )
                        }
                      />
                      <span>
                        {active.fill === "transparent"
                          ? "透明背景"
                          : active.fill.toUpperCase()}
                      </span>
                      <button
                        title="去掉背景"
                        aria-label="去掉模块背景"
                        onClick={() => patchSelected({ fill: "transparent" })}
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  </Field>
                  {["image", "shape"].includes(active.kind) && (
                    <Field label={`圆角 ${active.radius}px`}>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        value={active.radius}
                        onChange={(e) =>
                          patchSelected(
                            { radius: Number(e.target.value) },
                            `${active.id}-radius`,
                          )
                        }
                      />
                    </Field>
                  )}
                </div>
                <div className="property-section">
                  <div className="property-label">
                    位置与大小{" "}
                    <button
                      className="text-button"
                      onClick={() => setFree(!free)}
                    >
                      {free ? "拖拽已开启" : "开启拖拽"}
                    </button>
                  </div>
                  <div className="field-row">
                    <Field label="横向位置">
                      <input
                        type="number"
                        value={Math.round(active.x)}
                        min={0}
                        onChange={(e) =>
                          patchSelected(
                            { x: Number(e.target.value) },
                            `${active.id}-x`,
                          )
                        }
                      />
                    </Field>
                    <Field label="纵向位置">
                      <input
                        type="number"
                        value={Math.round(active.y)}
                        min={0}
                        onChange={(e) =>
                          patchSelected(
                            { y: Number(e.target.value) },
                            `${active.id}-y`,
                          )
                        }
                      />
                    </Field>
                  </div>
                  <div className="field-row">
                    <Field label="宽度">
                      <input
                        type="number"
                        value={Math.round(active.w)}
                        onChange={(e) =>
                          patchSelected(
                            { w: Number(e.target.value) },
                            `${active.id}-w`,
                          )
                        }
                      />
                    </Field>
                    <Field label="高度">
                      <input
                        type="number"
                        value={Math.round(active.h)}
                        onChange={(e) =>
                          patchSelected(
                            { h: Number(e.target.value) },
                            `${active.id}-h`,
                          )
                        }
                      />
                    </Field>
                  </div>
                  <Field label="所在页面">
                    <select
                      value={active.page}
                      onChange={(e) =>
                        patchSelected({ page: Number(e.target.value) })
                      }
                    >
                      {Array.from({ length: doc.pages }, (_, i) => (
                        <option key={i} value={i}>
                          第 {i + 1} 页
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="field-row">
                    <button
                      className="button subtle small"
                      onClick={() => {
                        setDoc({
                          ...doc,
                          blocks: [
                            ...doc.blocks.filter((b) => b.id !== active.id),
                            active,
                          ],
                        });
                      }}
                    >
                      <Layers size={14} />
                      置于顶层
                    </button>
                    <button
                      className="button subtle small danger"
                      onClick={remove}
                    >
                      <Trash2 size={14} />
                      删除模块
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="global-intro">
                  <div className="global-art">
                    <FileText size={29} strokeWidth={1} />
                    <span>
                      <Sparkles size={17} />
                    </span>
                  </div>
                  <h2>让简历有你的样子</h2>
                  <p>
                    从整体风格开始。
                    <br />
                    点击纸上的模块，还能调整更多。
                  </p>
                </div>
                <div className="property-section">
                  <div className="property-label">
                    主题色 <span>一点恰好的个性</span>
                  </div>
                  <div className="palette">
                    {accents.map((c) => (
                      <button
                        key={c}
                        aria-label={`使用主题色${c}`}
                        title={c}
                        className={doc.accent === c ? "selected" : ""}
                        style={{ background: c }}
                        onClick={() => setDoc({ ...doc, accent: c })}
                      >
                        {doc.accent === c && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                  <div className="custom-color">
                    <span>或选择自己的颜色</span>
                    <input
                      aria-label="自定义主题色"
                      type="color"
                      value={doc.accent}
                      onChange={(e) =>
                        setDoc({ ...doc, accent: e.target.value }, "accent")
                      }
                    />
                  </div>
                </div>
                <div className="property-section">
                  <div className="property-label">文字气质</div>
                  <div className="font-options">
                    {(
                      [
                        {
                          id: "sans",
                          title: "清晰现代",
                          sample: "Aa",
                          detail: "简洁、易读",
                        },
                        {
                          id: "serif",
                          title: "优雅书卷",
                          sample: "Aa",
                          detail: "温和、有质感",
                        },
                      ] as const
                    ).map((f) => (
                      <button
                        className={`${doc.font === f.id ? "selected" : ""} font-${f.id}`}
                        key={f.id}
                        onClick={() => setDoc({ ...doc, font: f.id as Font })}
                      >
                        <span>{f.sample}</span>
                        <strong>{f.title}</strong>
                        <small>{f.detail}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="property-section">
                  <div className="property-label">想再加点什么？</div>
                  <button
                    className="add-module-cta"
                    onClick={() => {
                      setTab("blocks");
                      setMobilePanel(
                        window.innerWidth < 1100 ? "library" : null,
                      );
                    }}
                  >
                    <span>
                      <Plus size={17} />
                      添加一个模块
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <p className="panel-tip">
                    项目、实习、技能、奖项……
                    <br />
                    把值得被看见的经历，一块块放进来。
                  </p>
                </div>
                <div className="little-note">
                  <span>✳</span>
                  <strong>不必一次就完美。</strong>
                  <p>
                    大胆试试。每一步都可以撤销，
                    <br />
                    每一点改变都会自动保存。
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="property-footer">
            <ShieldCheck size={14} />
            <span>简历内容只留在你的浏览器</span>
          </div>
        </aside>
      </div>
      <nav className="mobile-nav">
        <button onClick={() => setMobilePanel("library")}>
          <LayoutTemplate size={18} />
          模板与模块
        </button>
        <button onClick={() => setMobilePanel(null)}>
          <FileText size={18} />
          简历画布
        </button>
        <button onClick={() => setMobilePanel("properties")}>
          <Settings2 size={18} />
          编辑与样式
        </button>
      </nav>
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="导入简历备份文件"
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="上传简历图片"
        onChange={(e) => {
          void uploadImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="关闭弹窗"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "help" && (
              <>
                <div className="modal-mark">
                  <Sparkles size={25} />
                </div>
                <div className="eyebrow">MAKE ROOM FOR YOUR NEXT CHAPTER</div>
                <h2 id="modal-title">几分钟，把经历变成简历。</h2>
                <div className="help-steps">
                  <div>
                    <span>01</span>
                    <p>
                      <strong>选一个喜欢的起点</strong>
                      整套模板直接用，也可以在「拼模块」里自由组合。
                    </p>
                  </div>
                  <div>
                    <span>02</span>
                    <p>
                      <strong>填上你的真实经历</strong>
                      点击模块在右侧修改，或者双击纸上的文字直接写。
                    </p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>
                      <strong>细调，然后出发</strong>
                      开启「自由排版」拖动缩放。导出时选择「另存为 PDF」。
                    </p>
                  </div>
                </div>
                <div className="help-note">
                  草稿仅保存在当前浏览器。清理浏览器数据会删除草稿，重要版本请在「文件」里下载备份。模板中的信息都是虚构示例。
                </div>
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  开始做我的简历 <ArrowUpRight size={16} />
                </button>
              </>
            )}
            {modal === "export" && (
              <>
                <div className="modal-mark">
                  <Download size={25} />
                </div>
                <div className="eyebrow">READY FOR YOUR NEXT CHAPTER</div>
                <h2 id="modal-title">把下一步，带在身上。</h2>
                <p className="modal-description">
                  {doc.name} · A4 · {doc.pages} 页
                </p>
                {overflows.length > 0 && (
                  <div className="export-warning">
                    有 {overflows.length}{" "}
                    个模块的内容超出了边框。建议先关闭弹窗，点底部提示定位，再用「高度适应内容」调整，避免内容重叠或超出纸张。
                  </div>
                )}
                <button className="export-option" onClick={() => void print()}>
                  <span className="export-icon">
                    <FileText size={23} />
                  </span>
                  <span>
                    <strong>导出 PDF / 打印</strong>
                    <small>在系统窗口选择「另存为 PDF」</small>
                  </span>
                  <ArrowUpRight size={20} />
                </button>
                <button className="export-option" onClick={download}>
                  <span className="export-icon">
                    <FolderOpen size={23} />
                  </span>
                  <span>
                    <strong>下载可编辑备份</strong>
                    <small>保留所有模块，下次导入接着改</small>
                  </span>
                  <Download size={18} />
                </button>
                <div className="help-note">
                  PDF 建议：纸张 A4、缩放
                  100%、关闭页眉页脚、开启背景图形。文件保留文字，可选中复制。打印前请检查预览中的分页与内容。
                </div>
              </>
            )}
            {modal === "new" && (
              <>
                <div className="modal-mark">
                  <FilePlus2 size={25} />
                </div>
                <h2 id="modal-title">给下一份简历，留一张白纸。</h2>
                <p className="modal-description">
                  先下载当前备份，就能随时回来继续。新建后也可以用撤销恢复当前内容。
                </p>
                <button className="button subtle full" onClick={download}>
                  <Download size={16} />
                  先备份当前简历
                </button>
                <div className="new-options">
                  <button
                    className="button subtle"
                    onClick={() => {
                      setDoc({
                        ...initialResume(),
                        name: "我的新简历",
                        blocks: [],
                      });
                      setSelected(null);
                      setModal(null);
                      setTab("blocks");
                      notify("白纸准备好了，从左侧添加第一个模块吧");
                    }}
                  >
                    从空白开始
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      setDoc(initialResume());
                      setSelected(null);
                      setModal(null);
                      notify("示例已就位，换成你的故事吧");
                    }}
                  >
                    从示例开始
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      <div className="print-only print-meta">{doc.name}</div>
    </div>
  );
}
