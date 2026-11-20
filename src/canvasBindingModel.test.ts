import { describe, expect, it } from "vitest";
import { initialResume, readResume } from "./flow";
import { blankFreePage, readFreeDocument } from "./freeform";
import { pageWithTemplateArt, pictureBackground } from "./canvasBindingModel";

describe("bound canvas media and template paint", () => {
  it("keeps editable media state through backup without clipping off-page geometry", () => {
    const doc = initialResume();
    doc.pictures[0] = {
      ...doc.pictures[0],
      x: -250,
      y: 1400,
      w: 460,
      h: 500,
      angle: 45,
      hidden: true,
      locked: true,
      background: "#ffffff",
    };
    expect(readResume(JSON.parse(JSON.stringify(doc))).pictures[0]).toEqual(
      doc.pictures[0],
    );
  });
  it("keeps explicit image backgrounds ahead of template defaults", () => {
    const doc = initialResume();
    const crest = doc.pictures[0];
    expect(pictureBackground(crest, doc)).toBe("transparent");
    doc.template = "purplebar";
    expect(pictureBackground(crest, doc)).toBe("#ffffff");
    expect(
      pictureBackground({ ...crest, background: "transparent" }, doc),
    ).toBe("transparent");
  });
  it("restores per-template artwork and composes it without changing native objects", () => {
    const doc = initialResume();
    const page = blankFreePage();
    doc.freeform = readFreeDocument({
      version: 1,
      source: "",
      pages: [page],
      templateArt: {
        blue: [[{ type: "Rect", width: 20, height: 2, fill: "#000000" }], null],
        purplebar: [[]],
      },
    });
    expect(pageWithTemplateArt(doc, page, 0)?.canvas.objects).toHaveLength(1);
    expect(page.canvas.objects).toHaveLength(0);
    expect(pageWithTemplateArt(doc, page, 1)).toBe(page);
    expect(
      JSON.parse(JSON.stringify(doc.freeform)).templateArt.blue[1],
    ).toBeNull();
    doc.template = "purplebar";
    expect(pageWithTemplateArt(doc, page, 0)?.canvas.objects).toHaveLength(0);
    expect(pageWithTemplateArt(doc, undefined, 1)).toBeUndefined();
  });
  it("validates template artwork with the same local-only rules as other canvas elements", () => {
    expect(() =>
      readFreeDocument({
        version: 1,
        source: "",
        pages: [blankFreePage()],
        templateArt: {
          blue: [[{ type: "Image", src: "https://example.com/private.png" }]],
        },
      }),
    ).toThrow();
  });
});
