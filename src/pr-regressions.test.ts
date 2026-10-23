import { afterEach, expect, it, vi } from "vitest";
import { DOCS_KEY, RECOVERY_KEY, saveLibrary, loadLibrary } from "./docs";
import { initialResume, parseMarkdown } from "./flow";
import { applyAgentActions } from "./agent";
afterEach(() => vi.unstubAllGlobals());
function store(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  vi.stubGlobal("localStorage", storage);
  return { data, storage };
}
it("propagates quota failures to save status", () => {
  const { storage } = store();
  storage.setItem = () => {
    throw new Error("quota");
  };
  expect(() => saveLibrary({ activeId: "a", items: [] })).toThrow("quota");
});
it("keeps damaged bytes on load and backs them up before overwrite", () => {
  const { data } = store({ [DOCS_KEY]: "{broken" });
  const { library } = loadLibrary();
  expect(data.get(DOCS_KEY)).toBe("{broken");
  saveLibrary(library);
  expect(data.get(RECOVERY_KEY)).toBe("{broken");
  expect(JSON.parse(data.get(DOCS_KEY)!).items).toHaveLength(1);
});
it("refuses overwrite when damaged backup cannot be saved", () => {
  const { data, storage } = store({ [DOCS_KEY]: "{broken" });
  storage.setItem = () => {
    throw new Error("quota");
  };
  expect(() => saveLibrary({ activeId: "a", items: [] })).toThrow();
  expect(data.get(DOCS_KEY)).toBe("{broken");
});
it("rejects invalid row kinds before preview", () => {
  const doc = initialResume();
  const result = applyAgentActions(doc, [
    { type: "insert", after: 0, kind: "not-a-kind", text: "hello" },
  ]);
  expect(result.doc).toBe(doc);
  expect(result.skipped).toHaveLength(1);
});
it("moves first section to last correctly", () => {
  const doc = initialResume();
  doc.lines = parseMarkdown("# Name\n## Education\nSchool\n## Work\nCompany");
  const result = applyAgentActions(doc, [
    { type: "moveSection", section: "Education", to: 2 },
  ]);
  expect(
    result.doc.lines.filter((l) => l.kind === "section").map((l) => l.text),
  ).toEqual(["Work", "Education"]);
});
it("uses original row identities across a batch of destructive actions", () => {
  const doc = initialResume();
  doc.lines = parseMarkdown("# Name\nContact\n## Education\nUniversity");
  const id = doc.lines[3].id;
  const result = applyAgentActions(doc, [
    { type: "remove", line: 2 },
    { type: "setText", line: 4, text: "Updated university" },
  ]);
  expect(result.doc.lines.find((l) => l.id === id)?.text).toBe(
    "Updated university",
  );
  expect(result.doc.lines.find((l) => l.kind === "section")?.text).toBe(
    "Education",
  );
});
