import { describe, expect, it } from "vitest";
import {
  PAGE,
  addBlock,
  arrange,
  constrain,
  createBlock,
  historyReducer,
  initialResume,
  parseResume,
} from "./model";
import type { HistoryState } from "./model";

describe("resume editing invariants", () => {
  it("switches all templates without losing user content or identifiers", () => {
    let doc = initialResume();
    doc.blocks[0].title = "测试姓名";
    doc.blocks[3].body = "用户自己写的独特内容\n第二段";
    const content = doc.blocks.map(({ id, title, subtitle, body, meta }) => ({
      id,
      title,
      subtitle,
      body,
      meta,
    }));
    for (const template of ["classic", "creative", "linen"]) {
      doc = arrange(doc, template);
      expect(
        doc.blocks.map(({ id, title, subtitle, body, meta }) => ({
          id,
          title,
          subtitle,
          body,
          meta,
        })),
      ).toEqual(content);
      for (const b of doc.blocks) {
        expect(b.x + b.w).toBeLessThanOrEqual(PAGE.width);
        expect(b.y + b.h).toBeLessThanOrEqual(PAGE.height);
      }
    }
  });
  it("adds a new page rather than dropping an overflowing module", () => {
    const doc = initialResume();
    doc.blocks = [{ ...createBlock("text"), y: 900, h: 175 }];
    const next = addBlock(doc, createBlock("experience"));
    expect(next.pages).toBe(2);
    expect(next.blocks).toHaveLength(2);
    expect(next.blocks[1].page).toBe(1);
  });
  it("undoes a grouped A -> B -> C change all the way to A", () => {
    const doc = initialResume();
    doc.name = "A";
    let state: HistoryState = {
      past: [],
      present: doc,
      future: [],
      timestamp: 0,
    };
    state = historyReducer(state, {
      type: "set",
      doc: { ...doc, name: "B" },
      group: "name",
      now: 1000,
    });
    state = historyReducer(state, {
      type: "set",
      doc: { ...doc, name: "C" },
      group: "name",
      now: 1300,
    });
    expect(state.past).toHaveLength(1);
    state = historyReducer(state, { type: "undo" });
    expect(state.present.name).toBe("A");
    state = historyReducer(state, { type: "redo" });
    expect(state.present.name).toBe("C");
  });
  it("records a drag as one transaction and clears redo after a new edit", () => {
    const doc = initialResume();
    let state: HistoryState = {
      past: [],
      present: doc,
      future: [],
      timestamp: 0,
    };
    state = historyReducer(state, { type: "checkpoint" });
    state = historyReducer(state, {
      type: "set",
      doc: { ...doc, name: "moved" },
      record: false,
    });
    state = historyReducer(state, { type: "undo" });
    expect(state.present).toEqual(doc);
    state = historyReducer(state, {
      type: "set",
      doc: { ...doc, name: "new" },
    });
    expect(state.future).toHaveLength(0);
  });
  it("constrains move and resize to paper boundaries", () => {
    const b = constrain({
      ...createBlock("text"),
      x: -999,
      y: 9999,
      w: 9999,
      h: -1,
    });
    expect(b.x).toBe(0);
    expect(b.w).toBe(PAGE.width);
    expect(b.h).toBe(32);
    expect(b.y + b.h).toBe(PAGE.height);
  });
  it("round-trips document backups with all editable content", () => {
    const doc = initialResume();
    expect(parseResume(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
  it("rejects unsupported imports and strips executable/remote fields", () => {
    expect(() => parseResume({ version: 2, blocks: [] })).toThrow();
    expect(() =>
      parseResume({ version: 1, blocks: [{ kind: "__proto__" }] }),
    ).toThrow();
    const doc = initialResume();
    const unsafe = {
      ...doc,
      accent: "url(https://example.com)",
      blocks: [
        {
          ...createBlock("image"),
          image: "https://example.com/tracker.png",
          fill: "url(javascript:alert(1))",
        },
      ],
    };
    const safe = parseResume(unsafe);
    expect(safe.blocks[0].image).toBeUndefined();
    expect(safe.blocks[0].fill).toBe("transparent");
    expect(safe.accent).toMatch(/^#/);
  });
  it("replaces duplicate IDs so edits never update two imported modules", () => {
    const b = createBlock("text");
    const doc = parseResume({ ...initialResume(), blocks: [b, b] });
    expect(new Set(doc.blocks.map((b) => b.id)).size).toBe(2);
  });
});
