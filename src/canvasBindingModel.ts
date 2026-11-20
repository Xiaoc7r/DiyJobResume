import type { Picture, Resume } from "./flow";
import type { FreePage } from "./freeform";
export const templateKey = (doc: Resume) =>
  doc.templateStyle?.id || doc.template;
export const pictureBackground = (picture: Picture, doc: Resume) =>
  picture.background ??
  (picture.label.includes("校徽") && doc.template === "purplebar"
    ? "#ffffff"
    : "transparent");
export function pageWithTemplateArt(
  doc: Resume,
  page: FreePage | undefined,
  index: number,
): FreePage | undefined {
  if (!page) return undefined;
  const art = doc.freeform?.templateArt?.[templateKey(doc)]?.[index];
  return art
    ? {
        ...page,
        canvas: { ...page.canvas, objects: [...page.canvas.objects, ...art] },
      }
    : page;
}
