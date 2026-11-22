import { FabricObject, StaticCanvas, Group } from "fabric";
import { boundedAsyncCache } from "./boundedCache";
import type { FreePage } from "./freeform";
import { prepareImageSvg } from "./canvasSvg";

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

// A failed image decode must not leave the other successful clones allocated.
export async function cloneSceneObjects<T extends FabricObject>(
  objects: T[],
): Promise<T[]> {
  const results = await Promise.allSettled(
    objects.map((object) => object.clone()),
  );
  const copies = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value as T] : [],
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    copies.forEach((object) => object.dispose());
    throw failure.reason;
  }
  return copies;
}

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
      // SVG encoding never reads backing pixels; avoid a redundant DPR² bitmap.
      enableRetinaScaling: false,
    });
    try {
      await canvas.loadFromJSON({ objects });
      canvas.backgroundColor = plane ? "" : page.background;
      const links = (items: FabricObject[]) =>
        items.forEach((object) => {
          prepareImageSvg(object);
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
