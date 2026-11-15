import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { Eye, Save, Plus, Check } from "lucide-react";
import FreeStudio from "./FreeStudio";
import type { FreeStudioApi } from "./FreeStudio";
import { defaultSettings, parseMarkdown, readResume, paginate } from "./flow";
import type { Resume, Piece, Settings } from "./flow";
import {
  blankFreePage,
  sourceContentStyle,
  sourceFrameStyle,
} from "./freeform";
import type { FreeDocument } from "./freeform";
import { lineHtml, editableText, fonts, rowStyle } from "./render";
import { measureRow } from "./paperLayout";
import {
  headerLines,
  lineDesign,
  lineDesignResolver,
  templateSlot,
} from "./templateStyle";
import type { TemplateStyle } from "./templateStyle";
import { buildTemplateArt, useTemplateArt } from "./templateArt";
import {
  MAKER_DRAFT_KEY,
  newTemplateId,
  saveUserTemplate,
} from "./templateLibrary";
import type { UserTemplate } from "./templateLibrary";
import { ColorControl } from "./ColorControl";
import { NumericInput } from "./interaction";
import "./template-maker.css";

// Keep the active DOM intact while typing; React must not reset the caret.
function SampleContent({
  piece,
  settings,
  header,
  design,
  preview,
  onText,
}: {
  piece: Piece;
  settings: Settings;
  header: boolean;
  design: ReturnType<typeof lineDesign>;
  preview: boolean;
  onText: (text: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const html = lineHtml(
    piece.line,
    piece.line.text.slice(piece.start, piece.end),
    "blue",
  );
  useLayoutEffect(() => {
    if (element.current && !element.current.contains(document.activeElement))
      element.current.innerHTML = html;
  }, [html]);
  return (
    <div
      ref={element}
      data-edit={piece.line.id}
      className={`flow-row row-${piece.line.kind} ${header ? "row-header" : ""}`}
      style={{
        ...rowStyle(piece.line, settings, piece.continued),
        ...sourceContentStyle(design),
      }}
      contentEditable={!preview}
      suppressContentEditableWarning
      onInput={(event) => onText(editableText(event.currentTarget))}
      onBlur={(event) => {
        event.currentTarget.innerHTML = html;
      }}
    />
  );
}

const sample =
  "# 示例姓名\n手机号码 | 邮箱地址 | 个人主页\n## 教育背景\n### 学校名称 `985` `211` | 计算机科学与技术（本科） | 2021.09 — 2025.06\n荣誉：国家奖学金、大学英语六级\n## 工作经历\n### 公司名称 | 岗位名称 | 2024.07 — 至今\n负责业务模块开发与团队协作，完成需求分析、功能实现与上线交付。\n- 优化业务流程，解决实际使用中的问题。\n- 完善测试与监控，持续改进交付质量。\n## 项目经历\n### 项目名称 | 核心开发者 | 2024.01 — 2024.06\n技术栈：`Java` `MySQL` `Redis`\n- 负责核心功能设计、开发与验证。\n- 结合使用反馈，持续优化功能体验。\n## 专业技能\n- 熟悉相关开发工具与工作方法。\n- 具备良好的沟通、协作与问题解决能力。";
function blankMaker(settings: Settings): Resume {
  return {
    version: 2,
    name: "我的模板",
    template: "blue",
    lines: parseMarkdown(sample),
    pictures: [],
    settings: {
      ...structuredClone(settings),
      customCss: "",
      headerAlign: "center",
    },
    freeform: {
      version: 1,
      base: "flow",
      source: "",
      sourceDesign: {},
      pages: [blankFreePage()],
    },
  };
}
function initialDraft(settings: Settings, editing?: UserTemplate) {
  if (editing)
    return {
      doc: structuredClone(editing.draft),
      name: editing.name,
      id: editing.id,
    };
  try {
    const value = JSON.parse(localStorage.getItem(MAKER_DRAFT_KEY) || "null");
    if (value?.doc)
      return {
        doc: readResume(value.doc),
        name: String(value.name || "我的模板"),
        id: typeof value.id === "string" ? value.id : newTemplateId(),
      };
  } catch {}
  return { doc: blankMaker(settings), name: "我的模板", id: newTemplateId() };
}
export function TemplateMaker({
  settings,
  editing,
  modeTabs,
  apiRef,
  onSaved,
  onNotice,
  zoom,
  onZoom,
  fit,
  onFitZoom,
  onFit,
  leftOpen,
  rightOpen,
  onCloseLeft,
  onCloseRight,
  onOpenLeft,
  onOpenRight,
  onResizeLeft,
  onNudgeLeft,
}: {
  settings: Settings;
  editing?: UserTemplate;
  modeTabs: ReactNode;
  apiRef: RefObject<FreeStudioApi | null>;
  onSaved: (templates: UserTemplate[]) => void;
  onNotice: (message: string) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  fit: boolean;
  onFitZoom: (zoom: number) => void;
  onFit: () => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onCloseLeft: () => void;
  onCloseRight: () => void;
  onOpenLeft: () => void;
  onOpenRight: () => void;
  onResizeLeft: (event: React.PointerEvent) => void;
  onNudgeLeft: (delta: number) => void;
}) {
  const [initial] = useState(() => initialDraft(settings, editing));
  const [doc, setDoc] = useState(initial.doc),
    docRef = useRef(doc);
  docRef.current = doc;
  const [name, setName] = useState(initial.name),
    nameRef = useRef(name);
  nameRef.current = name;
  const [id, setId] = useState(initial.id),
    idRef = useRef(id);
  idRef.current = id;
  const [scope, setScope] = useState<"section" | "page">("section"),
    [preview, setPreview] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const savedRef = useRef(false);
  const history = useRef<{ past: Resume[]; future: Resume[] }>({
    past: [],
    future: [],
  });
  const [, revision] = useState(0);
  const host = useRef<HTMLDivElement>(null),
    measureHost = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Piece[][]>([[]]),
    [fontVersion, setFontVersion] = useState(0);
  const persist = () => {
    if (savedRef.current) return true;
    try {
      localStorage.setItem(
        MAKER_DRAFT_KEY,
        JSON.stringify({
          id: idRef.current,
          name: nameRef.current,
          doc: docRef.current,
        }),
      );
      return true;
    } catch {
      onNotice("模板草稿未能保存，本机存储空间可能不足。");
      return false;
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(persist, 250);
    return () => clearTimeout(timer);
  }, [doc, name, id]);
  useEffect(
    () => () => {
      persist();
    },
    [],
  );
  useEffect(() => {
    const done = () => setFontVersion((n) => n + 1);
    document.fonts.addEventListener("loadingdone", done);
    void document.fonts.ready.then(done);
    return () => document.fonts.removeEventListener("loadingdone", done);
  }, []);
  const update = (next: Resume) => {
    if (next === docRef.current) return;
    savedRef.current = false;
    history.current.past.push(docRef.current);
    history.current.past = history.current.past.slice(-30);
    history.current.future = [];
    docRef.current = next;
    setDoc(next);
    setPreview(false);
  };
  const travel = (back: boolean) => {
    const from = back ? history.current.past : history.current.future,
      to = back ? history.current.future : history.current.past;
    const next = from.pop();
    if (!next) return;
    to.push(docRef.current);
    docRef.current = next;
    setDoc(next);
    revision((n) => n + 1);
  };
  const changeFree = (freeform: FreeDocument) => {
    const current = docRef.current,
      design = { ...freeform.sourceDesign };
    for (const line of current.lines) {
      if (
        JSON.stringify(design[line.id]) ===
        JSON.stringify(current.freeform?.sourceDesign?.[line.id])
      )
        continue;
      const slot = templateSlot(current.lines, line);
      for (const sibling of current.lines)
        if (templateSlot(current.lines, sibling) === slot)
          design[sibling.id] = design[line.id];
      break;
    }
    update({ ...current, freeform: { ...freeform, sourceDesign: design } });
  };
  const patchSettings = (patch: Partial<Settings>) =>
    update({
      ...docRef.current,
      settings: { ...docRef.current.settings, ...patch },
    });
  const size = doc.freeform!.pages[0];
  const designFor = useMemo(
    () => lineDesignResolver(doc),
    [doc.lines, doc.templateStyle, doc.freeform?.sourceDesign],
  );
  const paperStyle = {
    fontFamily: fonts[doc.settings.font],
    color: doc.settings.color,
    "--ink": doc.settings.color,
    "--accent": doc.settings.accent,
    "--header-align": "center",
  } as CSSProperties;
  useLayoutEffect(() => {
    const container = measureHost.current;
    if (!container) return;
    const node = document.createElement("div");
    container.replaceChildren(node);
    setPages(
      paginate(
        doc.lines,
        size.height - doc.settings.top - doc.settings.bottom,
        (line, text, continued) =>
          measureRow(
            node,
            doc.settings,
            doc.template,
            false,
            line,
            text,
            continued,
            designFor(line),
          ),
      ),
    );
  }, [
    doc.lines,
    doc.settings,
    doc.freeform?.sourceDesign,
    size.width,
    size.height,
    fontVersion,
  ]);
  const sectionFrame = useMemo(() => {
    let y = doc.settings.top;
    for (const piece of pages[0] || []) {
      if (piece.line.kind === "section") {
        const design = designFor(piece.line);
        return {
          x: doc.settings.left + (design.dx || 0),
          y: y + (design.dy || 0),
          width:
            design.width || size.width - doc.settings.left - doc.settings.right,
          height: piece.height,
        };
      }
      y += piece.height;
    }
    return {
      x: doc.settings.left,
      y: 100,
      width: size.width - doc.settings.left - doc.settings.right,
      height: 29,
    };
  }, [pages, doc.settings, size.width]);
  const style = useMemo<TemplateStyle>(() => {
    const slots: TemplateStyle["slots"] = {};
    for (const line of doc.lines) {
      const design = doc.freeform?.sourceDesign?.[line.id];
      if (design) slots[templateSlot(doc.lines, line)] = design;
    }
    return {
      version: 1,
      id,
      name: name.trim() || "我的模板",
      drawings: doc.freeform!,
      sectionFrame,
      slots,
    };
  }, [doc, id, name, sectionFrame]);
  const art = useTemplateArt(preview ? style : undefined);
  const save = async () => {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      apiRef.current?.flush();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const current = docRef.current,
        slots: TemplateStyle["slots"] = {};
      for (const line of current.lines) {
        const design = current.freeform?.sourceDesign?.[line.id];
        if (design) slots[templateSlot(current.lines, line)] = design;
      }
      if (current.freeform!.pages.length !== 1 || pages.length !== 1)
        throw new Error("示例内容超出一页，请缩小字号或增大纸张后保存。");
      const value: UserTemplate = {
        version: 1,
        id: idRef.current,
        name: nameRef.current.trim() || "我的模板",
        drawings: structuredClone(current.freeform!),
        sectionFrame,
        slots,
        settings: structuredClone(current.settings),
        draft: structuredClone(current),
        updatedAt: Date.now(),
      };
      await buildTemplateArt(value);
      const items = saveUserTemplate(value);
      savedRef.current = true;
      localStorage.removeItem(MAKER_DRAFT_KEY);
      onSaved(items);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "QuotaExceededError"
          ? "本机存储空间不足，请减少图片大小后重试。"
          : (err as Error).message,
      );
    } finally {
      setSaving(false);
    }
  };
  const headerIds = new Set(headerLines(doc.lines).map((line) => line.id));
  const renderPaper = (page: number, scale = 1) => (
    <article
      className={`resume-paper template-${doc.template} has-template-art`}
      data-page={page}
      style={{
        ...paperStyle,
        ...art.style,
        width: size.width,
        height: size.height,
        padding: `${doc.settings.top}px ${doc.settings.right}px ${doc.settings.bottom}px ${doc.settings.left}px`,
        transform: scale === 1 ? undefined : `scale(${scale})`,
      }}
    >
      {preview && (
        <div
          className="template-page-decoration"
          style={{ backgroundImage: art.page }}
        />
      )}
      {(pages[page] || []).map((piece) => (
        <div
          className="paper-row"
          data-line={piece.line.id}
          key={piece.line.id + piece.start}
          style={sourceFrameStyle(designFor(piece.line))}
        >
          <SampleContent
            piece={piece}
            settings={doc.settings}
            header={headerIds.has(piece.line.id)}
            design={designFor(piece.line)}
            preview={preview}
            onText={(text) =>
              update({
                ...docRef.current,
                lines: docRef.current.lines.map((line) =>
                  line.id === piece.line.id ? { ...line, text } : line,
                ),
              })
            }
          />
        </div>
      ))}
    </article>
  );
  const controls = (
    <section className="maker-style-controls">
      <h3>模板样式</h3>
      <div className="maker-colors">
        <ColorControl
          label="主题"
          value={doc.settings.accent}
          defaultValue="#0756a5"
          presets
          onChange={(accent) => patchSettings({ accent })}
        />
        <ColorControl
          label="正文"
          value={doc.settings.color}
          defaultValue="#171717"
          onChange={(color) => patchSettings({ color })}
        />
      </div>
      <label>
        字体
        <select
          aria-label="模板字体"
          value={doc.settings.font}
          onChange={(event) =>
            patchSettings({ font: event.target.value as Settings["font"] })
          }
        >
          <option value="sans">思源黑体</option>
          <option value="serif">思源宋体</option>
          <option value="nunito">Nunito</option>
        </select>
      </label>
      <div className="maker-type-grid">
        {(
          [
            ["section", "标题字号"],
            ["text", "正文字号"],
          ] as const
        ).map(([kind, label]) => (
          <label key={kind}>
            {label}
            <NumericInput
              label={label}
              value={doc.settings.types[kind].size}
              min={1}
              max={100}
              onChange={(value) =>
                patchSettings({
                  types: {
                    ...doc.settings.types,
                    [kind]: { ...doc.settings.types[kind], size: value },
                    ...(kind === "text"
                      ? {
                          bullet: { ...doc.settings.types.bullet, size: value },
                        }
                      : {}),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
    </section>
  );
  return (
    <div className={`template-maker ${preview ? "is-preview" : ""}`} ref={host}>
      <div className="maker-bar">
        <input
          aria-label="模板名称"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="给模板起个名字"
        />
        <select
          aria-label="绘制使用范围"
          value={scope}
          onChange={(event) => setScope(event.target.value as typeof scope)}
        >
          <option value="section">每个板块标题</option>
          <option value="page">整页装饰</option>
        </select>
        <button
          aria-label="预览模板"
          aria-pressed={preview}
          onClick={() => {
            apiRef.current?.flush();
            setPreview((value) => !value);
          }}
        >
          <Eye size={16} />
          {preview ? "继续制作" : "预览模板"}
        </button>
        <button
          title="新建模板草稿"
          aria-label="新建模板草稿"
          onClick={() => {
            persist();
            setId(newTemplateId());
            setName("我的模板");
            update(blankMaker(defaultSettings()));
          }}
        >
          <Plus size={16} />
        </button>
        <button
          className="primary"
          disabled={saving}
          onClick={() => void save()}
        >
          <Save size={16} />
          {saving ? "保存中…" : "保存模板"}
        </button>
        {error && <span role="alert">{error}</span>}
        {!error && preview && (
          <span className="maker-preview-state">
            <Check size={14} />
            预览
          </span>
        )}
      </div>
      <FreeStudio
        doc={doc}
        apiRef={apiRef}
        onChange={changeFree}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onCloseLeft={onCloseLeft}
        onCloseRight={onCloseRight}
        onOpenLeft={onOpenLeft}
        onOpenRight={onOpenRight}
        modeTabs={modeTabs}
        onMode={() => {}}
        renderPaper={renderPaper}
        sourcePageCount={pages.length}
        propertiesAddon={controls}
        insertion={{ role: scope, ...sectionFrame }}
        previewZoom={zoom}
        fitPreview={fit}
        onFitZoom={onFitZoom}
        onFitPreview={onFit}
        onZoomChange={onZoom}
        onResizeLeft={onResizeLeft}
        onNudgeLeft={onNudgeLeft}
        onUndo={() => travel(true)}
        onRedo={() => travel(false)}
        canUndo={history.current.past.length > 0}
        canRedo={history.current.future.length > 0}
        onSourceText={(id, text) =>
          update({
            ...docRef.current,
            lines: docRef.current.lines.map((line) =>
              line.id === id ? { ...line, text } : line,
            ),
          })
        }
      />
      <div
        className={`measure-host template-${doc.template} has-template-art`}
        ref={measureHost}
        aria-hidden
        style={{
          ...paperStyle,
          width: size.width - doc.settings.left - doc.settings.right,
        }}
      />
    </div>
  );
}
