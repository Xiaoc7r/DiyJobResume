import school from "./assets/jlu.png?inline";
import company from "./assets/company.png?inline";
import video from "./assets/video.png?inline";
import type { Line, Picture } from "./flow";

export function defaultPictures(lines: Line[]): Picture[] {
  const picture = (
    label: string,
    src: string,
    x: number,
    y: number,
    w: number,
    h: number,
    anchor?: string,
  ): Picture => ({
    id: crypto.randomUUID(),
    label,
    src,
    x,
    y,
    w,
    h,
    page: 0,
    ...(anchor ? { anchor } : {}),
  });
  const entries = lines.filter((l) => l.kind === "entry");
  return [
    picture("吉林大学校徽", school, 40, 20, 60, 60),
    ...entries
      .filter((l) => l.text.includes("东京 -"))
      .map((l) => picture("京东.png", company, 42, 3, 16, 16, l.id)),
    ...entries
      .filter((l) => l.text.includes("DoVideoAI"))
      .map((l) => picture("视频.png", video, 42, 3, 16, 16, l.id)),
  ];
}
