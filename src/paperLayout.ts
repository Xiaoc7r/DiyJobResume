import type { Line, Settings, Template } from "./flow";
import type { SourceDesign } from "./freeform";
import { applySourceContentStyle } from "./freeform";
import { rowStyle, lineHtml } from "./render";

export function measureRow(
  node: HTMLDivElement,
  settings: Settings,
  template: Template,
  contact: boolean,
  line: Line,
  text: string,
  continued: boolean,
  design?: SourceDesign,
) {
  node.style.cssText = "";
  node.className = `flow-row row-${line.kind} ${contact ? "row-contact" : ""} ${continued ? "continued" : ""}`;
  node.dataset.order = String(line.order || 1);
  const style = rowStyle(line, settings, continued);
  Object.assign(node.style, {
    fontSize: style.fontSize + "px",
    paddingTop: style.paddingTop + "px",
    paddingBottom: style.paddingBottom + "px",
    lineHeight: String(style.lineHeight),
  });
  applySourceContentStyle(node, design);
  if (design?.width) node.style.width = design.width + "px";
  node.innerHTML = lineHtml(line, text, template);
  node
    .querySelectorAll<HTMLElement>("code")
    .forEach((code, i) => applySourceContentStyle(code, design?.tags?.[i]));
  return Math.ceil(node.getBoundingClientRect().height * 100) / 100;
}
