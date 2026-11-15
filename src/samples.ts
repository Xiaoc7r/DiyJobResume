import type { Template } from "./flow";
import source from "./sample.md?raw";
export const skillLines = source
  .split("## 专业技能")[1]
  .split("\n")
  .filter((line) => line.startsWith("- "))
  .map((line) => line.slice(2).trimEnd().replaceAll("**", ""));
export function demoFor(_template: Template) {
  return _template === "blank" ? "" : source.trim();
}
