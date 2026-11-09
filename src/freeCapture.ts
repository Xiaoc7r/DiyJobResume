import type {Resume} from "./flow";
import {blankFreePage, sourceFingerprint} from "./freeform";
import type {FreeDocument} from "./freeform";

// Source content is never flattened or re-typeset: every mode renders the same paper.
export async function captureFreeform(root: HTMLElement, doc: Resume): Promise<FreeDocument> {
  const count = root.querySelectorAll(".resume-paper").length;
  if (!count) throw new Error("简历还在排版，请稍后再进入自由模式。");
  if (count > 20) throw new Error("自由模式最多支持 20 页，请先拆成多份简历。");
  return {version: 1, source: sourceFingerprint(doc), base: "flow", sourceDesign: {}, pages: Array.from({length: count}, () => blankFreePage())};
}
