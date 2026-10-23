import { PAGE, defaultSettings } from "./flow";
import type { Resume, Settings } from "./flow";

export const densities = [
  {
    id: "compact",
    name: "紧凑",
    hint: "经历较多，减少留白",
    lineHeight: 1.35,
    top: 26,
    bottom: 26,
    factor: 0.5,
  },
  {
    id: "standard",
    name: "标准",
    hint: "日常投递，清晰均衡",
    lineHeight: 1.5,
    top: 31,
    bottom: 28,
    factor: 1,
  },
  {
    id: "relaxed",
    name: "舒展",
    hint: "内容精简，增加呼吸感",
    lineHeight: 1.65,
    top: 38,
    bottom: 38,
    factor: 1.75,
  },
] as const;
export type Density = (typeof densities)[number]["id"];

export function applyDensity(settings: Settings, id: Density): Settings {
  const preset = densities.find((p) => p.id === id)!;
  const defaults = defaultSettings().types;
  const types = { ...settings.types };
  for (const key of Object.keys(types) as (keyof typeof types)[]) {
    types[key] = {
      ...types[key],
      before: Math.round(defaults[key].before * preset.factor * 2) / 2,
      after: Math.round(defaults[key].after * preset.factor * 2) / 2,
    };
  }
  return {
    ...settings,
    types,
    lineHeight: preset.lineHeight,
    top: preset.top,
    bottom: preset.bottom,
  };
}

export function activeDensity(settings: Settings): Density | "custom" {
  return (
    densities.find((p) => {
      const applied = applyDensity(settings, p.id);
      return (
        applied.lineHeight === settings.lineHeight &&
        applied.top === settings.top &&
        applied.bottom === settings.bottom &&
        Object.keys(settings.types).every((k) => {
          const key = k as keyof Settings["types"];
          return (
            applied.types[key].before === settings.types[key].before &&
            applied.types[key].after === settings.types[key].after
          );
        })
      );
    })?.id ?? "custom"
  );
}

export interface ExportIssue {
  message: string;
  lineId?: string;
  page?: number;
}
export function checkContent(doc: Resume, pageCount: number): ExportIssue[] {
  const issues: ExportIssue[] = [];
  if (!doc.lines.some((l) => l.kind !== "blank" && l.text.trim()))
    issues.push({ message: "简历正文为空，请先填写内容。" });
  const placeholders = doc.lines.filter((l) => /\[填写[^\]]*\]/.test(l.text));
  if (placeholders.length)
    issues.push({
      message: `还有 ${placeholders.length} 处内容保留“填写…”提示，请替换为自己的经历。`,
      lineId: placeholders[0].id,
    });
  for (const p of doc.pictures) {
    if (
      p.page >= pageCount ||
      p.x < 0 ||
      p.y < 0 ||
      p.x + p.w > PAGE.width ||
      p.y + p.h > PAGE.height
    )
      issues.push({
        message: `${p.label}超出了纸张范围，可能无法完整导出。`,
        page: p.page,
      });
  }
  return issues;
}

// Actual rendered bounds include custom CSS and browser font metrics.
export function checkRendered(root: HTMLElement): ExportIssue[] {
  const issues: ExportIssue[] = [];
  root.querySelectorAll<HTMLElement>(".resume-paper").forEach((paper, page) => {
    const bounds = paper.getBoundingClientRect();
    const rows = [...paper.querySelectorAll<HTMLElement>("[data-line]")];
    const overflow = rows.find((row) => {
      const r = row.getBoundingClientRect();
      return (
        r.right > bounds.right + 2 ||
        r.left < bounds.left - 2 ||
        r.bottom > bounds.bottom + 2 ||
        r.top < bounds.top - 2 ||
        row.scrollWidth > row.clientWidth + 2
      );
    });
    if (overflow)
      issues.push({
        message: `第 ${page + 1} 页有文字超出可用范围，请检查长链接、字号或自定义样式。`,
        lineId: overflow.dataset.line,
        page,
      });
    if (
      page > 0 &&
      !rows.some((r) => r.textContent?.trim()) &&
      !paper.querySelector("img")
    )
      issues.push({
        message: `第 ${page + 1} 页没有可见内容，请检查额外留白。`,
        page,
      });
    paper.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      if (!img.complete || !img.naturalWidth)
        issues.push({
          message: `第 ${page + 1} 页的图片尚未成功加载，请重新上传或稍后重试。`,
          page,
        });
    });
  });
  return issues;
}
