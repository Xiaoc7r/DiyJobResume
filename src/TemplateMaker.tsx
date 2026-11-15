import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { Save, Plus } from "lucide-react";
import FreeStudio from "./FreeStudio";
import type { FreeStudioApi } from "./FreeStudio";
import { defaultSettings, parseMarkdown, paginate, readResume } from "./flow";
import type { Resume, Piece, Settings } from "./flow";
import {
  blankFreePage,
  sourceContentStyle,
  sourceFrameStyle,
} from "./freeform";
import type { FreeDocument } from "./freeform";
import { fonts, lineHtml, rowStyle } from "./render";
import { measureRow } from "./paperLayout";
import { lineDesignResolver } from "./templateStyle";
import type { TemplateStyle } from "./templateStyle";
import { buildTemplateArt, useTemplateArt } from "./templateArt";
import { TemplateDecorations, templateZones } from "./TemplateDecorations";
import type { TemplateZone } from "./TemplateDecorations";
import {
  MAKER_DRAFT_KEY,
  newTemplateId,
  saveUserTemplate,
} from "./templateLibrary";
import type { UserTemplate } from "./templateLibrary";
import { ColorControl } from "./ColorControl";
import { NumericInput } from "./interaction";
import "./template-maker.css";

const sample =
  "# 示例姓名\n手机号码 | 邮箱地址 | 个人主页\n## 教育背景\n### 学校名称 | 专业与学位 | 2021.09 — 2025.06\n荣誉：国家奖学金、大学英语六级。\n## 工作经历\n### 公司名称 | 岗位名称 | 2024.07 — 至今\n负责业务模块开发与团队协作，完成需求分析、功能实现与上线交付。\n- 优化业务流程，解决实际使用中的问题。\n- 完善测试与监控，持续改进交付质量。\n## 项目经历\n### 项目名称 | 核心开发者 | 2024.01 — 2024.06\n- 负责核心功能设计、开发与验证。\n- 结合使用反馈，持续优化功能体验。\n## 专业技能\n- 熟悉相关开发工具与工作方法。\n- 具备良好的沟通与协作能力。";
const defaultAreas = { header: 84, section: 30 };
function initialDraft(editing?: UserTemplate) {
  let stored:
    | {
        doc: Resume;
        name: string;
        id: string;
        regions?: typeof defaultAreas;
        frames?: { header?: TemplateZone; section?: TemplateZone };
      }
    | undefined;
  if (!editing)
    try {
      stored =
        JSON.parse(localStorage.getItem(MAKER_DRAFT_KEY) || "null") ||
        undefined;
    } catch {}
  let doc: Resume;
  try {
    doc = editing
      ? structuredClone(editing.draft)
      : stored?.doc
        ? readResume(stored.doc)
        : {
            version: 2,
            name: "我的模板",
            template: "blue",
            lines: [],
            pictures: [],
            settings: {
              ...defaultSettings(),
              accent: "#000000",
              color: "#000000",
              top: 30,
              bottom: 30,
              left: 42,
              right: 42,
            },
            freeform: {
              version: 1,
              base: "flow",
              source: "",
              sourceDesign: {},
              pages: [blankFreePage()],
            },
          };
  } catch {
    stored = undefined;
    return initialDraftFresh();
  }
  doc.lines = parseMarkdown(sample);
  doc.pictures = [];
  doc.template = "blue";
  delete doc.templateStyle;
  doc.settings.customCss = "";
  doc.freeform = {
    version: 1,
    base: "flow",
    source: "",
    sourceDesign: {},
    pages: [
      {
        ...(doc.freeform?.pages[0] || blankFreePage()),
        width: 794,
        height: 1123,
        background: "#ffffff",
      },
    ],
  };
  doc.freeform.pages[0].canvas.objects =
    doc.freeform.pages[0].canvas.objects.map((o) => ({
      ...o,
      templateRole:
        o.templateRole === "header" || o.templateRole === "page"
          ? "header"
          : "section",
    }));
  return {
    doc,
    name: editing?.name || stored?.name || "我的模板",
    id: editing?.id || stored?.id || newTemplateId(),
    regions: editing?.regions || stored?.regions || defaultAreas,
    frames: editing
      ? { header: editing.headerFrame, section: editing.sectionFrame }
      : stored?.frames,
  };
}
function initialDraftFresh() {
  return {
    doc: {
      version: 2,
      name: "我的模板",
      template: "blue",
      lines: parseMarkdown(sample),
      pictures: [],
      settings: {
        ...defaultSettings(),
        accent: "#000000",
        color: "#000000",
        top: 30,
        bottom: 30,
        left: 42,
        right: 42,
      },
      freeform: {
        version: 1,
        base: "flow",
        source: "",
        sourceDesign: {},
        pages: [blankFreePage()],
      },
    } as Resume,
    name: "我的模板",
    id: newTemplateId(),
    regions: defaultAreas,
    frames: undefined,
  };
}
export function TemplateMaker({
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
  const [initial] = useState(() => initialDraft(editing));
  const [doc, setDoc] = useState(initial.doc),
    [name, setName] = useState(initial.name),
    [id, setId] = useState(initial.id),
    [areas, setAreas] = useState(initial.regions);
  const [pages, setPages] = useState<Piece[][]>([[]]),
    [fontVersion, setFontVersion] = useState(0),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [scope, setScope] = useState<"section" | "header">("section"),
    [drawOffset, setDrawOffset] = useState(0);
  const current = useRef({ doc, name, id, areas });
  current.current = { doc, name, id, areas };
  const saved = useRef(false),
    measureHost = useRef<HTMLDivElement>(null),
    frames = useRef(initial.frames);
  const history = useRef<{
    past: { doc: Resume; areas: typeof defaultAreas }[];
    future: { doc: Resume; areas: typeof defaultAreas }[];
  }>({
    past: [],
    future: [],
  });
  const gestureBase = useRef<Resume | null>(null);
  const update = (next: Resume, transient = false) => {
    if (saved.current || next === current.current.doc) return;
    if (
      !transient &&
      !gestureBase.current &&
      next.lines === current.current.doc.lines &&
      next.settings === current.current.doc.settings &&
      JSON.stringify(next.freeform, (key, value) =>
        key === "templateBounds" ? undefined : value,
      ) ===
        JSON.stringify(current.current.doc.freeform, (key, value) =>
          key === "templateBounds" ? undefined : value,
        )
    )
      return;
    if (transient) {
      if (!gestureBase.current) gestureBase.current = current.current.doc;
      current.current.doc = next;
      saved.current = false;
      setDoc(next);
      return;
    }
    history.current.past.push({
      doc: gestureBase.current || current.current.doc,
      areas: current.current.areas,
    });
    gestureBase.current = null;
    history.current.past = history.current.past.slice(-30);
    history.current.future = [];
    current.current.doc = next;
    saved.current = false;
    setDoc(next);
  };
  const patch = (patch: Partial<Settings>) => {
    apiRef.current?.flush();
    update({
      ...current.current.doc,
      settings: { ...current.current.doc.settings, ...patch },
    });
  };
  const slots = useMemo<TemplateStyle["slots"]>(
    () => ({
      name: {
        fontSize: doc.settings.types.name.size,
        fontFamily: fonts[doc.settings.font].replaceAll('"', ""),
        color: doc.settings.color,
        lineHeight: doc.settings.lineHeight,
      },
      contact: {
        fontSize: Math.round(doc.settings.types.name.size * 0.55 * 10) / 10,
        fontFamily: fonts[doc.settings.font].replaceAll('"', ""),
        color: doc.settings.color,
        lineHeight: doc.settings.lineHeight,
      },
      section: {
        fontSize: doc.settings.types.section.size,
        fontFamily: fonts[doc.settings.font].replaceAll('"', ""),
        color: doc.settings.accent,
        lineHeight: doc.settings.lineHeight,
      },
    }),
    [doc.settings],
  );
  const mockStyle = useMemo<TemplateStyle>(
    () => ({
      version: 1,
      id,
      name,
      drawings: doc.freeform!,
      sectionFrame: { x: 42, y: 114, width: 710, height: areas.section },
      regions: areas,
      slots,
    }),
    [id, name, doc.freeform, areas, slots],
  );
  const designFor = useMemo(
    () => lineDesignResolver({ ...doc, templateStyle: mockStyle }),
    [doc, mockStyle],
  );
  const paperStyle = {
    fontFamily: fonts.sans,
    color: "#000000",
    "--ink": "#000000",
    "--accent": doc.settings.accent,
    "--header-align": "center",
  } as CSSProperties;
  useLayoutEffect(() => {
    const parent = measureHost.current;
    if (!parent) return;
    const node = document.createElement("div");
    parent.replaceChildren(node);
    setPages(
      paginate(doc.lines, 1063, (line, text, continued) =>
        measureRow(
          node,
          doc.settings,
          "blue",
          false,
          line,
          text,
          continued,
          designFor(line),
        ),
      ),
    );
  }, [doc.lines, doc.settings, areas, fontVersion]);
  const zones = useMemo(
    () => templateZones(pages[0] || [], doc.settings, 794, designFor),
    [pages, doc.settings, designFor],
  );
  const header = zones.find((z) => z.role === "header"),
    section = zones.find((z) => z.role === "section");
  useLayoutEffect(() => {
    if (!header || !section) return;
    const previous = frames.current;
    frames.current = { header, section };
    if (!previous) return;
    const objects = doc.freeform!.pages[0].canvas.objects;
    let changed = false;
    const moved = objects.map((o) => {
      const role = o.templateRole === "header" ? "header" : "section",
        before = previous[role],
        after = role === "header" ? header : section;
      if (!before) return o;
      const dx = after.x - before.x,
        dy = after.y - before.y;
      if (Math.abs(dx) + Math.abs(dy) < 0.01) return o;
      changed = true;
      return {
        ...o,
        left: Number(o.left || 0) + dx,
        top: Number(o.top || 0) + dy,
        ...(o.templateBounds
          ? {
              templateBounds: {
                ...(o.templateBounds as object),
                left: Number((o.templateBounds as { left: number }).left) + dx,
                top: Number((o.templateBounds as { top: number }).top) + dy,
              },
            }
          : {}),
      };
    });
    if (changed) {
      const freeform = structuredClone(doc.freeform!);
      freeform.pages[0].canvas.objects = moved;
      current.current.doc = { ...current.current.doc, freeform };
      setDoc(current.current.doc);
    }
  }, [header?.x, header?.y, section?.x, section?.y]);
  const style = useMemo<TemplateStyle>(
    () => ({
      ...mockStyle,
      sectionFrame: section || mockStyle.sectionFrame,
      headerFrame: header,
    }),
    [mockStyle, section, header],
  );
  const art = useTemplateArt(style);
  const persist = () => {
    if (saved.current) return;
    try {
      localStorage.setItem(
        MAKER_DRAFT_KEY,
        JSON.stringify({
          ...current.current,
          regions: current.current.areas,
          frames: frames.current,
        }),
      );
    } catch {
      onNotice("模板草稿未能保存，请减少图片大小后重试。");
    }
  };
  useEffect(() => {
    const timer = setTimeout(persist, 250);
    return () => clearTimeout(timer);
  }, [doc, name, id, areas]);
  useEffect(() => () => persist(), []);
  useEffect(() => {
    const done = () => setFontVersion((n) => n + 1);
    void document.fonts.ready.then(done);
    document.fonts.addEventListener("loadingdone", done);
    return () => document.fonts.removeEventListener("loadingdone", done);
  }, []);
  const travel = (back: boolean) => {
    const from = back ? history.current.past : history.current.future,
      to = back ? history.current.future : history.current.past,
      next = from.pop();
    if (next) {
      to.push({ doc: current.current.doc, areas: current.current.areas });
      current.current.doc = next.doc;
      current.current.areas = next.areas;
      setAreas(next.areas);
      setDoc(next.doc);
    }
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      apiRef.current?.flush();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const value: UserTemplate = {
        ...style,
        id: current.current.id,
        name: current.current.name.trim() || "我的模板",
        drawings: structuredClone(current.current.doc.freeform!),
        settings: structuredClone(current.current.doc.settings),
        draft: structuredClone(current.current.doc),
        updatedAt: Date.now(),
      };
      await buildTemplateArt(value);
      const items = saveUserTemplate(value);
      saved.current = true;
      localStorage.removeItem(MAKER_DRAFT_KEY);
      onSaved(items);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "QuotaExceededError"
          ? "本机空间不足，请减少图片大小后重试。"
          : (err as Error).message,
      );
    } finally {
      setSaving(false);
    }
  };
  const overflow = doc.freeform!.pages[0].canvas.objects.some((o) => {
    if (o.visible === false) return false;
    const area = o.templateRole === "header" ? header : section;
    if (!area) return false;
    const b = o.templateBounds as
      | { left: number; top: number; width: number; height: number }
      | undefined;
    const x = b?.left ?? Number(o.left || 0),
      y = b?.top ?? Number(o.top || 0),
      w = b?.width ?? Number(o.width || 0) * Number(o.scaleX || 1),
      h = b?.height ?? Number(o.height || 0) * Number(o.scaleY || 1);
    return (
      x < area.x - 1 ||
      y < area.y - 1 ||
      x + w > area.x + area.width + 1 ||
      y + h > area.y + area.height + 1
    );
  });
  const controls = (
    <section className="maker-save-controls">
      <div className="maker-save-line">
        <input
          aria-label="模板名称"
          maxLength={60}
          value={name}
          onChange={(e) => {
            saved.current = false;
            setName(e.target.value);
          }}
        />
        <button
          className="primary"
          disabled={saving || !header || !section}
          onClick={() => void save()}
        >
          <Save size={15} />
          {saving ? "保存中…" : "保存模板"}
        </button>
      </div>
      <div className="maker-area-controls">
        {(
          [
            ["header", "个人信息区高度"],
            ["section", "板块标题区高度"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <NumericInput
              label={label}
              min={12}
              max={300}
              value={areas[key]}
              onChange={(n) => {
                apiRef.current?.flush();
                saved.current = false;
                history.current.past.push({
                  doc: current.current.doc,
                  areas: current.current.areas,
                });
                history.current.future = [];
                setAreas((old) => ({ ...old, [key]: n }));
              }}
            />
          </label>
        ))}
        {(
          [
            ["name", "个人信息字号"],
            ["section", "板块标题字号"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <NumericInput
              label={label}
              min={1}
              max={100}
              value={doc.settings.types[key].size}
              onChange={(size) =>
                patch({
                  types: {
                    ...doc.settings.types,
                    [key]: { ...doc.settings.types[key], size },
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      {overflow && (
        <small className="maker-overflow-note" role="status">
          有元素超出设计区，仍可保存
        </small>
      )}
      {error && <small role="alert">{error}</small>}
      <button
        className="maker-new"
        onClick={() => {
          apiRef.current?.flush();
          const next = initialDraftFresh();
          frames.current = undefined;
          setId(next.id);
          setName(next.name);
          setAreas(next.regions);
          update(next.doc);
        }}
      >
        <Plus size={14} />
        新建模板
      </button>
    </section>
  );
  const toolbar = (
    <>
      <i />
      <span className="maker-toolbar-fields">
        <ColorControl
          label="主题"
          value={doc.settings.accent}
          defaultValue="#000000"
          presets
          onChange={(accent) => patch({ accent })}
        />
        <ColorControl
          label="正文"
          value={doc.settings.color}
          defaultValue="#000000"
          onChange={(color) => patch({ color })}
        />
        <select
          aria-label="模板字体"
          value={doc.settings.font}
          onChange={(e) => patch({ font: e.target.value as Settings["font"] })}
        >
          <option value="sans">思源黑体</option>
          <option value="serif">思源宋体</option>
          <option value="nunito">Nunito</option>
        </select>
      </span>
    </>
  );
  const renderPaper = (page: number, scale = 1) => (
    <article
      className="resume-paper template-blue has-template-art has-region-template maker-paper"
      data-page={page}
      style={{
        ...paperStyle,
        width: 794,
        height: 1123,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        padding: `${doc.settings.top}px ${doc.settings.right}px ${doc.settings.bottom}px ${doc.settings.left}px`,
      }}
    >
      <TemplateDecorations template={style} zones={zones} art={art} editing />
      {(pages[0] || []).map((piece) => (
        <div
          className="paper-row"
          key={piece.line.id + piece.start}
          style={sourceFrameStyle(designFor(piece.line))}
        >
          <div
            className={`flow-row row-${piece.line.kind} ${piece.line.kind === "name" || piece.line.text.startsWith("手机") ? "row-header" : ""}`}
            style={{
              ...rowStyle(piece.line, doc.settings, piece.continued),
              ...sourceContentStyle(designFor(piece.line)),
            }}
            dangerouslySetInnerHTML={{
              __html: lineHtml(
                piece.line,
                piece.line.text.slice(piece.start, piece.end),
              ),
            }}
          />
        </div>
      ))}
      <svg className="maker-zone-guides" width="794" height="1123" aria-hidden>
        <defs>
          <mask id="maker-zone-mask">
            <rect width="794" height="1123" fill="white" />
            {zones.map((zone, i) => (
              <rect
                key={i}
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          width="794"
          height="1123"
          fill="#000000"
          opacity=".26"
          mask="url(#maker-zone-mask)"
        />
        {zones.map((zone, i) => (
          <rect
            key={i}
            className="maker-zone-outline"
            x={zone.x}
            y={zone.y}
            width={zone.width}
            height={zone.height}
          />
        ))}
      </svg>
    </article>
  );
  const placement = scope === "header" ? header : section;
  return (
    <div className="template-maker region-workshop">
      <FreeStudio
        doc={doc}
        apiRef={apiRef}
        onChange={(freeform: FreeDocument, transient?: boolean) =>
          update({ ...current.current.doc, freeform }, transient)
        }
        onMode={() => {}}
        workshop
        modeTabs={modeTabs}
        propertiesAddon={controls}
        toolbarAddon={toolbar}
        renderPaper={renderPaper}
        sourcePageCount={1}
        insertion={{
          ...(placement || { x: 42, y: 114, width: 710, height: 30 }),
          role: scope,
          drawOffsetY: drawOffset,
        }}
        onWorkshopPoint={(x, y) => {
          const hit = zones.find(
            (zone) =>
              x >= zone.x &&
              x <= zone.x + zone.width &&
              y >= zone.y &&
              y <= zone.y + zone.height,
          );
          if (hit) {
            setScope(hit.role);
            setDrawOffset(
              hit.role === "section" ? hit.y - (section?.y || hit.y) : 0,
            );
          }
        }}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onCloseLeft={onCloseLeft}
        onCloseRight={onCloseRight}
        onOpenLeft={onOpenLeft}
        onOpenRight={onOpenRight}
        previewZoom={zoom}
        fitPreview={fit}
        onFitZoom={onFitZoom}
        onFitPreview={onFit}
        onZoomChange={onZoom}
        onResizeLeft={onResizeLeft}
        onNudgeLeft={onNudgeLeft}
        onUndo={() => travel(true)}
        onRedo={() => travel(false)}
        canUndo={!!history.current.past.length}
        canRedo={!!history.current.future.length}
      />
      <div
        ref={measureHost}
        className="measure-host template-blue has-template-art"
        aria-hidden
        style={{
          ...paperStyle,
          width: 794 - doc.settings.left - doc.settings.right,
        }}
      />
    </div>
  );
}
