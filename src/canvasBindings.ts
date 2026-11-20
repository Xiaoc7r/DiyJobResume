import {
  Circle,
  FabricImage,
  FabricObject,
  Group,
  Polygon,
  Rect,
  loadSVGFromString,
  util,
} from "fabric";
import type { Canvas } from "fabric";
import type { Picture, Resume } from "./flow";
import type { FreeDocument } from "./freeform";
import { templateKey, pictureBackground } from "./canvasBindingModel";
export { templateKey, pictureBackground } from "./canvasBindingModel";
const clear = (color: string) =>
  !color || color === "transparent" || color === "rgba(0, 0, 0, 0)";
const colors = new Map<string, string>();
function paintColor(color: string) {
  if (colors.has(color)) return colors.get(color)!;
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const value =
    a === 255
      ? "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
      : `rgba(${r},${g},${b},${a / 255})`;
  if (colors.size >= 128) colors.delete(colors.keys().next().value!);
  colors.set(color, value);
  return value;
}
type Binding =
  | {
      kind: "picture";
      original: Picture;
      x: number;
      y: number;
      background: string;
      appearance: string;
    }
  | { kind: "template"; original: string };
const json = (object: FabricObject) =>
  object.toObject() as Record<string, unknown>;
const near = (n: number, original: number) =>
  Math.abs(n - original) < 1e-7 ? original : n;
const imageAppearance = (object: FabricObject) => {
  const raw = json(object);
  return JSON.stringify(
    [
      "opacity",
      "flipX",
      "flipY",
      "cropX",
      "cropY",
      "filters",
      "stroke",
      "strokeWidth",
      "strokeDashArray",
      "shadow",
      "link",
      "plane",
      "skewX",
      "skewY",
    ].map((key) => raw[key]),
  );
};

/** Bridges source media and template paint to the same live canvas tools, without duplicating image data in backups. */
export class CanvasBindings {
  private bindings = new WeakMap<FabricObject, Binding>();
  private pictureIds = new Set<string>();
  private templateOriginal = "[]";
  private generation = 0;
  get(object: FabricObject) {
    return this.bindings.get(object);
  }
  cancel() {
    this.generation++;
  }
  async install(
    canvas: Canvas,
    doc: Resume,
    data: FreeDocument,
    index: number,
    root: HTMLElement | null,
    base: Record<string, unknown>,
    pictures = true,
  ) {
    const generation = ++this.generation;
    const created: { object: FabricObject; binding: Binding }[] = [];
    if (pictures) {
      const ids = new Set<string>();
      await Promise.all(
        doc.pictures.map(async (p) => {
          const element = [
            ...(root?.querySelectorAll<HTMLElement>("[data-picture-id]") || []),
          ].find((el) => el.dataset.pictureId === p.id);
          if ((!element && p.page !== index) || (p.anchor && !element)) return;
          const x = p.anchor && element ? parseFloat(element.style.left) : p.x,
            y = p.anchor && element ? parseFloat(element.style.top) : p.y;
          const image = await FabricImage.fromURL(p.src);
          const bg = pictureBackground(p, doc);
          image.set({
            ...base,
            id: "picture_" + p.id,
            label: p.label,
            plane: "foreground",
            left: x,
            top: y,
            originX: "left",
            originY: "top",
            strokeWidth: 0,
            scaleX: p.w / image.width,
            scaleY: p.h / image.height,
            angle: p.angle || 0,
            visible: !p.hidden,
            lockMovementX: !!p.locked,
            lockMovementY: !!p.locked,
            lockScalingX: !!p.locked,
            lockScalingY: !!p.locked,
            lockRotation: !!p.locked,
            hasControls: !p.locked,
            backgroundColor: clear(bg) ? "" : bg,
          });
          setPictureClip(image, p.label, bg);
          ids.add(p.id);
          created.push({
            object: image,
            binding: {
              kind: "picture",
              original: p,
              x,
              y,
              background: bg,
              appearance: imageAppearance(image),
            },
          });
        }),
      );
      if (generation === this.generation) this.pictureIds = ids;
    }
    const override = data.templateArt?.[templateKey(doc)]?.[index];
    const paint =
      override != null
        ? await util.enlivenObjects<FabricObject>(override)
        : await capturePaint(doc, index, root);
    paint.forEach((object) => {
      object.set({ ...base, plane: "background" });
      created.push({
        object,
        binding: { kind: "template", original: JSON.stringify(json(object)) },
      });
    });
    if (generation !== this.generation || canvas.disposed) {
      created.forEach((item) => item.object.dispose());
      return;
    }
    const selected = canvas.getActiveObject(),
      selectedId = selected?.get("id");
    const removed = canvas
      .getObjects()
      .filter(
        (o) =>
          this.bindings.get(o)?.kind === "template" ||
          (pictures && this.bindings.get(o)?.kind === "picture"),
      );
    removed.forEach((o) => {
      canvas.remove(o);
      o.dispose();
    });
    for (const item of created) {
      this.bindings.set(item.object, item.binding);
      canvas.add(item.object);
      item.object.setCoords();
    }
    this.templateOriginal = JSON.stringify(paint.map(json));
    if (selected && removed.includes(selected)) {
      const next = created.find(
        (item) => item.object.get("id") === selectedId,
      )?.object;
      if (next) canvas.setActiveObject(next);
    }
    canvas.requestRenderAll();
  }
  snapshot(canvas: Canvas, doc: Resume, data: FreeDocument, index: number) {
    const objects = canvas.getObjects();
    // Advanced image edits become native objects atomically; retain the image
    // exactly once and keep every Fabric property through mode changes/backup.
    for (const object of objects) {
      const binding = this.bindings.get(object);
      if (
        binding?.kind === "picture" &&
        binding.appearance !== imageAppearance(object)
      )
        this.bindings.delete(object);
    }
    const boundIds = new Set(
      objects.filter((o) => this.bindings.has(o)).map((o) => o.get("id")),
    );
    const serialized = (
      canvas.toObject() as { objects: Record<string, unknown>[] }
    ).objects;
    data.pages[index].canvas = {
      version: "7.4.0",
      objects: serialized.filter((o) => !boundIds.has(o.id)),
    };
    const art = objects
      .filter((o) => this.bindings.get(o)?.kind === "template")
      .map((o) => serialized.find((raw) => raw.id === o.get("id"))!);
    const key = templateKey(doc);
    if (
      data.templateArt?.[key]?.[index] != null ||
      JSON.stringify(art) !== this.templateOriginal
    ) {
      const pages = [...(data.templateArt?.[key] || [])];
      while (pages.length <= index) pages.push(null);
      pages[index] = art;
      data.templateArt = { ...data.templateArt, [key]: pages };
    }
    const nextPictures = doc.pictures.flatMap((p) => {
      if (!this.pictureIds.has(p.id)) return [p];
      const object = objects.find((o) => {
        const b = this.bindings.get(o);
        return b?.kind === "picture" && b.original.id === p.id;
      });
      if (!object) return [];
      const binding = this.bindings.get(object) as Extract<
        Binding,
        { kind: "picture" }
      >;
      const position = object.getXY(),
        bg = object.backgroundColor || "transparent";
      const next: Picture = {
        ...p,
        x: near(binding.original.x + position.x - binding.x, p.x),
        y: near(binding.original.y + position.y - binding.y, p.y),
        w: near(object.getScaledWidth(), p.w),
        h: near(object.getScaledHeight(), p.h),
        angle: object.angle || undefined,
        hidden: !object.visible || undefined,
        locked: object.lockMovementX || undefined,
        ...(bg !== binding.background
          ? { background: bg }
          : binding.original.background !== undefined
            ? { background: binding.original.background }
            : {}),
      };
      if (object.get("resetPictureBackground")) delete next.background;
      return [JSON.stringify(next) === JSON.stringify(p) ? p : next];
    });
    return JSON.stringify(nextPictures) === JSON.stringify(doc.pictures)
      ? doc.pictures
      : nextPictures;
  }
}

export function setPictureClip(
  image: FabricImage,
  label: string,
  background: string,
) {
  image.set({
    clipPath:
      label.includes("校徽") && !clear(background)
        ? new Circle({
            radius: Math.min(image.width, image.height) / 2,
            originX: "center",
            originY: "center",
          })
        : undefined,
  });
}

async function capturePaint(
  doc: Resume,
  page: number,
  paper: HTMLElement | null,
): Promise<FabricObject[]> {
  if (!paper) return [];
  const clone = paper.cloneNode(true) as HTMLElement;
  clone.classList.remove("bound-template-art");
  Object.assign(clone.style, {
    position: "fixed",
    left: "-20000px",
    top: "0",
    transform: "none",
    zoom: "1",
    pointerEvents: "none",
  });
  clone.inert = true;
  document.body.appendChild(clone);
  try {
    return await capturePaintNode(doc, page, clone);
  } finally {
    clone.remove();
  }
}
async function capturePaintNode(
  doc: Resume,
  page: number,
  paper: HTMLElement | null,
): Promise<FabricObject[]> {
  if (!paper) return [];
  const frame = paper.getBoundingClientRect(),
    scale = frame.width / parseFloat(paper.style.width || "794");
  const relative = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return {
      x: (r.x - frame.x) / scale,
      y: (r.y - frame.y) / scale,
      w: r.width / scale,
      h: r.height / scale,
    };
  };
  const result: FabricObject[] = [];
  const key = templateKey(doc);
  const rect = (
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
  ) => {
    if (w <= 0 || h <= 0 || clear(fill)) return;
    result.push(
      new Rect({
        id: `paint_${key}_${page}_${id}`,
        label,
        plane: "background",
        left: x,
        top: y,
        width: w,
        height: h,
        fill: paintColor(fill),
        strokeWidth: 0,
        originX: "left",
        originY: "top",
      }),
    );
  };
  const rows = [
    ...paper.querySelectorAll<HTMLElement>(".paper-row:has(.row-section)"),
  ];
  if (doc.templateStyle) {
    const style = doc.templateStyle,
      originals = style.drawings.pages[0].canvas.objects;
    const zones = [
      {
        role: "header",
        frame:
          style.headerFrame ||
          (!style.regions
            ? {
                x: 0,
                y: 0,
                width: style.drawings.pages[0].width,
                height: style.drawings.pages[0].height,
              }
            : undefined),
        target: (() => {
          if (!style.regions)
            return {
              x: 0,
              y: 0,
              w: frame.width / scale,
              h: frame.height / scale,
            };
          const h = paper
            .querySelector<HTMLElement>(".row-name")
            ?.closest<HTMLElement>(".paper-row");
          if (!h) return undefined;
          const r = relative(h);
          return {
            ...r,
            h: Math.max(
              1,
              rows[0]
                ? relative(rows[0]).y - r.y
                : style.regions?.header || r.h,
            ),
          };
        })(),
      },
      ...rows.map((row) => ({
        role: "section",
        frame: style.sectionFrame,
        target: relative(row),
      })),
    ];
    let count = 0;
    for (const zone of zones) {
      if (!zone.target || !zone.frame) continue;
      const sx = zone.target.w / zone.frame.width,
        sy = zone.target.h / zone.frame.height;
      const raw = originals
        .filter(
          (o) =>
            (o.templateRole === "section" ? "section" : "header") === zone.role,
        )
        .map((o) => ({
          ...o,
          id: `paint_${key}_${page}_${count++}`,
          label: o.label || "模板装饰",
          left: zone.target!.x + (Number(o.left || 0) - zone.frame!.x) * sx,
          top: zone.target!.y + (Number(o.top || 0) - zone.frame!.y) * sy,
          scaleX: Number(o.scaleX || 1) * sx,
          scaleY: Number(o.scaleY || 1) * sy,
          plane: "background",
        }));
      result.push(...(await util.enlivenObjects<FabricObject>(raw)));
    }
    return result;
  }
  if (page === 0) {
    const top = getComputedStyle(paper, "::before");
    if (top.content !== "none" && top.content !== "normal")
      rect(
        "header",
        "页首横幅",
        parseFloat(top.left) || 0,
        parseFloat(top.top) || 0,
        parseFloat(top.width) || parseFloat(paper.style.width),
        parseFloat(top.height) || 0,
        top.backgroundColor,
      );
  }
  for (const [i, outer] of rows.entries()) {
    const row = outer.querySelector<HTMLElement>(".row-section")!,
      ink = row.querySelector<HTMLElement>(".ink")!,
      r = relative(row),
      s = getComputedStyle(row),
      ir = relative(ink),
      is = getComputedStyle(ink);
    const name = ink.dataset.title || ink.textContent || "板块";
    rect(`${i}_fill`, `${name} · 底色`, r.x, r.y, r.w, r.h, s.backgroundColor);
    let bottom = parseFloat(s.borderBottomWidth);
    if (doc.template === "noir") bottom = 2.5;
    rect(
      `${i}_line`,
      `${name} · 分隔线`,
      r.x,
      doc.template === "noir"
        ? r.y + r.h - bottom
        : Math.round(r.y + r.h - bottom),
      r.w,
      bottom,
      doc.template === "noir" ? s.color : s.borderBottomColor,
    );
    const border = parseFloat(s.borderLeftWidth);
    rect(
      `${i}_left`,
      `${name} · 侧线`,
      r.x,
      r.y,
      border,
      r.h,
      s.borderLeftColor,
    );
    if (!clear(is.backgroundColor)) {
      if (doc.template === "ribbon")
        result.push(
          new Polygon(
            [
              { x: 0, y: 0 },
              { x: Math.max(0, ir.w - 8), y: 0 },
              { x: ir.w, y: ir.h },
              { x: 0, y: ir.h },
            ],
            {
              ...{
                id: `paint_${key}_${page}_${i}_tag`,
                label: `${name} · 标签`,
              },
              left: ir.x,
              top: ir.y,
              fill: is.backgroundColor,
              strokeWidth: 0,
              originX: "left",
              originY: "top",
            },
          ),
        );
      else
        rect(
          `${i}_tag`,
          `${name} · 标签`,
          ir.x,
          ir.y,
          ir.w,
          ir.h,
          is.backgroundColor,
        );
    }
    const after = getComputedStyle(row, "::after"),
      width = parseFloat(after.width),
      height = parseFloat(after.height);
    if (
      (doc.template === "academic" || doc.template === "reexam") &&
      Number.isFinite(width) &&
      height > 0 &&
      !clear(after.backgroundColor)
    )
      rect(
        `${i}_after`,
        `${name} · 延伸线`,
        r.x + r.w - width,
        r.y +
          parseFloat(s.paddingTop) +
          parseFloat(s.lineHeight) / 2 -
          height / 2,
        width,
        height,
        after.backgroundColor,
      );
    const before = getComputedStyle(ink, "::before");
    let mask = before.maskImage.match(/^url\((.*)\)$/)?.[1];
    if (mask?.startsWith('"') || mask?.startsWith("'"))
      mask = mask.slice(1, -1);
    if (mask) {
      const svg = decodeURIComponent(
        mask.slice(mask.indexOf(",") + 1),
      ).replaceAll("black", paintColor(before.backgroundColor));
      const loaded = await loadSVGFromString(svg),
        objects = loaded.objects.filter((o): o is FabricObject => !!o);
      if (objects.length) {
        const group = new Group(objects);
        group.set({
          id: `paint_${key}_${page}_${i}_icon`,
          label: `${name} · 图标`,
          left: ir.x + (parseFloat(before.left) || 0),
          top: ir.y + (parseFloat(before.top) || 0),
          scaleX: parseFloat(before.width) / group.width,
          scaleY: parseFloat(before.height) / group.height,
        });
        result.push(group);
      }
    }
  }
  return result;
}
