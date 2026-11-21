import { Rect, Circle, Triangle, Ellipse, Polygon, Path, Line } from "fabric";
export function makeCanvasShape(
  name: string,
  color: string,
  paperWidth: number,
) {
  const base = {
    left: 60,
    top: 80,
    fill: "#edf2f7",
    stroke: color,
    strokeWidth: 1,
  };
  switch (name) {
    case "矩形":
      return new Rect({ ...base, width: 180, height: 80 });
    case "圆形":
      return new Circle({ ...base, radius: 45 });
    case "三角形":
      return new Triangle({ ...base, width: 100, height: 90 });
    case "分隔线":
      return new Line([0, 0, Math.min(360, paperWidth - 100), 0], {
        ...base,
        strokeWidth: 1.5,
      });
    case "标题色带":
      return new Rect({
        ...base,
        width: Math.min(450, paperWidth - 100),
        height: 35,
        fill: color,
        rx: 4,
        ry: 4,
      });
    default:
      return makeWorkshopShape(name, color);
  }
}
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
