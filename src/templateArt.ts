import { useEffect, useState, useRef } from "react";
import type { CSSProperties } from "react";
import type { TemplateStyle } from "./templateStyle";

const dataUrl = (svg: string) => {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return "data:image/svg+xml;base64," + btoa(binary);
};
export async function buildTemplateArt(template: TemplateStyle) {
  const { sceneSvg } = await import("./freeScene");
  const page = template.drawings.pages[0],
    frame = template.sectionFrame;
  const render = async (section: boolean) => {
    const objects = page.canvas.objects
      .filter((object) => (object.templateRole === "section") === section)
      .map((object) => ({
        ...object,
        plane: "background",
        left: Number(object.left || 0) - (section ? frame.x : 0),
        top: Number(object.top || 0) - (section ? frame.y : 0),
      }));
    if (!objects.length) return "none";
    const svg = await sceneSvg(
      {
        ...page,
        width: section ? frame.width : page.width,
        height: section ? frame.height : page.height,
        canvas: { objects },
      },
      "background",
    );
    return `url("${dataUrl(svg.replace("<svg ", '<svg preserveAspectRatio="none" '))}")`;
  };

  const vector = async (
    role: "section" | "header",
    frame: typeof template.sectionFrame | undefined,
  ) => {
    if (!frame) return "";
    const objects = page.canvas.objects
      .filter((o) => o.templateRole === role)
      .map((o) => ({ ...o, plane: "background" }));
    if (!objects.length) return "";
    const svg = await sceneSvg({ ...page, canvas: { objects } }, "background");
    return svg.replace(
      /<svg\b[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" preserveAspectRatio="none" style="overflow:visible">`,
    );
  };
  const [sectionSvg, headerSvg] = template.regions
    ? await Promise.all([
        vector("section", frame),
        vector("header", template.headerFrame),
      ])
    : ["", ""];
  const [section, pageArt] = template.regions
    ? [sectionSvg ? `url("${dataUrl(sectionSvg)}")` : "none", "none"]
    : await Promise.all([render(true), render(false)]);
  return {
    section,
    page: pageArt,
    sectionSvg,
    headerSvg,
  };
}
export function useTemplateArt(template?: TemplateStyle) {
  const [art, setArt] = useState({
    section: "none",
    page: "none",
    sectionSvg: "",
    headerSvg: "",
  });
  const previousId = useRef<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    if (!template || previousId.current !== template.id)
      setArt({ section: "none", page: "none", sectionSvg: "", headerSvg: "" });
    previousId.current = template?.id;
    if (template)
      void buildTemplateArt(template)
        .then((value) => {
          if (active) setArt(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [template]);
  return {
    style: {
      "--template-section-art": template?.regions ? "none" : art.section,
    } as CSSProperties,
    page: art.page,
    section: art.section,
    sectionSvg: art.sectionSvg,
    headerSvg: art.headerSvg,
  };
}
