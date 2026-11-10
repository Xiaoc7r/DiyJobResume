export function cursorOffset(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !el.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString().length;
}
export function placeCursor(el: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length || 0;
    if (offset <= len) {
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    offset -= len;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
export function textRangeOf(root: HTMLElement, start: number, end: number) {
  const length = root.textContent?.length || 0;
  start = Math.max(0, Math.min(length, start));
  end = Math.max(start, Math.min(length, end));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode(),
    pos = 0,
    startNode: Node | null = null,
    startOffset = 0,
    endNode: Node | null = null,
    endOffset = 0;
  while (node) {
    const len = node.textContent?.length || 0;
    if (!startNode && start <= pos + len) {
      startNode = node;
      startOffset = start - pos;
    }
    if (startNode && end <= pos + len) {
      endNode = node;
      endOffset = Math.min(len, Math.max(0, end - pos));
      break;
    }
    pos += len;
    node = walker.nextNode();
  }
  if (!startNode || !endNode) return null;
  if (!root.isConnected && !root.childNodes.length) return null;
  const range = document.createRange();
  range.setStart(
    startNode,
    Math.min(startOffset, startNode.textContent?.length || 0),
  );
  range.setEnd(endNode, endOffset);
  return range;
}
