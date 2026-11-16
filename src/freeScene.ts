import { FabricObject, StaticCanvas, Group } from "fabric";
import { boundedAsyncCache } from "./boundedCache";
import type { FreePage } from "./freeform";

// Shared by the editor, normal preview and export. Custom fields must round-trip together.
FabricObject.customProperties = [
  "id",
  "label",
  "link",
  "plane",
  "templateRole",
  "templateBounds",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
  "hasControls",
  "subTargetCheck",
  "interactive",
];

const cachedSvg = boundedAsyncCache<string>(
  30,
  16_000_000,
  (svg) => svg.length * 2,
);
export function sceneSvg(page: FreePage, plane?: "background" | "foreground") {
  const objects = plane
    ? page.canvas.objects.filter(
        (o) =>
          (o.plane === "background" ? "background" : "foreground") === plane,
      )
    : page.canvas.objects;
  if (plane && !objects.length) return Promise.resolve("");
  const key = JSON.stringify([
    page.width,
    page.height,
    plane ? "" : page.background,
    objects,
  ]);
  return cachedSvg(key, async () => {
    const canvas = new StaticCanvas(undefined, {
      width: page.width,
      height: page.height,
      renderOnAddRemove: false,
    });
    try {
      await canvas.loadFromJSON({ objects });
      canvas.backgroundColor = plane ? "" : page.background;
      const links = (items: FabricObject[]) =>
        items.forEach((object) => {
          const link = (object as FabricObject & { link?: string }).link;
          if (link && /^(https?:|mailto:)/i.test(link)) {
            const original = object.toSVG.bind(object),
              href = link
                .replaceAll("&", "&amp;")
                .replaceAll('"', "&quot;")
                .replaceAll("<", "&lt;");
            object.toSVG = (reviver) =>
              `<a xlink:href="${href}" target="_blank">${original(reviver)}</a>`;
          }
          if (object instanceof Group) links(object.getObjects());
        });
      links(canvas.getObjects());
      return canvas.toSVG({ suppressPreamble: true });
    } finally {
      await canvas.dispose();
    }
  });
}
