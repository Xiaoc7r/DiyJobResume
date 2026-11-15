import { Rect, Ellipse, Polygon, Path, Line } from "fabric";
export const workshopShapes = [
  "圆角矩形",
  "空心框",
  "虚线",
  "虚线框",
  "椭圆",
  "菱形",
  "六边形",
  "五角星",
  "梯形",
  "箭头",
  "曲线",
  "圆弧",
] as const;
export function makeWorkshopShape(name: string, color: string) {
  const style = {
    left: 42,
    top: 100,
    fill: "transparent",
    stroke: color,
    strokeWidth: 1.5,
  };
  const polygon = (points: number[][]) =>
    new Polygon(
      points.map(([x, y]) => ({ x, y })),
      style,
    );
  switch (name) {
    case "圆角矩形":
      return new Rect({
        ...style,
        width: 180,
        height: 28,
        rx: 10,
        ry: 10,
        fill: color,
      });
    case "空心框":
      return new Rect({ ...style, width: 220, height: 28 });
    case "虚线框":
      return new Rect({
        ...style,
        width: 220,
        height: 28,
        strokeDashArray: [6, 4],
      });
    case "虚线":
      return new Line([0, 0, 360, 0], { ...style, strokeDashArray: [6, 4] });
    case "椭圆":
      return new Ellipse({ ...style, rx: 50, ry: 14 });
    case "菱形":
      return polygon([
        [0, 14],
        [24, 0],
        [48, 14],
        [24, 28],
      ]);
    case "六边形":
      return polygon([
        [8, 0],
        [40, 0],
        [48, 14],
        [40, 28],
        [8, 28],
        [0, 14],
      ]);
    case "梯形":
      return polygon([
        [0, 28],
        [12, 0],
        [120, 0],
        [132, 28],
      ]);
    case "五角星":
      return polygon(
        Array.from({ length: 10 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 5,
            r = i % 2 ? 7 : 14;
          return [14 + Math.cos(a) * r, 14 + Math.sin(a) * r];
        }),
      );
    case "箭头":
      return new Path("M0 10 H150 M140 0 L150 10 L140 20", style);
    case "圆弧":
      return new Path("M0 28 Q45 -20 90 28", style);
    default:
      return new Path("M0 14 C40 -14 60 42 100 14 S160 14 200 14", style);
  }
}
