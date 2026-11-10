import type { Resume } from "./flow";
import { blankFreePage, sourceFingerprint } from "./freeform";
import type { FreeDocument } from "./freeform";

// Source content is never flattened or re-typeset: every mode renders the same paper.
export async function captureFreeform(
  root: HTMLElement,
  doc: Resume,
): Promise<FreeDocument> {
  const count = root.querySelectorAll(".resume-paper").length;
  if (!count) throw new Error("简历还在排版，请稍后再进入自由模式。");
  if (count > 20) throw new Error("自由模式最多支持 20 页，请先拆成多份简历。");
  return {
    version: 1,
    source: sourceFingerprint(doc),
    base: "flow",
    sourceDesign: {},
    pages: Array.from({ length: count }, () => blankFreePage()),
  };
}

// Promote the example's entry icons into real editable canvas images at their rendered positions.
// The school crest remains in the header; existing arbitrary photos are left untouched.
export async function promoteAnchoredPictures(
  root: HTMLElement,
  doc: Resume,
  freeform: FreeDocument,
) {
  const candidates = doc.pictures.filter((p) => p.anchor);
  if (!candidates.length)
    return { freeform, pictures: doc.pictures, promoted: false };
  const { FabricImage } = await import("fabric");
  const result = structuredClone(freeform),
    promoted = new Set<string>();
  const images = await Promise.all(
    candidates.map(async (picture) => {
      const element = Array.from(
          root.querySelectorAll<HTMLElement>("[data-picture-id]"),
        ).find((el) => el.dataset.pictureId === picture.id),
        paper = element?.closest<HTMLElement>(".resume-paper");
      if (!element || !paper) return;
      const page = Number(paper.dataset.page || 0);
      if (!result.pages[page]) return;
      const frame = paper.getBoundingClientRect(),
        box = element.getBoundingClientRect(),
        scale = frame.width / result.pages[page].width;
      const image = await FabricImage.fromURL(picture.src);
      image.set({
        left: (box.left - frame.left) / scale,
        top: (box.top - frame.top) / scale,
        originX: "left",
        originY: "top",
        scaleX: picture.w / image.width,
        scaleY: picture.h / image.height,
      });
      const object = {
        ...image.toObject(),
        id: picture.id,
        label: picture.label,
        plane: "foreground",
      };
      promoted.add(picture.id);
      image.dispose();
      return { page, object };
    }),
  );
  for (const image of images.reverse())
    if (image) result.pages[image.page].canvas.objects.push(image.object);
  const pictures = doc.pictures.filter((p) => !promoted.has(p.id));
  result.source = sourceFingerprint({ ...doc, pictures });
  return { freeform: result, pictures, promoted: promoted.size > 0 };
}
