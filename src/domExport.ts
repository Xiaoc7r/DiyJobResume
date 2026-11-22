import { toCanvas, toPng, toSvg } from "html-to-image";

import { fontCss } from "./fontEmbed";

export async function exportPaper(element: HTMLElement, format: "png" | "svg") {
  await document.fonts.ready;
  const css = await fontCss(element);
  const options = {
    pixelRatio: 2,
    fontEmbedCSS: css,
    style: { transform: "none", position: "relative", left: "0", top: "0" },
    filter: (node: HTMLElement) =>
      !node.classList?.contains("moveable-control-box") &&
      !node.classList?.contains("picture-delete") &&
      !node.classList?.contains("picture-resize") &&
      !node.classList?.contains("picture-page"),
  };
  return format === "png" ? toPng(element, options) : toSvg(element, options);
}

export async function captureColorSurface(element: HTMLElement) {
  await document.fonts.ready;
  return toCanvas(element, {
    pixelRatio: 1,
    backgroundColor: "#fff",
    fontEmbedCSS: await fontCss(element),
    style: { transform: "none", position: "relative", left: "0", top: "0" },
    filter: (node: HTMLElement) =>
      !node.classList?.contains("moveable-control-box") &&
      !node.classList?.contains("picture-delete") &&
      !node.classList?.contains("picture-resize") &&
      !node.classList?.contains("picture-page"),
  });
}
