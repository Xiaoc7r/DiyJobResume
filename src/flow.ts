import { createStarter } from "./starter";
import { demoFor } from "./samples";
import { experienceBlocks } from "./experience";
import { readTemplateStyle } from "./templateStyle";
import type { TemplateStyle } from "./templateStyle";
import type { ExperienceBlock } from "./experience";
import { readFreeDocument } from "./freeform";
import type { FreeDocument } from "./freeform";
export { demoFor } from "./samples";
export const PAGE = { width: 794, height: 1123 };
export const STORAGE_KEY = "diyjobresume.document.v2";
export const OLD_KEY = "diyjobresume.document.v1";
export type Kind =
  | "name"
  | "section"
  | "entry"
  | "h4"
  | "h5"
  | "h6"
  | "bullet"
  | "ordered"
  | "text"
  | "blank";
export type Template =
  | "blue"
  | "black"
  | "ribbon"
  | "academic"
  | "teal"
  | "violet"
  | "noir"
  | "reexam"
  | "purplebar"
  | "blank";
export interface Line {
  id: string;
  kind: Kind;
  text: string;
  order?: number;
}
export interface Picture {
  background?: string;
  hidden?: boolean;
  locked?: boolean;
  angle?: number;
  anchor?: string;
  id: string;
  src: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
}
export interface TypeStyle {
  size: number;
  before: number;
  after: number;
}
export interface Settings {
  justify?: boolean;
  customCss: string;
  headerAlign: "template" | "left" | "center";
  top: number;
  bottom: number;
  left: number;
  right: number;
  color: string;
  accent: string;
  font: "sans" | "serif" | "nunito";
  lineHeight: number;
  types: Record<Exclude<Kind, "blank">, TypeStyle>;
}
export interface Resume {
  templateStyle?: TemplateStyle;
  freeform?: FreeDocument;
  freeformArchive?: FreeDocument;
  freeformBaseline?: {
    settings: Settings;
    template: Template;
    pictures: Picture[];
    freeform?: FreeDocument;
  };
  version: 2;
  name: string;
  template: Template;
  lines: Line[];
  settings: Settings;
  pictures: Picture[];
}
export const uid = () => crypto.randomUUID();
export const templates: {
  id: Template;
  name: string;
  desc: string;
  color: string;
}[] = [
  {
    id: "blue",
    name: "炒肉多经典",
    desc: "居中表头 · 蓝色细线 · 紧凑清晰",
    color: "#0756a5",
  },
  {
    id: "black",
    name: "黑线 · 专业履历",
    desc: "居中表头 · 黑色横线 · 三列经历",
    color: "#171717",
  },
  {
    id: "ribbon",
    name: "标签 · 技术履历",
    desc: "简洁表头 · 黑色标签 · 分区明确",
    color: "#171717",
  },
  {
    id: "violet",
    name: "红序 · 系统架构",
    desc: "红色顶线 · 浅色分区 · 左侧标记",
    color: "#c43d3d",
  },
  {
    id: "teal",
    name: "青岚 · 工程实践",
    desc: "青色细线 · 留白分区 · 清爽技术风",
    color: "#588591",
  },
  {
    id: "academic",
    name: "紫图 · 研发履历",
    desc: "紫色细线 · 清晰分区 · 紧凑排版",
    color: "#7056a4",
  },
  {
    id: "noir",
    name: "黑调",
    desc: "黑色粗线 · 双语标题 · 简洁稳重",
    color: "#292929",
  },
  {
    id: "reexam",
    name: "复试",
    desc: "蓝色标题 · 延伸细线 · 清晰留白",
    color: "#1559a2",
  },
  {
    id: "purplebar",
    name: "紫横",
    desc: "紫色横幅 · 细线分区 · 鲜明有序",
    color: "#6554d9",
  },
  {
    id: "blank",
    name: "白板",
    desc: "纯白 A4 · 新建空白简历",
    color: "#171717",
  },
];
export const defaultSettings = (): Settings => ({
  customCss: "",
  headerAlign: "center",
  top: 30,
  bottom: 30,
  left: 42,
  right: 42,
  color: "#171717",
  accent: "#0756a5",
  font: "sans",
  lineHeight: 1.5,
  types: {
    name: { size: 24, before: 0, after: 0 },
    section: { size: 16, before: 2, after: 2 },
    entry: { size: 14, before: 3, after: 2 },
    text: { size: 13, before: 0, after: 0 },
    bullet: { size: 13, before: 1, after: 1 },
    ordered: { size: 13, before: 1, after: 1 },
    h4: { size: 15, before: 4, after: 2 },
    h5: { size: 14, before: 3, after: 2 },
    h6: { size: 13, before: 2, after: 2 },
  },
});
export const kindLabels: Record<Kind, string> = {
  name: "姓名 / 表头",
  section: "板块标题",
  entry: "经历信息",
  text: "正文",
  bullet: "要点",
  blank: "空行",
  ordered: "有序列表",
  h4: "四级标题",
  h5: "五级标题",
  h6: "六级标题",
};
const prefixes: Record<Kind, string> = {
  name: "# ",
  section: "## ",
  entry: "### ",
  bullet: "- ",
  text: "",
  blank: "",
  ordered: "1. ",
  h4: "#### ",
  h5: "##### ",
  h6: "###### ",
};
export function parseMarkdown(source: string, previous: Line[] = []): Line[] {
  if (source.length > 150000)
    throw new Error("内容过长，请控制在 15 万字以内。");
  const rows = source.replace(/\r\n?/g, "\n").split("\n");
  if (rows.length > 2000)
    throw new Error("内容超过 2000 行，请拆分为不同简历。");
  const parsed: Line[] = rows.map((row) => {
    const m = /^(#{1,6})[ \t](.*)$/.exec(row);
    let kind: Kind = "text",
      text = row;
    if (m) {
      kind = (["name", "section", "entry", "h4", "h5", "h6"] as Kind[])[
        m[1].length - 1
      ];
      text = m[2];
    } else if (/^[-*]\s/.test(row)) {
      kind = "bullet";
      text = row.slice(2);
    } else if (/^\d+[.)]\s/.test(row)) {
      return {
        id: uid(),
        kind: "ordered",
        text: row.replace(/^\d+[.)]\s+/, ""),
        order: Number(row.match(/^\d+/)![0]),
      };
    } else if (!row.length) {
      kind = "blank";
      text = "";
    }
    return { id: uid(), kind, text };
  });
  let a = 0;
  while (
    a < parsed.length &&
    a < previous.length &&
    parsed[a].kind === previous[a].kind &&
    parsed[a].text === previous[a].text
  ) {
    parsed[a].id = previous[a].id;
    a++;
  }
  let b = parsed.length - 1,
    c = previous.length - 1;
  while (
    b >= a &&
    c >= a &&
    parsed[b].kind === previous[c].kind &&
    parsed[b].text === previous[c].text
  ) {
    parsed[b].id = previous[c].id;
    b--;
    c--;
  }
  for (let i = a; i <= Math.min(b, c); i++) parsed[i].id = previous[i].id;
  return parsed;
}
export const toMarkdown = (lines: Line[]) =>
  lines
    .map(
      (l) =>
        (l.kind === "ordered" ? `${l.order || 1}. ` : prefixes[l.kind]) +
        l.text,
    )
    .join("\n");
export const demo = demoFor("blue");
export function initialResume(template: Template = "blue"): Resume {
  if (template !== "blank")
    return createStarter(
      template,
      templates.find((t) => t.id === template)!.color,
    );
  return {
    version: 2,
    name: "空白简历",
    template,
    lines: [{ id: uid(), kind: "text", text: "" }],
    settings: { ...defaultSettings(), accent: "#171717" },
    pictures: [],
  };
}
export function applyTemplate(doc: Resume, template: Template): Resume {
  return {
    ...doc,
    template,
    templateStyle: undefined,
    settings: {
      ...doc.settings,
      accent: templates.find((t) => t.id === template)!.color,
    },
  };
}

export const modules: { name: string; variants: ExperienceBlock[] }[] = [
  {
    name: "教育背景",
    variants: [
      {
        name: "学校与标签 · 专业另起一行",
        body: "### 学校名称 `985` `211` `双一流` | 2021.09 — 2025.06\n**计算机科学与技术 · 本科**",
      },
      {
        name: "学校 · 专业学位 · 时间",
        body: "### 学校名称 `985` `211` | 计算机科学与技术（本科） | 2021.09 — 2025.06\n**荣誉：**国家奖学金、大学英语六级（CET-6）、雅思 7.0",
      },
      {
        name: "研究生 · 研究与成果",
        body: "### 学校名称 `双一流` | 软件工程（硕士） | 2025.09 — 2028.06\n**研究方向：**分布式系统、数据处理\n**荣誉：**研究生学业奖学金、优秀研究生",
      },
    ],
  },
  { name: "工作经历", variants: experienceBlocks.工作经历 },
  { name: "项目经历", variants: experienceBlocks.项目经历 },
  {
    name: "专业技能",
    variants: [
      {
        name: "按能力分类",
        body: "- **编程语言：**熟悉 Java，具备面向对象开发与问题排查能力。\n- **框架工具：**熟悉 Spring Boot、MySQL、Redis。\n- **团队协作：**熟悉 Git 协作、接口联调与技术文档编写。",
      },
      {
        name: "精简要点",
        body: "- 熟悉业务需求分析、功能设计与项目交付。\n- 具备良好的沟通协作能力，能独立跟进任务。",
      },
      {
        name: "技能标签与说明",
        body: "`Java` `MySQL` `Redis` `Git`\n熟悉后端开发与数据库应用，具备接口设计、测试及日常运维经验。",
      },
    ],
  },
  {
    name: "专业奖项",
    variants: [
      {
        name: "奖项 · 时间",
        body: "### 国家奖学金 | 2024\n### 大学生创新创业大赛 · 省级一等奖 | 2023",
      },
      {
        name: "奖项 · 机构 · 时间",
        body: "### 优秀毕业生 | 学校名称 | 2025\n### 学业奖学金 | 学校名称 | 2024",
      },
      {
        name: "证书与成绩",
        body: "### 大学英语六级（CET-6） | 2024\n成绩：560 分\n### 雅思（IELTS） | 2025\n成绩：总分 7.0",
      },
    ],
  },
];
export function insertModule(doc: Resume, name: string, body: string): Resume {
  if (
    name === "工作经历" &&
    !doc.lines.some((l) => l.kind === "section" && l.text === name) &&
    doc.lines.some((l) => l.kind === "section" && l.text === "实习经历")
  )
    name = "实习经历";
  if (
    name === "实习经历" &&
    doc.lines.some((l) => l.kind === "section" && l.text === "工作经历")
  )
    name = "工作经历";
  const lines = [...doc.lines],
    start = lines.findIndex((l) => l.kind === "section" && l.text === name);
  let pos = lines.length;
  if (start >= 0) {
    const next = lines.findIndex((l, i) => i > start && l.kind === "section");
    pos = next < 0 ? lines.length : next;
  }
  const add = parseMarkdown((start < 0 ? "## " + name + "\n" : "") + body);
  lines.splice(pos, 0, ...add);
  return { ...doc, lines };
}
export function groupEnd(lines: Line[], start: number) {
  if (!lines[start]) return Math.max(0, Math.min(lines.length, start + 1));
  const k = lines[start].kind;
  if (k !== "section" && k !== "entry") return start + 1;
  let end = start + 1;
  while (
    end < lines.length &&
    lines[end].kind !== "section" &&
    lines[end].kind !== "name" &&
    (k === "section" || lines[end].kind !== "entry")
  )
    end++;
  return end;
}
export function moveGroup(doc: Resume, id: string, target: string): Resume {
  const a = doc.lines.findIndex((l) => l.id === id),
    b = doc.lines.findIndex((l) => l.id === target);
  if (a < 0 || b < 0) return doc;
  const end = groupEnd(doc.lines, a);
  if (b >= a && b < end) return doc;
  const lines = [...doc.lines],
    part = lines.splice(a, end - a);
  lines.splice(b > a ? b - part.length : b, 0, ...part);
  return { ...doc, lines };
}
// 把 id 所在的块（section/entry 会带上它后面的内容）移到第 boundary 行之前。
// boundary 用「原数组下标」表示，等于 lines.length 时就是移到末尾。
export function moveGroupToBoundary(
  doc: Resume,
  id: string,
  boundary: number,
): Resume {
  const from = doc.lines.findIndex((l) => l.id === id);
  if (from < 0) return doc;
  const end = groupEnd(doc.lines, from);
  if (boundary >= from && boundary <= end) return doc;
  const part = doc.lines.slice(from, end),
    rest = [...doc.lines.slice(0, from), ...doc.lines.slice(end)];
  rest.splice(boundary > end ? boundary - part.length : boundary, 0, ...part);
  return { ...doc, lines: rest };
}
// 每一块（section/entry 连同它的内容）的起始下标，末尾也算一个插入点
export function blockStarts(lines: Line[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i = groupEnd(lines, i)) starts.push(i);
  starts.push(lines.length);
  return starts;
}
// 把插入点吸附到最近的「块与块之间」，避免板块标题插进别人的内容里。
// 传 id 时会跳过被拖那一块自己的区间，免得「吸附回原位」看起来像没反应。
export function snapToBlockBoundary(
  lines: Line[],
  boundary: number,
  id = "",
): number {
  const from = id ? lines.findIndex((l) => l.id === id) : -1,
    end = from >= 0 ? groupEnd(lines, from) : -1;
  const starts = blockStarts(lines).filter(
    (start) => from < 0 || start < from || start >= end,
  );
  let best = starts[0] ?? 0;
  for (const start of starts)
    if (Math.abs(start - boundary) < Math.abs(best - boundary)) best = start;
  return best;
}
// index 这一行属于哪个板块：板块标题本身、它后面的内容都算同一块；
// 第一个板块标题之前的内容（姓名、联系方式）算表头块。
export function blockRange(lines: Line[], index: number) {
  let start = -1;
  for (let i = 0; i < index; i++) if (lines[i].kind === "section") start = i;
  if (lines[index]?.kind === "section") start = index;
  if (start >= 0) return { start, end: groupEnd(lines, start) };
  const firstSection = lines.findIndex((l) => l.kind === "section");
  return { start: 0, end: firstSection < 0 ? lines.length : firstSection };
}
// 拖放落点的最终修正：板块标题吸附到整块之间；普通行只能待在自己板块内
export function resolveDropBoundary(
  lines: Line[],
  dragId: string,
  boundary: number,
): number {
  const from = lines.findIndex((l) => l.id === dragId);
  if (from < 0) return boundary;
  if (lines[from].kind === "section")
    return snapToBlockBoundary(lines, boundary, dragId);
  const { start, end } = blockRange(lines, from);
  return Math.min(end, Math.max(start + 1, boundary));
}
const numeric = (v: unknown, d: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : d;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const hex = (v: unknown, d: string) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d;
export function readResume(raw: unknown): Resume {
  if (!raw || typeof raw !== "object")
    throw new Error("这不是有效的简历备份。");
  const r = raw as Record<string, any>;
  if (r.version === 1 && Array.isArray(r.blocks)) {
    const doc = initialResume("blank");
    doc.template = "blue";
    doc.settings = defaultSettings();
    doc.name = str(r.name, "我的简历");
    doc.lines = [];
    doc.pictures = [];
    for (const b of [...r.blocks].sort(
      (a, b) => a.page - b.page || a.y - b.y,
    )) {
      if (
        b.kind === "image" &&
        typeof b.image === "string" &&
        /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(b.image)
      )
        doc.pictures.push({
          id: uid(),
          src: b.image,
          label: "旧版图片",
          page: Math.max(0, Number(b.page) || 0),
          x: Math.max(0, Number(b.x) || 0),
          y: Math.max(0, Number(b.y) || 0),
          w: Math.min(300, Number(b.w) || 80),
          h: Math.min(300, Number(b.h) || 80),
        });
      if (["image", "shape", "divider"].includes(b.kind)) continue;
      const t = str(b.title),
        sub = str(b.subtitle),
        meta = str(b.meta),
        body = str(b.body).replace(/^•\s*/gm, "- ");
      doc.lines.push(
        ...parseMarkdown(
          (t ? (b.kind === "header" ? "# " : "## ") + t + "\n" : "") +
            (sub ? "### " + sub + (meta ? " | " + meta : "") + "\n" : "") +
            body,
        ),
      );
    }
    return doc;
  }
  if (r.version !== 2 || !Array.isArray(r.lines) || r.lines.length > 2000)
    throw new Error("备份格式或版本不支持。");
  const doc = initialResume("blank"),
    seen = new Set<string>();
  doc.name = str(r.name, "我的简历").slice(0, 100);
  doc.template = templates.some((t) => t.id === r.template)
    ? r.template
    : "blue";
  doc.settings.accent = templates.find((t) => t.id === doc.template)!.color;
  doc.lines = r.lines.map((l: any) => {
    if (!l || !Object.hasOwn(kindLabels, l.kind) || typeof l.text !== "string")
      throw new Error("备份中的内容格式不正确。");
    const id =
      typeof l.id === "string" &&
      /^[a-z\d_-]{1,80}$/i.test(l.id) &&
      !seen.has(l.id)
        ? l.id
        : uid();
    seen.add(id);
    return {
      id,
      kind: l.kind,
      text: l.text,
      ...(l.kind === "ordered"
        ? { order: Math.max(1, Math.floor(numeric(l.order, 1, 1, 9999))) }
        : {}),
    };
  });
  if (toMarkdown(doc.lines).length > 150000) throw new Error("备份内容过长。");
  const s = r.settings || {},
    d = doc.settings;
  d.customCss =
    typeof s.customCss === "string" ? s.customCss.slice(0, 20000) : "";
  d.top = numeric(s.top, d.top, 12, 150);
  d.bottom = numeric(s.bottom, d.bottom, 12, 150);
  d.left = numeric(s.left, 42, 12, 150);
  d.right = numeric(s.right, 42, 12, 150);
  d.color = hex(s.color, d.color);
  d.accent = hex(s.accent, d.accent);
  d.font = ["sans", "serif", "nunito"].includes(s.font) ? s.font : "sans";
  if (s.justify !== undefined) d.justify = s.justify === true;
  d.headerAlign = ["template", "left", "center"].includes(s.headerAlign)
    ? s.headerAlign
    : "template";
  d.lineHeight = numeric(s.lineHeight, d.lineHeight, 1.1, 2.2);
  for (const k of Object.keys(d.types) as (keyof Settings["types"])[]) {
    const t = s.types?.[k] || {};
    d.types[k] = {
      size: numeric(t.size, d.types[k].size, 1, 300),
      before: numeric(t.before, d.types[k].before, 0, 40),
      after: numeric(t.after, d.types[k].after, 0, 40),
    };
  }
  doc.pictures = (Array.isArray(r.pictures) ? r.pictures : [])
    .slice(0, 10)
    .filter(
      (p: any) =>
        p &&
        typeof p.src === "string" &&
        p.src.length < 2200000 &&
        /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(p.src),
    )
    .map((p: any) => ({
      id:
        typeof p.id === "string" && /^[a-z\d_-]{1,80}$/i.test(p.id)
          ? p.id
          : uid(),
      ...(typeof p.anchor === "string" && /^[a-z\d_-]{1,80}$/i.test(p.anchor)
        ? { anchor: p.anchor }
        : {}),
      src: p.src,
      label: str(p.label, "图片"),
      x: numeric(p.x, 42, -5000, 5000),
      y: numeric(p.y, 36, -5000, 5000),
      w: numeric(p.w, 72, 1, 5000),
      h: numeric(p.h, 72, 1, 5000),
      ...(p.angle ? { angle: numeric(p.angle, 0, -360, 360) } : {}),
      ...(p.hidden ? { hidden: true } : {}),
      ...(p.locked ? { locked: true } : {}),
      ...(p.background === "transparent" || /^#[a-f\d]{6}$/i.test(p.background)
        ? { background: p.background }
        : {}),
      page: Math.floor(numeric(p.page, 0, 0, 500)),
    }));
  if (r.templateStyle !== undefined)
    doc.templateStyle = readTemplateStyle(r.templateStyle);
  if (r.freeform !== undefined) doc.freeform = readFreeDocument(r.freeform);
  if (r.freeformArchive !== undefined)
    doc.freeformArchive = readFreeDocument(r.freeformArchive);
  if (r.freeformBaseline && typeof r.freeformBaseline === "object") {
    const baseline = readResume({
      ...r,
      ...r.freeformBaseline,
      freeformBaseline: undefined,
      freeformArchive: undefined,
      freeform: r.freeformBaseline.freeform,
    });
    doc.freeformBaseline = {
      settings: baseline.settings,
      template: baseline.template,
      pictures: baseline.pictures,
      ...(baseline.freeform ? { freeform: baseline.freeform } : {}),
    };
  }
  return doc;
}
export interface Piece {
  line: Line;
  start: number;
  end: number;
  height: number;
  continued: boolean;
}
export function paginate(
  lines: Line[],
  capacity: number,
  measure: (line: Line, text: string, continued: boolean) => number,
): Piece[][] {
  const pages: Piece[][] = [[]];
  let used = 0;
  const next = () => {
    if (pages.at(-1)!.length) {
      pages.push([]);
      used = 0;
    }
  };
  const live = lines.filter((l) => l.kind !== "blank");
  for (let index = 0; index < live.length; index++) {
    const line = live[index];
    let start = 0;
    const full = measure(line, line.text, false);
    if (
      (line.kind === "name" ||
        line.kind === "section" ||
        line.kind === "entry") &&
      live[index + 1]
    ) {
      let needed = full;
      for (let j = index + 1; j < live.length; j++) {
        const nextLine = live[j],
          height = measure(nextLine, nextLine.text, false);
        if (
          nextLine.kind === "section" ||
          nextLine.kind === "entry" ||
          nextLine.kind === "name"
        ) {
          needed += height;
          continue;
        }
        needed += Math.min(height, 60);
        break;
      }
      if (needed <= capacity && used + needed > capacity) next();
    }
    if (full <= capacity) {
      if (used + full > capacity) next();
      pages.at(-1)!.push({
        line,
        start: 0,
        end: line.text.length,
        height: full,
        continued: false,
      });
      used += full;
      continue;
    }
    while (start < line.text.length) {
      let room = capacity - used;
      if (room < measure(line, "字", start > 0)) {
        next();
        room = capacity;
      }
      let low = start + 1,
        high = line.text.length,
        best = start;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (measure(line, line.text.slice(start, mid), start > 0) <= room) {
          best = mid;
          low = mid + 1;
        } else high = mid - 1;
      }
      if (best === start) {
        if (used) {
          next();
          continue;
        }
        best = start + 1;
      }
      if (
        best < line.text.length &&
        /[\uD800-\uDBFF]/.test(line.text[best - 1])
      )
        best = best - 1 > start ? best - 1 : best + 1;
      const h = measure(line, line.text.slice(start, best), start > 0);
      pages
        .at(-1)!
        .push({ line, start, end: best, height: h, continued: start > 0 });
      used += h;
      start = best;
      if (start < line.text.length) next();
    }
  }
  return pages;
}
