import { describe, expect, it } from "vitest";
import { Rect } from "fabric";
import { setElementSize } from "./canvasControls";

describe("displayed element dimensions", () => {
  for (const strokeUniform of [false, true])
    for (const proportional of [false, true]) {
      it(`steps in both directions without stroke drift: uniform=${strokeUniform}, ratio=${proportional}`, () => {
        const object = new Rect({
          left: 1200,
          top: -90,
          width: 180,
          height: 70,
          strokeWidth: 3,
          strokeUniform,
          scaleX: 1.3,
          scaleY: 0.7,
        });
        for (const axis of ["width", "height"] as const) {
          const measure = () =>
            axis === "width"
              ? object.getScaledWidth()
              : object.getScaledHeight();
          const start = measure();
          for (const delta of [-1, -2, -10, 5, 0]) {
            setElementSize(object, axis, start + delta, proportional);
            expect(measure()).toBeCloseTo(start + delta, 7);
            expect(object.left).toBe(1200);
            expect(object.top).toBe(-90);
          }
        }
      });
    }
  it("ignores invalid input and stays finite at the stroke minimum", () => {
    const object = new Rect({
      width: 20,
      height: 20,
      strokeWidth: 8,
      strokeUniform: true,
    });
    setElementSize(object, "width", NaN, false);
    expect(object.scaleX).toBe(1);
    for (let i = 0; i < 10; i++) setElementSize(object, "width", 1, false);
    expect(object.getScaledWidth()).toBeLessThan(8.01);
    expect(object.scaleX).toBeGreaterThan(0);
  });
});
