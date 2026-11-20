import { FabricImage, Group } from "fabric";
import type { FabricObject } from "fabric";

const prepared = new WeakSet<FabricObject>();
/** Fabric paints image backgrounds on canvas but omits them from its SVG output. */
export function prepareImageSvg(object: FabricObject) {
  if (object instanceof Group) object.getObjects().forEach(prepareImageSvg);
  if (!(object instanceof FabricImage) || prepared.has(object)) return;
  prepared.add(object);
  const original = object.toSVG.bind(object);
  object.toSVG = (reviver) => {
    const svg = original(reviver);
    if (!object.backgroundColor || object.backgroundColor === "transparent")
      return svg;
    const fill = object.backgroundColor
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
    return svg.replace(
      /<image\b/,
      `<rect x="${-object.width / 2}" y="${-object.height / 2}" width="${object.width}" height="${object.height}" fill="${fill}" stroke="none" /><image`,
    );
  };
}
