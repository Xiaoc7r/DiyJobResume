import { Control, Textbox, controlsUtils, util } from "fabric";
import type { FabricObject, Point } from "fabric";

/** Resize the displayed box, including its stroke, without a read/write feedback loop. */
export function setElementSize(
  object: FabricObject,
  axis: "width" | "height",
  requested: number,
  proportional: boolean,
) {
  if (!Number.isFinite(requested) || requested <= 0) return;
  if (object instanceof Textbox && axis === "width") {
    const stroke = object.strokeUniform
      ? object.strokeWidth / object.scaleX
      : object.strokeWidth;
    object.set({ width: Math.max(1, requested / object.scaleX - stroke) });
    return;
  }
  const originalX = object.scaleX,
    originalY = object.scaleY;
  const measure = () =>
    axis === "width" ? object.getScaledWidth() : object.getScaledHeight();
  const original = measure();
  object.set({
    scaleX: proportional || axis === "width" ? originalX * 2 : originalX,
    scaleY: proportional || axis === "height" ? originalY * 2 : originalY,
  });
  const slope = measure() - original,
    intercept = original - slope;
  const factor =
    slope > 1e-8 ? Math.max(1e-5, (requested - intercept) / slope) : 1;
  object.set({
    scaleX: proportional || axis === "width" ? originalX * factor : originalX,
    scaleY: proportional || axis === "height" ? originalY * factor : originalY,
  });
}

const configured = new WeakSet<FabricObject>();
export function configureCanvasControls(object: FabricObject) {
  if (configured.has(object)) return;
  configured.add(object);
  const controls = { ...object.controls };
  for (const key of ["tl", "tr", "bl", "br"] as const) {
    controls[key] = new Control({
      ...controls[key],
      actionName: "drag",
      actionHandler: controlsUtils.dragHandler,
      cursorStyleHandler: () => "move",
    });
  }
  const sides = {
    ml: ["tl", "bl"],
    mr: ["tr", "br"],
    mt: ["tl", "tr"],
    mb: ["bl", "br"],
  } as const;
  for (const [key, ends] of Object.entries(sides)) {
    const original = controls[key];
    const offsets = new WeakMap<object, Point>();
    controls[key] = new Control({
      ...original,
      mouseDownHandler(event, transform, x, y) {
        const target = transform.target;
        const corner = target.oCoords[key];
        if (corner && target.canvas) {
          const point = util.transformPoint(
            corner,
            util.invertTransform(target.canvas.viewportTransform),
          );
          offsets.set(transform, point.subtract({ x, y } as Point));
        }
        return original.mouseDownHandler?.(event, transform, x, y) || false;
      },
      actionHandler(event, transform, x, y) {
        const offset = offsets.get(transform);
        return (
          original.actionHandler?.(
            event,
            transform,
            x + (offset?.x || 0),
            y + (offset?.y || 0),
          ) || false
        );
      },
      shouldActivate(controlKey, target, pointer: Point) {
        if (
          target.canvas?.getActiveObject() !== target ||
          !target.isControlVisible(controlKey)
        )
          return false;
        const a = target.oCoords[ends[0]],
          b = target.oCoords[ends[1]];
        if (!a || !b) return false;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.hypot(dx, dy);
        if (!length) return false;
        const t =
            ((pointer.x - a.x) * dx + (pointer.y - a.y) * dy) /
            (length * length),
          inset = Math.min(0.2, 10 / length);
        return (
          t >= inset &&
          t <= 1 - inset &&
          Math.hypot(pointer.x - a.x - t * dx, pointer.y - a.y - t * dy) <= 7
        );
      },
    });
  }
  controls.center = new Control({
    x: 0,
    y: 0,
    sizeX: 12,
    sizeY: 12,
    actionName: "drag",
    actionHandler: controlsUtils.dragHandler,
    cursorStyle: "move",
    render(ctx, x, y) {
      ctx.save();
      ctx.strokeStyle = "#b87559aa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
      ctx.stroke();
      ctx.restore();
    },
  });
  object.controls = controls;
  if (object.canvas) object.setCoords();
}
