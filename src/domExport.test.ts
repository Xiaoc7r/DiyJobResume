// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { exportPaper } from "./domExport";
vi.mock("html-to-image", () => ({
  toSvg: vi.fn(async (_element, options) => options.fontEmbedCSS),
  toPng: vi.fn(),
  toCanvas: vi.fn(),
}));

let serial = 0;
class FontFace {
  style: { fontFamily: string; getPropertyValue: (name: string) => string };
  cssText: string;
  constructor(url: string, family = "ResumeFont", range = "U+0-10FFFF") {
    this.style = {
      fontFamily: family,
      getPropertyValue: (name) => (name === "src" ? `url("${url}")` : range),
    };
    this.cssText = `@font-face { font-family: ${family}; src: url("${url}"); unicode-range: ${range}; }`;
  }
}
function rules(faces: FontFace[]) {
  Object.defineProperty(document, "styleSheets", {
    configurable: true,
    value: [{ cssRules: faces, href: null }],
  });
}
function paper() {
  const root = document.createElement("div");
  root.innerHTML =
    '<span>简历 A</span><svg xmlns="http://www.w3.org/2000/svg"><text>技能 B</text>' +
    '<rect width="10" height="10"/>'.repeat(400) +
    "</svg>";
  document.body.append(root);
  return root;
}
beforeEach(() => {
  serial++;
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.stubGlobal("CSSFontFaceRule", FontFace);
  vi.stubGlobal(
    "getComputedStyle",
    vi.fn(() => ({ fontFamily: "ResumeFont" })),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["font bytes"]),
    })),
  );
});
afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(document, "styleSheets");
  Reflect.deleteProperty(document, "fonts");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("embeds HTML and SVG text fonts without scanning the styles of vector geometry", async () => {
  rules([new FontFace(`/fonts/text-${serial}.woff2`)]);
  const css = await exportPaper(paper(), "svg");
  expect(css).toContain("font-family: ResumeFont");
  expect(css).toContain("data:application/octet-stream;base64,");
  expect(vi.mocked(getComputedStyle).mock.calls.length).toBeLessThanOrEqual(4);
});

it("shares font downloads, caps concurrent reads and evicts older cached fonts", async () => {
  let active = 0,
    peak = 0;
  vi.mocked(fetch).mockImplementation(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((done) => setTimeout(done, 1));
    active--;
    return { ok: true, blob: async () => new Blob(["font"]) } as Response;
  });
  const faces = Array.from(
    { length: 110 },
    (_, i) => new FontFace(`/fonts/budget-${serial}-${i}.woff2`),
  );
  rules(faces.slice(0, 10));
  const root = paper();
  const [a, b] = await Promise.all([
    exportPaper(root, "svg"),
    exportPaper(root, "svg"),
  ]);
  expect(a).toBe(b);
  expect(fetch).toHaveBeenCalledTimes(10);
  rules(faces);
  await exportPaper(root, "svg");
  expect(peak).toBeLessThanOrEqual(6);
  const before = vi.mocked(fetch).mock.calls.length;
  rules([faces[0]]);
  await exportPaper(root, "svg");
  expect(fetch).toHaveBeenCalledTimes(before + 1);
});

it("retries failed font reads and continues ignoring external resources", async () => {
  rules([
    new FontFace(`/fonts/retry-${serial}.woff2`),
    new FontFace("https://untrusted.invalid/font.woff2"),
  ]);
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
  const root = paper();
  await expect(exportPaper(root, "svg")).rejects.toThrow("offline");
  expect(await exportPaper(root, "svg")).toContain("base64,");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.every(([url]) => String(url).startsWith(location.origin)),
  ).toBe(true);
});

it("keeps HTML and SVG text families and embeds only matching Unicode subsets", async () => {
  vi.mocked(getComputedStyle).mockImplementation(
    (element) =>
      ({
        fontFamily: element.localName === "text" ? "SvgFont" : "ResumeFont",
      }) as CSSStyleDeclaration,
  );
  rules([
    new FontFace(`/fonts/latin-${serial}.woff2`, "ResumeFont", "U+0000-00FF"),
    new FontFace(`/fonts/cjk-${serial}.woff2`, "ResumeFont", "U+4E00-9FFF"),
    new FontFace(`/fonts/svg-${serial}.woff2`, "SvgFont"),
    new FontFace(`/fonts/emoji-${serial}.woff2`, "ResumeFont", "U+1F600-1F64F"),
    new FontFace(`/fonts/unused-${serial}.woff2`, "OtherFont"),
  ]);
  const css = await exportPaper(paper(), "svg");
  expect(css).toContain("font-family: SvgFont");
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(([url]) => /emoji|unused/.test(String(url))),
  ).toBe(false);
});

it("releases timed-out slots so a later export can recover", async () => {
  const faces = Array.from(
    { length: 6 },
    (_, i) => new FontFace(`/fonts/timeout-${serial}-${i}.woff2`),
  );
  rules(faces);
  const root = paper();
  vi.mocked(fetch).mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options!.signal!.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  vi.useFakeTimers();
  try {
    const pending = expect(exportPaper(root, "svg")).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(30_000);
    await pending;
  } finally {
    vi.useRealTimers();
  }
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    blob: async () => new Blob(["recovered"]),
  } as Response);
  expect(await exportPaper(root, "svg")).toContain("base64,");
});

it("matches wildcard, boundary and supplementary Unicode without over-embedding", async () => {
  const root = paper();
  root.textContent = "中A😀";
  rules([
    new FontFace(`/fonts/wild-${serial}.woff2`, "ResumeFont", "U+4E??"),
    new FontFace(`/fonts/edge-${serial}.woff2`, "ResumeFont", "U+0040-0041"),
    new FontFace(`/fonts/above-${serial}.woff2`, "ResumeFont", "U+0042-0043"),
    new FontFace(`/fonts/pair-${serial}.woff2`, "ResumeFont", "U+1F600"),
    new FontFace(`/fonts/malformed-${serial}.woff2`, "ResumeFont", "invalid"),
  ]);
  await exportPaper(root, "svg");
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(([url]) => /above|malformed/.test(String(url))),
  ).toBe(false);
});

it("evicts by retained bytes even when few font files are present", async () => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    blob: async () => new Blob(["x".repeat(1_100_000)]),
  } as Response);
  const faces = Array.from(
    { length: 3 },
    (_, i) => new FontFace(`/fonts/large-${serial}-${i}.woff2`),
  );
  rules(faces);
  const root = paper();
  await exportPaper(root, "svg");
  expect(fetch).toHaveBeenCalledTimes(3);
  rules([faces[0]]);
  await exportPaper(root, "svg");
  expect(fetch).toHaveBeenCalledTimes(4);
});
