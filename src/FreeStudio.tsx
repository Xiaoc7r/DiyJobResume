import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  CSSProperties,
  RefObject,
  ReactNode,
  SetStateAction,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  Canvas,
  StaticCanvas,
  FabricObject,
  Textbox,
  IText,
  Rect,
  Circle,
  Triangle,
  Line as FabricLine,
  Group,
  ActiveSelection,
  FabricImage,
  loadSVGFromString,
  util,
  filters,
  PencilBrush,
} from "fabric";
import type { TextStyleDeclaration } from "fabric";
import {
  Type,
  Square,
  Circle as CircleIcon,
  Minus,
  ImagePlus,
  Shapes,
  MousePointer2,
  Hand,
  Copy,
  Trash2,
  Group as GroupIcon,
  Ungroup,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Plus,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  ChevronsUp,
  ChevronsDown,
  Grid2X2,
  Download,
  RotateCcw,
  HelpCircle,
  Mail,
  Phone,
  Github,
  GraduationCap,
  BriefcaseBusiness,
  Award,
  MapPin,
  Globe,
  Code2,
  Link,
  Check,
  Star,
  Search,
  ArrowRight,
  Pencil,
} from "lucide-react";
import { NumericInput } from "./interaction";
import { FreeLoading } from "./FreeLoading";
import { PreviewZoom } from "./PreviewZoom";
import "./freeScene";
import { SourceInspector } from "./SourceInspector";
import type { SourceSelection } from "./SourceInspector";
import type { SourceDesign } from "./freeform";
import type { LayerSvg } from "./FreeLayers";
import { blankFreePage, freeText } from "./freeform";
import type { FreeDocument, FreePage } from "./freeform";
import type { Resume } from "./flow";
import "./free-studio.css";

type Item = FabricObject & {
  id?: string;
  label?: string;
  link?: string;
  plane?: "background" | "foreground";
};
export interface FreeStudioApi {
  flush: () => void;
  undo: () => void;
  redo: () => void;
  print: () => Promise<void>;
}
interface Props {
  doc: Resume;
  apiRef: RefObject<FreeStudioApi | null>;
  onChange: (data: FreeDocument) => void;
  onMode: (mode: "simple" | "md") => void;
  onRebuild?: () => void;
  onResizeLeft?: (event: ReactPointerEvent) => void;
  onNudgeLeft?: (delta: number) => void;
  renderPaper?: (
    page: number,
    scale?: number,
    options?: { hideDecorations?: boolean; layers?: LayerSvg },
  ) => ReactNode;
  previewZoom?: number;
  fitPreview?: boolean;
  onFitZoom?: (value: number) => void;
  onFitPreview?: () => void;
  onZoomChange?: (value: number) => void;
  onRestore?: () => void;
  sourcePageCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSourceText?: (id: string, text: string) => void;
}

const base = {
  originX: "left" as const,
  originY: "top" as const,
  cornerColor: "#b8755970",
  borderColor: "#b8755980",
  borderOpacityWhenMoving: 0.35,
  cornerStyle: "circle" as const,
  transparentCorners: true,
  cornerSize: 7,
  padding: 2,
};
const iconSet = {
  邮箱: Mail,
  电话: Phone,
  GitHub: Github,
  教育: GraduationCap,
  工作: BriefcaseBusiness,
  奖项: Award,
  位置: MapPin,
  网站: Globe,
  技术: Code2,
  链接: Link,
  完成: Check,
  星标: Star,
  搜索: Search,
  箭头: ArrowRight,
};
const cloneData = <T,>(data: T): T => structuredClone(data);
const isText = (o?: FabricObject | null): o is Textbox => o instanceof IText;
const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
function Tool({
  name,
  children,
  onClick,
  pressed,
  disabled,
}: {
  name: string;
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function FreeStudio({
  doc,
  apiRef,
  onChange,
  onMode,
  renderPaper,
  previewZoom,
  fitPreview,
  onFitZoom,
  onFitPreview,
  onZoomChange,
  onRestore,
  onResizeLeft,
  onNudgeLeft,
  sourcePageCount = 0,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSourceText,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    flowRoot = useRef<HTMLDivElement>(null);
  const scene = useRef<Canvas | null>(null),
    model = useRef<FreeDocument>(cloneData(doc.freeform!)),
    activePage = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const history = useRef<string[]>([JSON.stringify(model.current)]),
    cursor = useRef(0),
    loading = useRef(false),
    alive = useRef(true);
  const updateRef = useRef<() => void>(() => {}),
    commitRef = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    imageInput = useRef<HTMLInputElement>(null);
  const clipboard = useRef<Item[]>([]),
    guides = useRef({ x: -1, y: -1 }),
    panning = useRef<{
      x: number;
      y: number;
      left: number;
      top: number;
    } | null>(null);
  const emitted = useRef(doc.freeform);
  const loadAbort = useRef<AbortController | null>(null);
  const publish = (data: FreeDocument) => {
    const next = cloneData(data);
    emitted.current = next;
    onChangeRef.current(next);
  };
  const frontLayer = useRef<HTMLDivElement>(null);
  const detailPreview = useRef<HTMLDivElement>(null);
  const updateDetailPreview = useRef<() => void>(() => {});
  const [sourceSelection, setSourceSelection] =
    useState<SourceSelection | null>(null);
  const flowBase = doc.freeform?.base === "flow" && !!renderPaper;
  const zoomRef = useRef(0.75),
    toolRef = useRef<"select" | "hand" | "draw">("select");
  const [pageIndex, setPageIndex] = useState(0),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [localZoom, setLocalZoom] = useState(0.75);
  const zoom = previewZoom ?? localZoom;
  const setZoom = (value: SetStateAction<number>) => {
    const next = typeof value === "function" ? value(zoomRef.current) : value;
    zoomRef.current = next;
    setLocalZoom(next);
    onZoomChange?.(next);
  };
  const [autoFit, setAutoFit] = useState(previewZoom === undefined),
    [tool, setTool] = useState<"select" | "hand" | "draw">("select");
  const [leftTab, setLeftTab] = useState<"insert" | "objects">("insert"),
    [mobilePanel, setMobilePanel] = useState<
      "canvas" | "insert" | "properties"
    >("canvas");
  const [keepRatio, setKeepRatio] = useState(true);
  const [grid, setGrid] = useState(true),
    [snap, setSnap] = useState(true),
    snapRef = useRef(snap);
  snapRef.current = snap;
  const [help, setHelp] = useState(false),
    [confirm, setConfirm] = useState<"delete-page" | null>(null);
  const [printPages, setPrintPages] = useState<
      { svg: string; page: FreePage; layers?: LayerSvg; sourceIndex?: number }[]
    >([]),
    [printing, setPrinting] = useState(false);
  const exportInFlight = useRef(false);
  const [tableRows, setTableRows] = useState(3),
    [tableCols, setTableCols] = useState(2);
  const [selection, setSelection] = useState<Item[]>([]);
  const page = model.current.pages[pageIndex] || model.current.pages[0];
  const one = selection.length === 1 ? selection[0] : undefined,
    text = isText(one) ? one : undefined;
  const selectedTextStyle =
    text?.isEditing && text.selectionEnd > text.selectionStart
      ? text.getSelectionStyles()[0] || {}
      : {};
  const textWeight = selectedTextStyle.fontWeight ?? text?.fontWeight;
  const textItalic =
    (selectedTextStyle.fontStyle ?? text?.fontStyle) === "italic";
  const textUnderline = selectedTextStyle.underline ?? text?.underline;
  const textStrike = selectedTextStyle.linethrough ?? text?.linethrough;

  zoomRef.current = zoom;
  toolRef.current = tool;

  updateDetailPreview.current = () => {
    const c = scene.current,
      viewport = detailPreview.current;
    const selected = c?.getActiveObject();
    if (
      !c ||
      !viewport ||
      !selected ||
      !viewport.parentElement?.hasAttribute("open")
    )
      return;
    const p = model.current.pages[activePage.current];
    const r = selected.getBoundingRect(),
      factor = 2;
    const source = host.current
      ?.querySelector<HTMLElement>(".free-source-paper > .resume-paper")
      ?.cloneNode(true) as HTMLElement | undefined;
    if (source) {
      source.style.transform = "none";
      source.style.pointerEvents = "none";
      source
        .querySelectorAll("[contenteditable], [data-edit], [data-line], [id]")
        .forEach((el) => {
          for (const attr of [
            "contenteditable",
            "data-edit",
            "data-line",
            "id",
          ])
            el.removeAttribute(attr);
        });
      source
        .querySelectorAll(".free-layer, .row-tools, .picture-handle")
        .forEach((el) => el.remove());
    }
    const layer = (background: boolean) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" style="position:absolute;inset:0" viewBox="0 0 ${p.width} ${p.height}">${c
        .getObjects()
        .filter(
          (o) =>
            o.visible && ((o as Item).plane === "background") === background,
        )
        .map((o) => {
          const markup = o.toSVG();
          return o.group instanceof ActiveSelection
            ? `<g transform="matrix(${o.group.calcTransformMatrix().join(" ")})">${markup}</g>`
            : markup;
        })
        .join("")}</svg>`;
    const sheet = document.createElement("div");
    sheet.style.cssText = `position:absolute;width:${p.width}px;height:${p.height}px;background:${p.background};transform-origin:0 0;transform:translate(${viewport.clientWidth / 2 - (r.left + r.width / 2) * factor}px,${viewport.clientHeight / 2 - (r.top + r.height / 2) * factor}px) scale(${factor})`;
    sheet.innerHTML = layer(true);
    if (source) sheet.append(source);
    sheet.insertAdjacentHTML("beforeend", layer(false));
    viewport.replaceChildren(sheet);
  };
  useEffect(() => {
    updateDetailPreview.current();
  }, [selection, zoom, doc]);
  const reflect = () => {
    const selected = (scene.current?.getActiveObjects() || []) as Item[];
    setSelection(selected);
    if (selected.length) setSourceSelection(null);
    setRevision((n) => n + 1);
  };
  updateRef.current = reflect;
  const snapshot = () => {
    const c = scene.current;
    if (c && !loading.current)
      model.current.pages[activePage.current].canvas = {
        version: "7.4.0",
        objects: (c.toObject() as FreePage["canvas"]).objects,
      };
    return model.current;
  };
  const commit = () => {
    clearTimeout(timer.current);
    if (loading.current || !alive.current) return;
    const data = snapshot(),
      serialized = JSON.stringify(data);
    if (serialized !== history.current[cursor.current]) {
      history.current = history.current.slice(0, cursor.current + 1);
      history.current.push(serialized);
      while (
        history.current.length > 40 ||
        (history.current.length > 2 &&
          history.current.reduce((n, s) => n + s.length, 0) > 30000000)
      )
        history.current.shift();
      cursor.current = history.current.length - 1;
      publish(data);
    }
    reflect();
  };
  commitRef.current = commit;
  const loadPage = async (index: number) => {
    const c = scene.current;
    if (!c) return;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    loading.current = true;
    setBusy(true);
    c.discardActiveObject();
    try {
      const p = model.current.pages[index];
      await c.loadFromJSON(p.canvas, undefined, { signal: controller.signal });
      if (!alive.current || scene.current !== c || controller.signal.aborted)
        return;
      c.backgroundColor = flowBase ? "" : p.background;
      c.setDimensions({
        width: p.width * zoomRef.current,
        height: p.height * zoomRef.current,
      });
      c.setZoom(zoomRef.current);
      c.getObjects().forEach((o) => {
        o.set({ ...base });
        o.setCoords();
      });
      activePage.current = index;
      setPageIndex(index);
      setSelection([]);
      c.requestRenderAll();
    } catch {
      if (scene.current === c && !controller.signal.aborted)
        setError("这页暂时无法打开。原始自由稿仍在，可从文件菜单下载备份。");
    } finally {
      if (scene.current === c && loadAbort.current === controller) {
        loading.current = false;
        if (alive.current) {
          setBusy(false);
          reflect();
        }
      }
    }
  };
  const travel = async (direction: number) => {
    if (loading.current) return;
    if (flowBase && onUndo && onRedo) {
      commit();
      direction < 0 ? onUndo() : onRedo();
      return;
    }
    commit();
    const next = cursor.current + direction;
    if (next < 0 || next >= history.current.length) return;
    cursor.current = next;
    model.current = JSON.parse(history.current[next]);
    await loadPage(
      Math.min(activePage.current, model.current.pages.length - 1),
    );
    publish(model.current);
    reflect();
  };
  const withScene = (action: (c: Canvas) => void) => {
    const c = scene.current;
    if (!c || loading.current) return;
    action(c);
    c.getObjects().forEach((o) => o.setCoords());
    c.requestRenderAll();
    commit();
  };
  const add = (items: Item[], label: string, group = false) => {
    withScene((c) => {
      c.discardActiveObject();
      const objects: Item[] = group
        ? [
            new Group(items, {
              ...base,
              subTargetCheck: true,
              interactive: true,
            }),
          ]
        : items;
      objects.forEach((o) => {
        o.set({
          ...base,
          id: crypto.randomUUID(),
          label: o.label || label,
          plane:
            flowBase &&
            (o instanceof Rect ||
              o instanceof Circle ||
              o instanceof Triangle ||
              o instanceof FabricLine)
              ? "background"
              : "foreground",
        });
        c.add(o);
      });
      c.setActiveObject(
        objects.length === 1
          ? objects[0]
          : new ActiveSelection(objects, { ...base, canvas: c }),
      );
    });
    setTool("select");
    setMobilePanel("canvas");
  };
  const insertText = (value = "在这里写下你的内容", size = 16) =>
    add(
      [
        new Textbox(value, {
          ...base,
          left: 60,
          top: 80,
          width: Math.min(340, page.width - 100),
          fontFamily: "Noto Sans SC",
          fontSize: size,
          fill: "#171717",
          splitByGrapheme: true,
          lineHeight: 1.4,
        }),
      ],
      value.slice(0, 18),
    );
  const patch = (values: Record<string, unknown>) =>
    withScene((c) => {
      c.getActiveObjects().forEach((o) => {
        if (isText(o) && o.isEditing && o.selectionEnd > o.selectionStart)
          o.setSelectionStyles(values as TextStyleDeclaration);
        else {
          o.set(values);
          if (o instanceof Group) {
            const paint = Object.fromEntries(
              Object.entries(values).filter(([k]) =>
                ["fill", "stroke", "strokeWidth", "strokeDashArray"].includes(
                  k,
                ),
              ),
            );
            const paintChildren = (group: Group) =>
              group.getObjects().forEach((child) => {
                child.set(paint);
                if (child instanceof Group) paintChildren(child);
              });
            if (Object.keys(paint).length) paintChildren(o);
          }
          if (isText(o))
            for (const line of Object.values(o.styles))
              for (const style of Object.values(line)) {
                for (const key of [
                  "fontSize",
                  "fontWeight",
                  "fontStyle",
                  "underline",
                  "linethrough",
                  "fill",
                  "fontFamily",
                ])
                  if (key in values)
                    Object.assign(style, { [key]: values[key] });
              }
        }
        o.setCoords();
      });
    });
  const remove = () =>
    withScene((c) => {
      const selected = c.getActiveObjects();
      c.discardActiveObject();
      selected.forEach((o) => {
        if (o.group && !(o.group instanceof ActiveSelection)) o.group.remove(o);
        else c.remove(o);
      });
    });
  const copy = async (duplicate = false) => {
    const c = scene.current;
    const objects = (c?.getActiveObjects() as Item[]) || [];
    if (!objects.length) return;
    // ActiveSelection children use group-relative coordinates. Restore page coordinates first.
    const multiple = objects.length > 1;
    if (multiple) c!.discardActiveObject();
    clipboard.current = await Promise.all(
      objects.map((o) => o.clone() as Promise<Item>),
    );
    if (!alive.current) return;
    if (multiple) {
      c!.setActiveObject(new ActiveSelection(objects, { ...base, canvas: c! }));
      c!.requestRenderAll();
    }
    if (duplicate) await paste();
  };
  const paste = async () => {
    if (!clipboard.current.length || loading.current) return;
    const objects = await Promise.all(
      clipboard.current.map((o) => o.clone() as Promise<Item>),
    );
    if (!alive.current) return;
    objects.forEach((o) => o.set({ left: o.left + 16, top: o.top + 16 }));
    add(objects, "副本");
  };
  const groupSelection = () =>
    withScene((c) => {
      const objects = c.getActiveObjects();
      if (objects.length < 2) return;
      c.discardActiveObject();
      c.remove(...objects);
      const g = new Group(objects, {
        ...base,
        subTargetCheck: true,
        interactive: true,
      });
      g.set({ id: crypto.randomUUID(), label: "组合" } as object);
      c.add(g);
      c.setActiveObject(g);
    });
  const ungroup = () =>
    withScene((c) => {
      const o = c.getActiveObject();
      if (!(o instanceof Group) || o instanceof ActiveSelection) return;
      c.discardActiveObject();
      const children = o.removeAll();
      c.remove(o);
      children.forEach((v) => v.set({ ...base, id: crypto.randomUUID() }));
      c.add(...children);
      c.setActiveObject(new ActiveSelection(children, { ...base, canvas: c }));
    });
  const align = (
    axis: "left" | "center" | "right" | "top" | "middle" | "bottom",
  ) =>
    withScene((c) => {
      const objects = c.getActiveObjects();
      if (!objects.length) return;
      c.discardActiveObject();
      const rects = objects.map((o) => o.getBoundingRect());
      const box =
        objects.length === 1
          ? { left: 0, top: 0, width: page.width, height: page.height }
          : {
              left: Math.min(...rects.map((r) => r.left)),
              top: Math.min(...rects.map((r) => r.top)),
              width:
                Math.max(...rects.map((r) => r.left + r.width)) -
                Math.min(...rects.map((r) => r.left)),
              height:
                Math.max(...rects.map((r) => r.top + r.height)) -
                Math.min(...rects.map((r) => r.top)),
            };
      objects.forEach((o) => {
        const r = o.getBoundingRect();
        if (axis === "left") o.left += box.left - r.left;
        if (axis === "right") o.left += box.left + box.width - r.left - r.width;
        if (axis === "center")
          o.left += box.left + (box.width - r.width) / 2 - r.left;
        if (axis === "top") o.top += box.top - r.top;
        if (axis === "bottom") o.top += box.top + box.height - r.top - r.height;
        if (axis === "middle")
          o.top += box.top + (box.height - r.height) / 2 - r.top;
        o.setCoords();
      });
      c.setActiveObject(
        objects.length === 1
          ? objects[0]
          : new ActiveSelection(objects, { ...base, canvas: c }),
      );
    });
  const distribute = (horizontal: boolean) =>
    withScene((c) => {
      const objects = c.getActiveObjects();
      if (objects.length < 3) return;
      c.discardActiveObject();
      objects.sort((a, b) =>
        horizontal
          ? a.getBoundingRect().left - b.getBoundingRect().left
          : a.getBoundingRect().top - b.getBoundingRect().top,
      );
      const rects = objects.map((o) => o.getBoundingRect()),
        first = rects[0],
        last = rects.at(-1)!;
      const extent = horizontal
        ? last.left + last.width - first.left
        : last.top + last.height - first.top;
      const gap =
        (extent -
          rects.reduce((n, r) => n + (horizontal ? r.width : r.height), 0)) /
        (objects.length - 1);
      let position = horizontal ? first.left : first.top;
      objects.forEach((o, i) => {
        if (horizontal) o.left += position - rects[i].left;
        else o.top += position - rects[i].top;
        position += (horizontal ? rects[i].width : rects[i].height) + gap;
        o.setCoords();
      });
      c.setActiveObject(new ActiveSelection(objects, { ...base, canvas: c }));
    });
  const order = (action: "front" | "back" | "up" | "down") =>
    withScene((c) => {
      c.getActiveObjects().forEach((o) => {
        if (action === "front") c.bringObjectToFront(o);
        if (action === "back") c.sendObjectToBack(o);
        if (action === "up") c.bringObjectForward(o);
        if (action === "down") c.sendObjectBackwards(o);
      });
    });
  const insertIcon = async (name: keyof typeof iconSet) => {
    // Lucide nodes are static application assets, never user-provided SVG markup.
    const Icon = iconSet[name];
    const { createRoot } = await import("react-dom/client");
    const rootNode = document.createElement("div");
    const root = createRoot(rootNode);
    flushSync(() =>
      root.render(<Icon size={28} color={doc.settings.accent} />),
    );
    const markup = rootNode.innerHTML;
    root.unmount();
    const result = await loadSVGFromString(markup);
    const object = util.groupSVGElements(
      result.objects.filter((o): o is FabricObject => !!o),
      result.options,
    );
    object.set({ ...base, left: 60, top: 80 });
    object.scaleToWidth(28);
    add([object], name);
  };
  const uploadImage = async (file: File) => {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 15000000
    ) {
      setError("请选择 15 MB 以内的 PNG、JPEG 或 WebP 图片。");
      return;
    }
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = await FabricImage.fromURL(src);
      const el = img.getElement() as HTMLImageElement;
      const out = document.createElement("canvas"),
        ratio = Math.min(1, 1400 / Math.max(img.width, img.height));
      out.width = img.width * ratio;
      out.height = img.height * ratio;
      out.getContext("2d")!.drawImage(el, 0, 0, out.width, out.height);
      const optimized = await FabricImage.fromURL(
        out.toDataURL(
          file.type === "image/png" ? "image/png" : "image/jpeg",
          0.88,
        ),
      );
      if (!alive.current) return;
      optimized.set({ ...base, left: 60, top: 80 });
      optimized.scaleToWidth(Math.min(180, optimized.width));
      add([optimized], file.name);
    } catch {
      setError("图片未能读取，请换一张图片。");
    }
  };
  const insertTable = () => {
    const objects: Item[] = [],
      w = Math.min(560, page.width - 100) / tableCols,
      h = 38;
    for (let r = 0; r < tableRows; r++)
      for (let col = 0; col < tableCols; col++) {
        objects.push(
          new Rect({
            ...base,
            left: 50 + col * w,
            top: 100 + r * h,
            width: w,
            height: h,
            fill: r === 0 ? "#eef2f6" : "#ffffff",
            stroke: "#bbc2ca",
            strokeWidth: 1,
          }),
        );
        objects.push(
          new Textbox(r === 0 ? `栏目 ${col + 1}` : "填写内容", {
            ...base,
            left: 58 + col * w,
            top: 108 + r * h,
            width: w - 16,
            fontSize: 13,
            fontFamily: "Noto Sans SC",
            fill: "#171717",
            splitByGrapheme: true,
          }),
        );
      }
    add(objects, "表格", true);
  };
  const insertBlock = (columns: boolean) => {
    const heading = new Textbox("经历标题", {
      ...base,
      left: 50,
      top: 80,
      width: page.width - 100,
      fontFamily: "Noto Sans SC",
      fontSize: 19,
      fontWeight: 700,
      fill: doc.settings.accent,
    });
    const rule = new Rect({
      ...base,
      left: 50,
      top: 111,
      width: page.width - 100,
      height: 1,
      fill: doc.settings.accent,
    });
    const first = new Textbox(
      columns
        ? "左侧内容\n填写经历、职责或技能。"
        : "公司 / 项目名称                         起止时间\n• 写下你的具体贡献\n• 用真实结果说明工作成果",
      {
        ...base,
        left: 50,
        top: 124,
        width: columns ? (page.width - 120) / 2 : page.width - 100,
        fontSize: 14,
        fontFamily: "Noto Sans SC",
        fill: "#171717",
        lineHeight: 1.5,
        splitByGrapheme: true,
      },
    );
    const objects: Item[] = [heading, rule, first];
    if (columns)
      objects.push(
        new Textbox("右侧内容\n填写补充说明。", {
          ...base,
          left: page.width / 2 + 10,
          top: 124,
          width: (page.width - 120) / 2,
          fontSize: 14,
          fontFamily: "Noto Sans SC",
          fill: "#171717",
          lineHeight: 1.5,
          splitByGrapheme: true,
        }),
      );
    add(objects, columns ? "双栏板块" : "经历板块", true);
  };
  const newPage = async (duplicate = false) => {
    if (model.current.pages.length >= 20 || loading.current) return;
    snapshot();
    const next = duplicate
      ? cloneData(page)
      : { ...blankFreePage(), width: page.width, height: page.height };
    next.id = crypto.randomUUID();
    model.current.pages.splice(pageIndex + 1, 0, next);
    await loadPage(pageIndex + 1);
    commit();
  };
  const moveToPage = (index: number) => {
    if (index === pageIndex || index < 0) return;
    withScene((c) => {
      const objects = c.getActiveObjects();
      c.discardActiveObject();
      model.current.pages[index].canvas.objects.push(
        ...objects.map((o) => o.toObject()),
      );
      c.remove(...objects);
    });
  };
  const makeSvg = async (p: FreePage) =>
    (await import("./freeScene")).sceneSvg(p);
  const exportImage = async (format: "png" | "svg") => {
    if (exportInFlight.current) return;
    exportInFlight.current = true;
    commit();
    setBusy(true);
    try {
      let url: string;
      if (flowBase) {
        const p = cloneData(model.current.pages[activePage.current]);
        const { sceneSvg } = await import("./freeScene");
        const layers = {
          background: await sceneSvg(p, "background"),
          foreground: await sceneSvg(p, "foreground"),
        };
        flushSync(() =>
          setPrintPages([
            { svg: "", page: p, layers, sourceIndex: activePage.current },
          ]),
        );
        const root = flowRoot.current!;
        root.style.cssText =
          "display:block;position:fixed;left:-20000px;top:0;pointer-events:none";
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        const paper = root.querySelector<HTMLElement>(".resume-paper");
        if (!paper) throw new Error("原稿尚未准备好");
        url = await (await import("./domExport")).exportPaper(paper, format);
      } else if (format === "svg") {
        const svg = await makeSvg(page);
        download(`${doc.name}-第${pageIndex + 1}页.svg`, svg, "image/svg+xml");
        return;
      } else {
        const c = new StaticCanvas(undefined, {
          width: page.width,
          height: page.height,
        });
        try {
          await c.loadFromJSON(page.canvas);
          c.backgroundColor = page.background;
          url = c.toDataURL({ format: "png", multiplier: 2 });
        } finally {
          await c.dispose();
        }
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.name}-第${pageIndex + 1}页.${format}`;
      a.click();
    } catch {
      setError("导出失败，请下载可编辑备份后重试。");
    } finally {
      if (flowRoot.current) flowRoot.current.style.cssText = "";
      setPrintPages([]);
      exportInFlight.current = false;
      setBusy(false);
    }
  };
  const setSourceDesign = (patch: Partial<SourceDesign>, frame = false) => {
    if (!sourceSelection) return;
    const id = sourceSelection.id,
      current = model.current.sourceDesign?.[id] || {};
    let design: SourceDesign;
    if (sourceSelection.tag !== undefined && !frame)
      design = {
        ...current,
        tags: {
          ...current.tags,
          [sourceSelection.tag]: {
            ...current.tags?.[sourceSelection.tag],
            ...patch,
          },
        },
      };
    else design = { ...current, ...patch };
    model.current.sourceDesign = {
      ...model.current.sourceDesign,
      [id]: design,
    };
    commit();
  };
  const print = async () => {
    if (loading.current || exportInFlight.current) return;
    exportInFlight.current = true;
    commit();
    const exportPages = cloneData(model.current.pages);
    setBusy(true);
    setError("");
    try {
      await document.fonts.ready;
      const result: {
        svg: string;
        page: FreePage;
        layers?: LayerSvg;
        sourceIndex?: number;
      }[] = [];
      for (const p of exportPages)
        result.push({
          svg: flowBase ? "" : await makeSvg(p),
          page: cloneData(p),
          ...(flowBase
            ? {
                layers: {
                  background: await (
                    await import("./freeScene")
                  ).sceneSvg(p, "background"),
                  foreground: await (
                    await import("./freeScene")
                  ).sceneSvg(p, "foreground"),
                },
              }
            : {}),
        });
      if (!alive.current) return;
      flushSync(() => {
        setPrintPages(result);
        setPrinting(true);
      });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      if (alive.current) window.print();
    } catch {
      setError("导出准备失败，请下载可编辑备份后重试。");
    } finally {
      exportInFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const api = {
    flush: commit,
    undo: () => {
      void travel(-1);
    },
    redo: () => {
      void travel(1);
    },
    print,
  };
  apiRef.current = api;

  useEffect(() => {
    alive.current = true;
    const el = document.createElement("canvas");
    host.current!.appendChild(el);
    const c = new Canvas(el, {
      width: page.width,
      height: page.height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selectionColor: "#b8755915",
      selectionBorderColor: "#b8755980",
      enableRetinaScaling: true,
    });
    scene.current = c;
    const modified = () => commitRef.current();
    const select = () => updateRef.current();
    c.on("object:modified", modified);
    const hidden: Item[] = [];
    c.on("before:render", () => {
      if (!flowBase) return;
      hidden.length = 0;
      c.getObjects().forEach((item) => {
        const o = item as Item;
        if (o.visible && o.plane !== "background") {
          hidden.push(o);
          o.visible = false;
        }
      });
    });
    c.on("after:render", () => {
      hidden.forEach((o) => {
        o.visible = true;
      });
      if (flowBase && frontLayer.current) {
        const svg = c
          .getObjects()
          .filter((o) => o.visible && (o as Item).plane !== "background")
          .map((o) => {
            const markup = o.toSVG();
            return o.group instanceof ActiveSelection
              ? `<g transform="matrix(${o.group.calcTransformMatrix().join(" ")})">${markup}</g>`
              : markup;
          })
          .join("");
        frontLayer.current.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${model.current.pages[activePage.current].width} ${model.current.pages[activePage.current].height}">${svg}</svg>`;
      }
      updateDetailPreview.current();
      if (flowBase) {
        if (toolRef.current !== "select") {
          c.upperCanvasEl.style.clipPath = "";
          return;
        }
        const z = zoomRef.current,
          paths: string[] = [];
        const rectangle = (x: number, y: number, w: number, h: number) =>
          paths.push(`M${x * z} ${y * z}h${w * z}v${h * z}h${-w * z}Z`);
        c.getObjects()
          .filter((o) => o.visible)
          .forEach((item) => {
            const r = item.getBoundingRect(),
              pad = c.getActiveObjects().includes(item) ? 42 : 4;
            if ((item as Item).plane === "background") {
              rectangle(r.left - pad, r.top - pad, r.width + pad * 2, pad + 5);
              rectangle(
                r.left - pad,
                r.top + r.height - 5,
                r.width + pad * 2,
                pad + 5,
              );
              rectangle(r.left - pad, r.top, pad + 5, r.height);
              rectangle(r.left + r.width - 5, r.top, pad + 5, r.height);
            } else
              rectangle(
                r.left - pad,
                r.top - pad,
                r.width + pad * 2,
                r.height + pad * 2,
              );
          });
        c.upperCanvasEl.style.clipPath = paths.length
          ? `path('${paths.join(" ")}')`
          : "inset(50%)";
      }
    });
    c.on("selection:created", select);
    c.on("selection:updated", select);
    c.on("selection:cleared", select);
    c.on("text:changed", () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => commitRef.current(), 180);
    });
    c.on("text:editing:exited", modified);
    c.on("text:selection:changed", select);
    c.freeDrawingBrush = new PencilBrush(c);
    c.freeDrawingBrush.color = doc.settings.accent;
    c.freeDrawingBrush.width = 2;
    c.on("path:created", ({ path }) => {
      path.set({ ...base, id: crypto.randomUUID(), label: "手绘线条" });
      modified();
    });
    c.on("object:moving", ({ target }) => {
      if (!snapRef.current) return;
      const p = model.current.pages[activePage.current],
        r = target.getBoundingRect();
      const xs = [0, 42, p.width / 2, p.width - 42, p.width],
        ys = [0, 31, p.height / 2, p.height - 31, p.height];
      c.getObjects()
        .filter((o) => o !== target && !c.getActiveObjects().includes(o))
        .forEach((o) => {
          const b = o.getBoundingRect();
          xs.push(b.left, b.left + b.width / 2, b.left + b.width);
          ys.push(b.top, b.top + b.height / 2, b.top + b.height);
        });
      guides.current = { x: -1, y: -1 };
      for (const [axis, targets, points] of [
        ["x", xs, [r.left, r.left + r.width / 2, r.left + r.width]],
        ["y", ys, [r.top, r.top + r.height / 2, r.top + r.height]],
      ] as const) {
        let delta = 5,
          found: number | undefined;
        for (const guide of targets)
          for (const point of points)
            if (Math.abs(guide - point) < Math.abs(delta)) {
              delta = guide - point;
              found = guide;
            }
        if (found !== undefined) {
          if (axis === "x") target.left += delta;
          else target.top += delta;
          guides.current[axis] = found;
        }
      }
      const v = host.current?.querySelector<HTMLElement>(".free-guide-v"),
        h = host.current?.querySelector<HTMLElement>(".free-guide-h");
      if (v) {
        v.style.display = guides.current.x < 0 ? "none" : "block";
        v.style.left = guides.current.x * zoomRef.current + "px";
      }
      if (h) {
        h.style.display = guides.current.y < 0 ? "none" : "block";
        h.style.top = guides.current.y * zoomRef.current + "px";
      }
    });
    c.on("mouse:up", () =>
      host.current
        ?.querySelectorAll<HTMLElement>(".free-guide")
        .forEach((el) => {
          el.style.display = "none";
        }),
    );
    void loadPage(0);
    return () => {
      commitRef.current();
      alive.current = false;
      clearTimeout(timer.current);
      apiRef.current = null;
      if (scene.current === c) scene.current = null;
      void c.dispose().then(() => el.remove());
    };
  }, []);
  useEffect(() => {
    if (!flowBase || !doc.freeform || emitted.current === doc.freeform) return;
    emitted.current = doc.freeform;
    model.current = cloneData(doc.freeform);
    void loadPage(Math.min(activePage.current, model.current.pages.length - 1));
  }, [doc.freeform]);
  useEffect(() => {
    if (!sourceSelection || !flowBase) return;
    const row = host.current?.querySelector<HTMLElement>(
      `[data-line="${sourceSelection.id}"]`,
    );
    const target =
      sourceSelection.tag === undefined
        ? row
        : row?.querySelector<HTMLElement>(
            `code[data-free-tag="${sourceSelection.tag}"]`,
          );
    if (!target) setSourceSelection(null);
    else if (target !== sourceSelection.target)
      setSourceSelection({ ...sourceSelection, target });
  }, [doc.lines]);
  useEffect(() => {
    const c = scene.current;
    if (!c) return;
    c.isDrawingMode = tool === "draw";
    c.selection = tool === "select";
    c.skipTargetFind = tool === "hand";
    c.defaultCursor = tool === "hand" ? "grab" : "default";
    c.requestRenderAll();
  }, [tool]);
  useEffect(() => {
    const c = scene.current;
    if (!c) return;
    c.setDimensions({ width: page.width * zoom, height: page.height * zoom });
    c.setZoom(zoom);
    c.requestRenderAll();
  }, [zoom, page.width, page.height]);
  useEffect(() => {
    if (!flowBase) return;
    const data = model.current,
      previous = data.pages.length,
      size = data.pages[0],
      needed = Math.min(20, sourcePageCount);
    while (data.pages.length < needed)
      data.pages.push({
        ...blankFreePage(),
        width: size.width,
        height: size.height,
        background: size.background,
      });
    while (
      data.pages.length > Math.max(1, needed) &&
      !data.pages.at(-1)!.canvas.objects.length
    )
      data.pages.pop();
    if (previous !== data.pages.length) {
      commit();
      if (activePage.current >= data.pages.length)
        void loadPage(data.pages.length - 1);
    }
    if (sourcePageCount > 20)
      setError(
        "自由模式最多支持20页，超出部分仍保留在简单编辑与 Markdown 中。",
      );
  }, [sourcePageCount]);
  useEffect(() => {
    if (!(previewZoom === undefined ? autoFit : fitPreview) || !scroll.current)
      return;
    const fit = () => {
      const area = scroll.current!;
      if (area.clientWidth <= 0) return;
      const value = Math.min(
        2,
        Math.max(
          0.2,
          (area.clientWidth -
            parseFloat(getComputedStyle(area).paddingLeft) -
            parseFloat(getComputedStyle(area).paddingRight) -
            2) /
            page.width,
        ),
      );
      if (onFitZoom) onFitZoom(value);
      else setZoom(value);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(scroll.current);
    fit();
    return () => observer.disconnect();
  }, [autoFit, page.width, mobilePanel, fitPreview]);
  useEffect(() => {
    const after = () => {
      setPrinting(false);
      setPrintPages([]);
    };
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement,
        editing = scene.current
          ?.getActiveObjects()
          .some((o) => isText(o) && o.isEditing);
      if (
        target.closest('input,textarea,select,[contenteditable="true"]') ||
        editing ||
        loading.current
      )
        return;
      const command = e.ctrlKey || e.metaKey;
      if (
        command &&
        ["z", "y", "d", "g", "c", "v", "a", "s"].includes(e.key.toLowerCase())
      )
        e.preventDefault();
      if (command && e.key.toLowerCase() === "z") {
        void travel(e.shiftKey ? 1 : -1);
        return;
      }
      if (command && e.key.toLowerCase() === "y") {
        void travel(1);
        return;
      }
      if (command && e.key.toLowerCase() === "d") {
        void copy(true);
        return;
      }
      if (command && e.key.toLowerCase() === "c") {
        void copy();
        return;
      }
      if (command && e.key.toLowerCase() === "v") {
        void paste();
        return;
      }
      if (command && e.key.toLowerCase() === "g") {
        e.shiftKey ? ungroup() : groupSelection();
        return;
      }
      if (command && e.key.toLowerCase() === "a") {
        const c = scene.current!;
        c.discardActiveObject();
        c.setActiveObject(
          new ActiveSelection(
            c.getObjects().filter((o) => o.selectable),
            { canvas: c },
          ),
        );
        c.requestRenderAll();
        reflect();
        return;
      }
      if (command && e.key.toLowerCase() === "s") {
        commit();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if (e.key === "Escape") {
        scene.current?.discardActiveObject();
        scene.current?.requestRenderAll();
        setConfirm(null);
        setHelp(false);
        reflect();
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        withScene((c) => {
          const o = c.getActiveObject();
          if (!o || o.lockMovementX) return;
          if (e.key === "ArrowLeft") o.left -= step;
          if (e.key === "ArrowRight") o.left += step;
          if (e.key === "ArrowUp") o.top -= step;
          if (e.key === "ArrowDown") o.top += step;
        });
      }
    };
    window.addEventListener("keydown", key);
    const hide = () => commitRef.current();
    window.addEventListener("pagehide", hide);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pagehide", hide);
    };
  });

  const objects = (scene.current?.getObjects() || []) as Item[];
  const overflows = objects.filter((o) => {
    const r = o.getBoundingRect();
    return (
      o.visible &&
      (r.left < -1 ||
        r.top < -1 ||
        r.left + r.width > page.width + 1 ||
        r.top + r.height > page.height + 1)
    );
  });
  void revision;
  return (
    <div className={`free-studio ${printing ? "is-printing" : ""}`}>
      <aside
        className={`free-left ${mobilePanel === "insert" ? "free-mobile-show" : ""}`}
      >
        <div className="editor-heading">
          <div className="mode-tabs" role="tablist" aria-label="编辑方式">
            <button
              role="tab"
              aria-selected={false}
              onClick={() => {
                commit();
                onMode("simple");
              }}
            >
              简单编辑
            </button>
            <button
              role="tab"
              aria-selected={false}
              onClick={() => {
                commit();
                onMode("md");
              }}
            >
              Markdown <span>.md</span>
            </button>
            <button role="tab" aria-selected={true}>
              自由模式
            </button>
          </div>
        </div>
        <div className="free-library-tabs">
          <button
            aria-pressed={leftTab === "insert"}
            onClick={() => setLeftTab("insert")}
          >
            添加元素
          </button>
          <button
            aria-pressed={leftTab === "objects"}
            onClick={() => setLeftTab("objects")}
          >
            画布元素 <span>{objects.length}</span>
          </button>
        </div>
        <div className="free-side-scroll">
          {leftTab === "insert" ? (
            <>
              <section>
                <h3>文字与板块</h3>
                <div className="free-inserts">
                  <button disabled={busy} onClick={() => insertText()}>
                    <Type size={19} />
                    <span>文字</span>
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => insertText("板块标题", 22)}
                  >
                    <Type size={23} />
                    <span>标题</span>
                  </button>
                  <button disabled={busy} onClick={() => insertBlock(false)}>
                    <BriefcaseBusiness size={19} />
                    <span>经历板块</span>
                  </button>
                  <button disabled={busy} onClick={() => insertBlock(true)}>
                    <Grid2X2 size={19} />
                    <span>双栏板块</span>
                  </button>
                </div>
              </section>
              <section>
                <h3>图片与图形</h3>
                <div className="free-inserts">
                  <button
                    disabled={busy}
                    onClick={() => imageInput.current?.click()}
                  >
                    <ImagePlus size={19} />
                    <span>上传图片</span>
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      add(
                        [
                          new Rect({
                            ...base,
                            left: 60,
                            top: 80,
                            width: 180,
                            height: 80,
                            fill: "#edf2f7",
                            stroke: doc.settings.accent,
                            strokeWidth: 1,
                          }),
                        ],
                        "矩形",
                      )
                    }
                  >
                    <Square size={19} />
                    <span>矩形</span>
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      add(
                        [
                          new Circle({
                            ...base,
                            left: 60,
                            top: 80,
                            radius: 42,
                            fill: "#edf2f7",
                            stroke: doc.settings.accent,
                            strokeWidth: 1,
                          }),
                        ],
                        "圆形",
                      )
                    }
                  >
                    <CircleIcon size={19} />
                    <span>圆形</span>
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      add(
                        [
                          new Triangle({
                            ...base,
                            left: 60,
                            top: 80,
                            width: 80,
                            height: 70,
                            fill: doc.settings.accent,
                          }),
                        ],
                        "三角形",
                      )
                    }
                  >
                    <Shapes size={19} />
                    <span>三角形</span>
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      add(
                        [
                          new FabricLine(
                            [0, 0, Math.min(450, page.width - 100), 0],
                            {
                              ...base,
                              left: 50,
                              top: 100,
                              stroke: doc.settings.accent,
                              strokeWidth: 1,
                            },
                          ),
                        ],
                        "分隔线",
                      )
                    }
                  >
                    <Minus size={19} />
                    <span>分隔线</span>
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      add(
                        [
                          new Rect({
                            ...base,
                            left: 50,
                            top: 100,
                            width: Math.min(450, page.width - 100),
                            height: 35,
                            fill: doc.settings.accent,
                            rx: 4,
                            ry: 4,
                          }),
                        ],
                        "标题色带",
                      )
                    }
                  >
                    <Square size={19} fill="currentColor" />
                    <span>标题色带</span>
                  </button>
                </div>
              </section>
              <section>
                <h3>常用图标</h3>
                <div className="free-icons">
                  {Object.entries(iconSet).map(([name, Icon]) => (
                    <button
                      key={name}
                      title={name}
                      aria-label={`插入${name}图标`}
                      disabled={busy}
                      onClick={() => {
                        void insertIcon(name as keyof typeof iconSet).catch(
                          () => setError("图标未能添加，请重试。"),
                        );
                      }}
                    >
                      <Icon size={20} />
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3>表格</h3>
                <div className="free-table-size">
                  <NumericInput
                    label="表格行数"
                    value={tableRows}
                    min={1}
                    max={12}
                    onChange={setTableRows}
                  />
                  <span>行 ×</span>
                  <NumericInput
                    label="表格列数"
                    value={tableCols}
                    min={1}
                    max={6}
                    onChange={setTableCols}
                  />
                  <span>列</span>
                  <button disabled={busy} onClick={insertTable}>
                    插入
                  </button>
                </div>
                <p>组合可整体移动，解组后可分别编辑文字和单元格。</p>
              </section>
            </>
          ) : (
            <section>
              <h3>当前页元素</h3>
              <p>点击定位；锁定可防止误拖，隐藏的元素不参与导出。</p>
              <div className="free-object-list">
                {[...objects].reverse().map((o, i) => (
                  <div
                    key={o.id || i}
                    className={selection.includes(o) ? "selected" : ""}
                  >
                    <button
                      className="free-object-name"
                      onClick={() => {
                        scene.current?.discardActiveObject();
                        scene.current?.setActiveObject(o);
                        scene.current?.requestRenderAll();
                        reflect();
                        setMobilePanel("properties");
                      }}
                    >
                      {isText(o) ? <Type size={14} /> : <Shapes size={14} />}
                      <span>
                        {o.label || (isText(o) ? o.text.slice(0, 20) : "元素")}
                      </span>
                    </button>
                    <Tool
                      name={o.visible ? "隐藏元素" : "显示元素"}
                      onClick={() =>
                        withScene(() => {
                          o.visible = !o.visible;
                        })
                      }
                    >
                      {o.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </Tool>
                    <Tool
                      name={o.lockMovementX ? "解锁元素" : "锁定元素"}
                      onClick={() =>
                        withScene(() => {
                          const lock = !o.lockMovementX;
                          o.set({
                            lockMovementX: lock,
                            lockMovementY: lock,
                            lockScalingX: lock,
                            lockScalingY: lock,
                            lockRotation: lock,
                            hasControls: !lock,
                          });
                        })
                      }
                    >
                      {o.lockMovementX ? (
                        <Lock size={13} />
                      ) : (
                        <Unlock size={13} />
                      )}
                    </Tool>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        {onResizeLeft && (
          <div
            className="free-left-resizer"
            role="separator"
            aria-label="调整编辑区宽度"
            aria-orientation="vertical"
            tabIndex={0}
            onPointerDown={onResizeLeft}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") onNudgeLeft?.(-20);
              if (e.key === "ArrowRight") onNudgeLeft?.(20);
            }}
          />
        )}
      </aside>
      <main
        className={`free-main ${mobilePanel === "canvas" ? "free-mobile-show" : ""}`}
      >
        <div className="preview-toolbar free-preview-toolbar">
          <PreviewZoom
            value={zoom}
            onChange={(value) => {
              setAutoFit(false);
              setZoom(value);
            }}
            onFit={() => {
              if (onFitPreview) {
                onFitPreview();
                return;
              }
              if (scroll.current)
                setZoom(
                  Math.min(
                    2,
                    Math.max(
                      0.2,
                      (scroll.current.clientWidth - 72) / page.width,
                    ),
                  ),
                );
              setAutoFit(previewZoom === undefined);
            }}
          />
        </div>
        <div className="free-toolbar" role="toolbar" aria-label="自由画布工具">
          <Tool
            name="选择与编辑"
            pressed={tool === "select"}
            onClick={() => setTool("select")}
          >
            <MousePointer2 size={17} />
          </Tool>
          <Tool
            name="手绘线条"
            pressed={tool === "draw"}
            onClick={() => setTool("draw")}
          >
            <Pencil size={17} />
          </Tool>
          <Tool
            name="拖动画布"
            pressed={tool === "hand"}
            onClick={() => setTool("hand")}
          >
            <Hand size={17} />
          </Tool>
          <i />
          <Tool
            name="自由模式撤销"
            disabled={
              (flowBase && onUndo ? !canUndo : cursor.current < 1) || busy
            }
            onClick={() => {
              void travel(-1);
            }}
          >
            <Undo2 size={17} />
          </Tool>
          <Tool
            name="自由模式重做"
            disabled={
              (flowBase && onRedo
                ? !canRedo
                : cursor.current >= history.current.length - 1) || busy
            }
            onClick={() => {
              void travel(1);
            }}
          >
            <Redo2 size={17} />
          </Tool>
          <i />
          <Tool
            name="复制选中元素"
            disabled={!selection.length || busy}
            onClick={() => {
              void copy(true);
            }}
          >
            <Copy size={17} />
          </Tool>
          <Tool
            name="删除选中元素"
            disabled={!selection.length || busy}
            onClick={remove}
          >
            <Trash2 size={17} />
          </Tool>
          <Tool
            name="组合 Ctrl+G"
            disabled={selection.length < 2 || busy}
            onClick={groupSelection}
          >
            <GroupIcon size={17} />
          </Tool>
          <Tool
            name="解组 Ctrl+Shift+G"
            disabled={!(one instanceof Group) || busy}
            onClick={ungroup}
          >
            <Ungroup size={17} />
          </Tool>
          <i />
          <label className="free-check">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
            />
            吸附
          </label>
          <label className="free-check">
            <input
              type="checkbox"
              checked={grid}
              onChange={(e) => setGrid(e.target.checked)}
            />
            网格
          </label>
          <Tool name="自由模式使用帮助" onClick={() => setHelp((v) => !v)}>
            <HelpCircle size={17} />
          </Tool>
          {onRestore && (
            <button
              className="free-restore"
              title="恢复首次进入自由模式前的排版，保留文字内容；可以撤销"
              onClick={() => {
                commit();
                onRestore();
              }}
            >
              <RotateCcw size={15} />
              恢复原排版
            </button>
          )}
        </div>
        {error && (
          <div className="free-message" role="alert">
            {error}
            <button onClick={() => setError("")}>关闭</button>
          </div>
        )}
        {overflows.length > 0 && (
          <div className="free-message">
            有 {overflows.length}{" "}
            个元素超出纸张，导出时会被裁切。可调整位置，或移到其他页。
          </div>
        )}
        {help && (
          <div className="free-help">
            <b>像排版软件一样操作</b>
            <p>
              双击文字直接输入；拖动边框移动，拖动控制点缩放或旋转。按住 Shift
              点击可多选，也可从空白处框选。右侧可精确输入位置和尺寸。
            </p>
            <p>
              Ctrl+Z 撤销 · Ctrl+D 复制 · Ctrl+G 组合 · Ctrl+Shift+G 解组 ·
              方向键移动（Shift 加速） · Delete
              删除。照片可上传后裁剪。自由模式不会因拖动元素自动生成空白页。
            </p>
            <button onClick={() => setHelp(false)}>知道了</button>
          </div>
        )}
        <div
          className="free-canvas-scroll"
          ref={scroll}
          onPointerDown={(e) => {
            if (tool !== "hand") return;
            const el = e.currentTarget;
            panning.current = {
              x: e.clientX,
              y: e.clientY,
              left: el.scrollLeft,
              top: el.scrollTop,
            };
            el.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!panning.current) return;
            e.currentTarget.scrollLeft =
              panning.current.left + panning.current.x - e.clientX;
            e.currentTarget.scrollTop =
              panning.current.top + panning.current.y - e.clientY;
          }}
          onPointerUp={() => {
            panning.current = null;
          }}
          onPointerCancel={() => {
            panning.current = null;
          }}
        >
          <div
            className="free-page-frame"
            style={{ width: page.width * zoom, height: page.height * zoom }}
          >
            <span className="free-page-label">
              第 {pageIndex + 1} 页 / 共 {model.current.pages.length} 页
            </span>
            <div
              className={`free-canvas-host ${grid ? "with-grid" : ""} ${flowBase ? "with-source" : ""}`}
              onPointerDownCapture={(e) => {
                if (!flowBase) return;
                const row = (e.target as HTMLElement).closest<HTMLElement>(
                  "[data-line]",
                );
                if (!row) return;
                const tag = (e.target as HTMLElement).closest<HTMLElement>(
                  "code[data-free-tag]",
                );
                scene.current?.discardActiveObject();
                scene.current?.requestRenderAll();
                setSourceSelection({
                  id: row.dataset.line!,
                  ...(tag ? { tag: tag.dataset.freeTag } : {}),
                  target: tag || row,
                });
              }}
              ref={host}
              style={
                {
                  width: page.width * zoom,
                  height: page.height * zoom,
                  "--grid-step": `${20 * zoom}px`,
                  background: page.background,
                } as CSSProperties
              }
            >
              {flowBase && (
                <div className="free-source-paper">
                  {renderPaper?.(pageIndex, zoom, { hideDecorations: true })}
                </div>
              )}
              {flowBase && (
                <div ref={frontLayer} className="free-front-scene" />
              )}
              <div className="free-guide free-guide-v" />
              <div className="free-guide free-guide-h" />
            </div>
          </div>
          {busy && <FreeLoading overlay />}
        </div>
      </main>
      <aside
        className={`free-right ${mobilePanel === "properties" ? "free-mobile-show" : ""}`}
      >
        <div className="free-properties-heading">
          <h2>
            {selection.length
              ? selection.length > 1
                ? `已选择 ${selection.length} 个元素`
                : text
                  ? "文字设置"
                  : one instanceof FabricImage
                    ? "图片设置"
                    : "元素设置"
              : "画布设置"}
          </h2>
        </div>
        <div className="free-side-scroll">
          {selection.length > 0 && (
            <details
              className="free-detail-preview"
              open
              onToggle={() => updateDetailPreview.current()}
            >
              <summary>
                局部预览 <span>2× · 无选框</span>
              </summary>
              <div
                ref={detailPreview}
                className="free-detail-viewport"
                aria-hidden="true"
                inert
              />
            </details>
          )}
          {sourceSelection && flowBase ? (
            <SourceInspector
              selection={sourceSelection}
              container={host.current}
              line={doc.lines.find((l) => l.id === sourceSelection.id)}
              design={
                sourceSelection.tag !== undefined
                  ? model.current.sourceDesign?.[sourceSelection.id]?.tags?.[
                      sourceSelection.tag
                    ] || {}
                  : model.current.sourceDesign?.[sourceSelection.id] || {}
              }
              onChange={setSourceDesign}
              onFrame={(patch) => setSourceDesign(patch, true)}
              onText={(value) => onSourceText?.(sourceSelection.id, value)}
            />
          ) : selection.length ? (
            <>
              <section>
                <h3>位置与尺寸</h3>
                {one ? (
                  <div className="free-property-grid">
                    {(["left", "top", "width", "height", "angle"] as const).map(
                      (key, i) => (
                        <label key={key}>
                          <span>
                            {
                              ["X 位置", "Y 位置", "宽度", "高度", "旋转角度"][
                                i
                              ]
                            }
                          </span>
                          <NumericInput
                            label={
                              [
                                "元素 X 位置",
                                "元素 Y 位置",
                                "元素宽度",
                                "元素高度",
                                "元素旋转角度",
                              ][i]
                            }
                            value={
                              Math.round(
                                (key === "width"
                                  ? one.getScaledWidth()
                                  : key === "height"
                                    ? one.getScaledHeight()
                                    : one[key]) * 10,
                              ) / 10
                            }
                            min={
                              key === "width" || key === "height" ? 1 : -5000
                            }
                            max={5000}
                            step={1}
                            onChange={(n) =>
                              withScene(() => {
                                if (key === "width") {
                                  if (isText(one))
                                    one.set({ width: n / one.scaleX });
                                  else {
                                    const next = n / Math.max(1, one.width);
                                    one.set({
                                      scaleX: next,
                                      ...(keepRatio
                                        ? {
                                            scaleY:
                                              (one.scaleY * next) / one.scaleX,
                                          }
                                        : {}),
                                    });
                                  }
                                } else if (key === "height") {
                                  const next = n / Math.max(1, one.height);
                                  one.set({
                                    scaleY: next,
                                    ...(keepRatio
                                      ? {
                                          scaleX:
                                            (one.scaleX * next) / one.scaleY,
                                        }
                                      : {}),
                                  });
                                } else one.set({ [key]: n });
                              })
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                ) : (
                  <p>多选时使用下方对齐、分布和组合操作。</p>
                )}
                <label className="free-check">
                  <input
                    type="checkbox"
                    checked={keepRatio}
                    onChange={(e) => setKeepRatio(e.target.checked)}
                  />
                  调整尺寸时锁定比例
                </label>
              </section>
              {text && (
                <section>
                  <h3>文字</h3>
                  <label className="free-full-label">
                    内容
                    <textarea
                      aria-label="自由元素文字内容"
                      value={text.text}
                      onChange={(e) =>
                        patch({
                          text: e.target.value,
                          label: e.target.value.slice(0, 24),
                        })
                      }
                    />
                  </label>
                  <div className="free-text-tools">
                    <Tool
                      name="加粗"
                      pressed={textWeight === 700 || textWeight === "bold"}
                      onClick={() =>
                        patch({
                          fontWeight:
                            textWeight === 700 || textWeight === "bold"
                              ? 400
                              : 700,
                        })
                      }
                    >
                      <Bold size={16} />
                    </Tool>
                    <Tool
                      name="斜体"
                      pressed={textItalic}
                      onClick={() =>
                        patch({ fontStyle: textItalic ? "normal" : "italic" })
                      }
                    >
                      <Italic size={16} />
                    </Tool>
                    <Tool
                      name="下划线"
                      pressed={textUnderline}
                      onClick={() => patch({ underline: !textUnderline })}
                    >
                      <Underline size={16} />
                    </Tool>
                    <Tool
                      name="删除线"
                      pressed={textStrike}
                      onClick={() => patch({ linethrough: !textStrike })}
                    >
                      <Strikethrough size={16} />
                    </Tool>
                  </div>
                  <label className="free-full-label">
                    字体
                    <select
                      aria-label="自由文字字体"
                      value={selectedTextStyle.fontFamily ?? text.fontFamily}
                      onChange={(e) => patch({ fontFamily: e.target.value })}
                    >
                      <option>Noto Sans SC</option>
                      <option>Noto Serif SC</option>
                      <option>Nunito</option>
                      <option>Times New Roman</option>
                      <option>Microsoft YaHei</option>
                    </select>
                  </label>
                  <div className="free-property-grid">
                    <label>
                      字号
                      <NumericInput
                        label="自由文字字号"
                        value={selectedTextStyle.fontSize ?? text.fontSize}
                        min={1}
                        max={300}
                        step={0.5}
                        onChange={(n) => patch({ fontSize: n })}
                      />
                    </label>
                    <label>
                      行距
                      <NumericInput
                        label="自由文字行距"
                        value={text.lineHeight}
                        min={0.5}
                        max={4}
                        step={0.05}
                        onChange={(n) => patch({ lineHeight: n })}
                      />
                    </label>
                    <label>
                      字距
                      <NumericInput
                        label="自由文字字距"
                        value={text.charSpacing}
                        min={-100}
                        max={1000}
                        step={10}
                        onChange={(n) => patch({ charSpacing: n })}
                      />
                    </label>
                  </div>
                  <div className="free-text-tools">
                    <Tool
                      name="文字左对齐"
                      pressed={text.textAlign === "left"}
                      onClick={() => patch({ textAlign: "left" })}
                    >
                      <AlignLeft size={16} />
                    </Tool>
                    <Tool
                      name="文字居中"
                      pressed={text.textAlign === "center"}
                      onClick={() => patch({ textAlign: "center" })}
                    >
                      <AlignCenter size={16} />
                    </Tool>
                    <Tool
                      name="文字右对齐"
                      pressed={text.textAlign === "right"}
                      onClick={() => patch({ textAlign: "right" })}
                    >
                      <AlignRight size={16} />
                    </Tool>
                  </div>
                </section>
              )}
              <section>
                <h3>外观</h3>
                <div className="free-property-grid">
                  <label>
                    填充
                    <input
                      type="color"
                      aria-label="元素填充颜色"
                      value={
                        typeof one?.fill === "string" &&
                        /^#[a-f\d]{6}$/i.test(one.fill)
                          ? one.fill
                          : "#171717"
                      }
                      onChange={(e) => patch({ fill: e.target.value })}
                    />
                  </label>
                  <label>
                    描边
                    <input
                      type="color"
                      aria-label="元素描边颜色"
                      value={
                        typeof one?.stroke === "string" &&
                        /^#[a-f\d]{6}$/i.test(one.stroke)
                          ? one.stroke
                          : "#0756a5"
                      }
                      onChange={(e) => patch({ stroke: e.target.value })}
                    />
                  </label>
                  <label>
                    描边宽度
                    <NumericInput
                      label="描边宽度"
                      value={one?.strokeWidth || 0}
                      min={0}
                      max={40}
                      step={0.5}
                      onChange={(n) => patch({ strokeWidth: n })}
                    />
                  </label>
                  <label>
                    不透明度 %
                    <NumericInput
                      label="元素不透明度"
                      value={Math.round((one?.opacity ?? 1) * 100)}
                      min={0}
                      max={100}
                      onChange={(n) => patch({ opacity: n / 100 })}
                    />
                  </label>
                  {one instanceof Rect && (
                    <label>
                      圆角
                      <NumericInput
                        label="矩形圆角"
                        value={one.rx}
                        min={0}
                        max={200}
                        onChange={(n) => patch({ rx: n, ry: n })}
                      />
                    </label>
                  )}
                </div>
                <div className="free-text-tools">
                  <button onClick={() => patch({ fill: "transparent" })}>
                    无填充
                  </button>
                  <button onClick={() => patch({ strokeWidth: 0 })}>
                    无描边
                  </button>
                  <button
                    onClick={() =>
                      patch({
                        strokeDashArray: one?.strokeDashArray ? null : [6, 4],
                      })
                    }
                  >
                    切换虚线
                  </button>
                </div>
              </section>
              {one instanceof FabricImage && (
                <section>
                  <h3>图片处理</h3>
                  <div className="free-text-tools">
                    <button
                      onClick={() =>
                        withScene(() => {
                          const size = one.getOriginalSize(),
                            side = Math.min(size.width, size.height),
                            display = Math.min(
                              one.getScaledWidth(),
                              one.getScaledHeight(),
                            );
                          one.set({
                            cropX: (size.width - side) / 2,
                            cropY: (size.height - side) / 2,
                            width: side,
                            height: side,
                            scaleX: display / side,
                            scaleY: display / side,
                          });
                        })
                      }
                    >
                      居中裁为正方形
                    </button>
                    <button
                      onClick={() =>
                        withScene(() => {
                          const size = one.getOriginalSize(),
                            display = one.getScaledWidth();
                          one.set({
                            cropX: 0,
                            cropY: 0,
                            width: size.width,
                            height: size.height,
                            scaleX: display / size.width,
                            scaleY: display / size.width,
                          });
                        })
                      }
                    >
                      还原裁剪
                    </button>
                    <button
                      onClick={() =>
                        withScene(() => {
                          one.filters = one.filters.length
                            ? []
                            : [new filters.Grayscale()];
                          one.applyFilters();
                        })
                      }
                    >
                      切换黑白
                    </button>
                  </div>
                </section>
              )}
              <section>
                <h3>对齐与分布</h3>
                <div className="free-align">
                  {(
                    [
                      "left",
                      "center",
                      "right",
                      "top",
                      "middle",
                      "bottom",
                    ] as const
                  ).map((axis, i) => (
                    <button key={axis} onClick={() => align(axis)}>
                      {
                        [
                          "左对齐",
                          "水平居中",
                          "右对齐",
                          "顶端对齐",
                          "垂直居中",
                          "底端对齐",
                        ][i]
                      }
                    </button>
                  ))}
                  <button
                    disabled={selection.length < 3}
                    onClick={() => distribute(true)}
                  >
                    水平等距
                  </button>
                  <button
                    disabled={selection.length < 3}
                    onClick={() => distribute(false)}
                  >
                    垂直等距
                  </button>
                </div>
              </section>
              <section>
                <h3>链接与方向</h3>
                {one && (
                  <label className="free-full-label">
                    点击导出 SVG 中的元素可打开链接
                    <input
                      aria-label="元素链接"
                      type="url"
                      placeholder="https://… 或 mailto:…"
                      defaultValue={one.link || ""}
                      key={one.id}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (
                          !value ||
                          /^(https?:\/\/|mailto:)[^\s<>"']+$/i.test(value)
                        )
                          patch({ link: value });
                        else
                          setError(
                            "链接需以 https://、http:// 或 mailto: 开头。",
                          );
                      }}
                    />
                  </label>
                )}
                <div className="free-text-tools">
                  <button onClick={() => patch({ flipX: !one?.flipX })}>
                    水平翻转
                  </button>
                  <button onClick={() => patch({ flipY: !one?.flipY })}>
                    垂直翻转
                  </button>
                </div>
              </section>
              <section>
                <h3>层级与保护</h3>
                {flowBase && (
                  <label className="free-full-label">
                    与正文的关系
                    <select
                      aria-label="图层位置"
                      value={one?.plane || "foreground"}
                      onChange={(e) => patch({ plane: e.target.value })}
                    >
                      <option value="foreground">
                        在正文前面（图标、图片）
                      </option>
                      <option value="background">
                        在正文后面（底色、方框）
                      </option>
                    </select>
                  </label>
                )}
                <div className="free-text-tools">
                  <Tool name="置于顶层" onClick={() => order("front")}>
                    <ChevronsUp size={16} />
                  </Tool>
                  <Tool name="上移一层" onClick={() => order("up")}>
                    <ArrowUp size={16} />
                  </Tool>
                  <Tool name="下移一层" onClick={() => order("down")}>
                    <ArrowDown size={16} />
                  </Tool>
                  <Tool name="置于底层" onClick={() => order("back")}>
                    <ChevronsDown size={16} />
                  </Tool>
                  <Tool
                    name="切换元素锁定"
                    pressed={!!one?.lockMovementX}
                    onClick={() => {
                      const lock = !one?.lockMovementX;
                      patch({
                        lockMovementX: lock,
                        lockMovementY: lock,
                        lockScalingX: lock,
                        lockScalingY: lock,
                        lockRotation: lock,
                        hasControls: !lock,
                      });
                    }}
                  >
                    <Lock size={16} />
                  </Tool>
                </div>
                <p>锁定元素仍可从“画布元素”中选中并解锁。</p>
                {model.current.pages.length > 1 && (
                  <label className="free-full-label">
                    移动到其他页
                    <select
                      aria-label="移动选中元素到页"
                      value=""
                      onChange={(e) => moveToPage(Number(e.target.value))}
                    >
                      <option value="" disabled>
                        选择目标页
                      </option>
                      {model.current.pages.map(
                        (p, i) =>
                          i !== pageIndex && (
                            <option key={p.id} value={i}>
                              第 {i + 1} 页
                            </option>
                          ),
                      )}
                    </select>
                  </label>
                )}
              </section>
            </>
          ) : (
            <>
              <section>
                <h3>当前纸张</h3>
                <label className="free-full-label">
                  纸张
                  <select
                    aria-label="自由画布纸张"
                    value={
                      page.width === 794 && page.height === 1123
                        ? "a4"
                        : page.width === 1123 && page.height === 794
                          ? "landscape"
                          : "custom"
                    }
                    onChange={(e) => {
                      if (e.target.value === "custom") return;
                      withScene((c) => {
                        const p = model.current.pages[pageIndex];
                        p.width = e.target.value === "a4" ? 794 : 1123;
                        p.height = e.target.value === "a4" ? 1123 : 794;
                        if (flowBase)
                          model.current.pages.forEach((other) => {
                            other.width = p.width;
                            other.height = p.height;
                          });
                        c.setDimensions({
                          width: p.width * zoomRef.current,
                          height: p.height * zoomRef.current,
                        });
                      });
                    }}
                  >
                    <option value="a4">A4 竖版</option>
                    <option value="landscape">A4 横版</option>
                    <option value="custom">自定义尺寸</option>
                  </select>
                </label>
                <div className="free-property-grid">
                  {(["width", "height"] as const).map((key, i) => (
                    <label key={key}>
                      {["宽度 px", "高度 px"][i]}
                      <NumericInput
                        label={["自由纸张宽度", "自由纸张高度"][i]}
                        value={page[key]}
                        min={100}
                        max={5000}
                        onChange={(n) =>
                          withScene((c) => {
                            model.current.pages[pageIndex][key] = n;
                            if (flowBase)
                              model.current.pages.forEach((other) => {
                                other[key] = n;
                              });
                            c.setDimensions({
                              width:
                                model.current.pages[pageIndex].width *
                                zoomRef.current,
                              height:
                                model.current.pages[pageIndex].height *
                                zoomRef.current,
                            });
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </section>
            </>
          )}
          <section>
            <h3>页面操作</h3>
            {model.current.pages.length > 1 && (
              <label className="free-page-selector">
                <span>当前页</span>
                <select
                  aria-label="当前自由页"
                  value={pageIndex}
                  disabled={busy}
                  onChange={(e) => {
                    snapshot();
                    void loadPage(Number(e.target.value));
                  }}
                >
                  {model.current.pages.map((p, i) => (
                    <option key={p.id} value={i}>
                      第 {i + 1} 页
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="free-actions-list">
              <button
                aria-label="新增自由页"
                disabled={busy || model.current.pages.length >= 20}
                onClick={() => {
                  void newPage();
                }}
              >
                <Plus size={16} />
                <span>新增页面</span>
              </button>
              <button
                disabled={busy || model.current.pages.length >= 20}
                onClick={() => {
                  void newPage(true);
                }}
              >
                <Copy size={16} />
                <span>复制本页</span>
              </button>
              <button
                className="danger"
                disabled={busy || (!flowBase && model.current.pages.length < 2)}
                onClick={() => setConfirm("delete-page")}
              >
                <Trash2 size={16} />
                <span>
                  {flowBase && pageIndex < sourcePageCount
                    ? "清空本页装饰"
                    : "删除本页"}
                </span>
              </button>
            </div>
          </section>
          <section>
            <h3>导出与备份</h3>
            <div className="free-actions-list free-export-list">
              <button
                aria-label="导出 PDF"
                aria-describedby="free-export-hint-0"
                disabled={busy}
                onClick={() => {
                  void print();
                }}
              >
                <Download size={14} />
                <span>
                  <strong>导出 PDF</strong>
                  <small id="free-export-hint-0">
                    完整简历，适合投递与打印
                  </small>
                </span>
              </button>
              <button
                aria-label="本页 SVG"
                aria-describedby="free-export-hint-1"
                disabled={busy}
                onClick={() => {
                  void exportImage("svg");
                }}
              >
                <Code2 size={16} />
                <span>
                  <strong>本页 SVG</strong>
                  <small id="free-export-hint-1">矢量格式，便于后续设计</small>
                </span>
              </button>
              <button
                aria-label="本页 PNG"
                aria-describedby="free-export-hint-2"
                disabled={busy}
                onClick={() => {
                  void exportImage("png");
                }}
              >
                <ImagePlus size={16} />
                <span>
                  <strong>本页 PNG</strong>
                  <small id="free-export-hint-2">保存为图片，便于分享</small>
                </span>
              </button>
              <button
                aria-label="可编辑备份"
                aria-describedby="free-export-hint-3"
                onClick={() => {
                  commit();
                  download(
                    doc.name + ".json",
                    JSON.stringify({ ...doc, freeform: snapshot() }, null, 2),
                    "application/json",
                  );
                }}
              >
                <Download size={16} />
                <span>
                  <strong>可编辑备份</strong>
                  <small id="free-export-hint-3">
                    保存全部内容与排版，可重新导入
                  </small>
                </span>
              </button>
              <button
                aria-label="导出文字"
                aria-describedby="free-export-hint-4"
                onClick={() => {
                  commit();
                  download(
                    doc.name + "-自由稿文字.txt",
                    (flowBase
                      ? doc.lines.map((l) => l.text).join("\n") + "\n"
                      : "") + freeText(snapshot()),
                    "text/plain",
                  );
                }}
              >
                <Type size={16} />
                <span>
                  <strong>导出文字</strong>
                  <small id="free-export-hint-4">
                    提取正文，便于复制与整理
                  </small>
                </span>
              </button>
            </div>
          </section>
        </div>
      </aside>
      <nav className="free-mobile-nav" aria-label="自由模式面板">
        <button
          aria-pressed={mobilePanel === "insert"}
          onClick={() => setMobilePanel("insert")}
        >
          添加 / 元素
        </button>
        <button
          aria-pressed={mobilePanel === "canvas"}
          onClick={() => setMobilePanel("canvas")}
        >
          画布
        </button>
        <button
          aria-pressed={mobilePanel === "properties"}
          onClick={() => setMobilePanel("properties")}
        >
          属性
        </button>
      </nav>
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImage(file);
          e.target.value = "";
        }}
      />
      {confirm && (
        <div className="free-confirm-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="free-confirm-title"
          >
            <h2 id="free-confirm-title">
              {flowBase && pageIndex < sourcePageCount
                ? "清空本页装饰？"
                : "删除当前自由页？"}
            </h2>
            <p>
              {flowBase && pageIndex < sourcePageCount
                ? "只清空本页新增的图形、图标和图片，原简历正文保留；可以撤销。"
                : "本页的元素会一起删除，操作后可以撤销。其他页面保持不变。"}
            </p>
            <div>
              <button autoFocus onClick={() => setConfirm(null)}>
                取消
              </button>
              <button
                className="primary"
                onClick={async () => {
                  const action = confirm;
                  setConfirm(null);
                  snapshot();
                  if (action === "delete-page") {
                    if (flowBase && pageIndex < sourcePageCount)
                      model.current.pages[pageIndex].canvas.objects = [];
                    else model.current.pages.splice(pageIndex, 1);
                    await loadPage(
                      Math.min(pageIndex, model.current.pages.length - 1),
                    );
                    commit();
                  }
                }}
              >
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="free-print" ref={flowRoot} aria-hidden="true">
        <style>
          {printPages
            .map(
              ({ page: p }, i) =>
                `@page freepage${i}{size:${(p.width * 25.4) / 96}mm ${(p.height * 25.4) / 96}mm;margin:0}`,
            )
            .join("")}
        </style>
        {printPages.map(({ svg, page: p, layers, sourceIndex }, i) => (
          <article
            key={p.id}
            style={
              {
                page: `freepage${i}`,
                width: (p.width * 25.4) / 96 + "mm",
                height: (p.height * 25.4) / 96 + "mm",
              } as CSSProperties
            }
          >
            {flowBase ? (
              renderPaper?.(sourceIndex ?? i, 1, { layers })
            ) : (
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
