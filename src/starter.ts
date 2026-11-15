import layout from "./sample-layout.json";
import type { Resume, Template } from "./flow";
import { sourceFingerprint } from "./freeform";

export const STARTER_PAGE = {
  width: layout.freeform.pages[0].width,
  height: layout.freeform.pages[0].height,
};

// The curated example contains only the current, user-approved layout, never draft history.
export function createStarter(
  template: Exclude<Template, "blank">,
  accent: string,
): Resume {
  const doc = structuredClone(layout) as unknown as Resume;
  const ids = new Map(doc.lines.map((line) => [line.id, crypto.randomUUID()]));
  doc.lines.forEach((line) => {
    line.id = ids.get(line.id)!;
  });
  doc.template = template;
  doc.settings.accent = accent;
  doc.pictures.forEach((picture) => {
    picture.id = crypto.randomUUID();
    if (picture.anchor) picture.anchor = ids.get(picture.anchor);
  });
  if (doc.freeform) {
    doc.freeform.sourceDesign = Object.fromEntries(
      Object.entries(doc.freeform.sourceDesign || {}).map(([id, style]) => [
        ids.get(id)!,
        style,
      ]),
    );
    const renew = (objects: Record<string, unknown>[]) =>
      objects.forEach((object) => {
        object.id = crypto.randomUUID();
        if (Array.isArray(object.objects)) renew(object.objects);
      });
    doc.freeform.pages.forEach((page) => {
      page.id = crypto.randomUUID();
      renew(page.canvas.objects);
    });
    doc.freeform.source = sourceFingerprint(doc);
  }
  return doc;
}
