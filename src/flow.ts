import { demoFor } from "./samples";
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
  | "violet";
export interface Line {
  id: string;
  kind: Kind;
  text: string;
  order?: number;
}
export interface Picture {
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
    id: "academic",
    name: "蓝图 · 研发履历",
    desc: "简洁表头 · 延伸细线 · 清晰分区",
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
    desc: "左对齐表头 · 黑色标签 · 分区明确",
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
];
export const defaultSettings = (): Settings => ({
  customCss: "",
  headerAlign: "template",
  top: 31,
  bottom: 28,
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
    const m = /^(#{1,6})\s+(.*)$/.exec(row);
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
    } else if (!row.trim()) {
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
  return {
    version: 2,
    name: "炒肉多的简历",
    template,
    lines: parseMarkdown(demoFor(template)),
    settings: {
      ...defaultSettings(),
      accent: templates.find((t) => t.id === template)!.color,
    },
    pictures: [],
  };
}
export function applyTemplate(doc: Resume, template: Template): Resume {
  return {
    ...doc,
    template,
    lines:
      toMarkdown(doc.lines) === demoFor(doc.template)
        ? parseMarkdown(demoFor(template), doc.lines)
        : doc.lines,
    settings: {
      ...doc.settings,
      accent: templates.find((t) => t.id === template)!.color,
    },
  };
}
export const modules = [
  {
    name: "教育背景",
    variants: [
      {
        name: "学校 · 时间",
        body: "### 示例大学 · 专业名称 | 2021.09 — 2025.06\n本科 · 学历 / 学位\n- 主修课程与学业亮点。",
      },
      {
        name: "时间 · 学校 · 专业",
        body: "### 2021.09 — 2025.06 | 示例大学 | 专业名称 · 本科\n- 学业成绩、研究方向与相关课程。",
      },
    ],
  },
  {
    name: "实习经历",
    variants: [
      {
        name: "公司 · 时间",
        body: "### 公司名称 · 岗位名称 | 2024.07 — 2024.12\n**工作概述：**简要说明业务背景与职责。\n- **行动：**你具体完成了什么。\n- **成果：**用真实结果说明你的贡献。",
      },
      {
        name: "公司 · 岗位 · 时间",
        body: "### 公司名称 | 后端开发实习生 | 2024.07 — 2024.12\n- **背景：**业务面临的问题。\n- **职责：**你负责的工作。\n- **成果：**可验证的结果。",
      },
    ],
  },
  {
    name: "项目经历",
    variants: [
      {
        name: "项目 · 角色",
        body: "### 项目名称 | 角色 · 时间\n技术栈：`工具一` `工具二`\n**项目简介：**项目解决的问题与使用场景。\n- **贡献：**你负责的设计与实现。\n- **成果：**项目的实际效果。",
      },
      {
        name: "项目 · 角色 · 时间",
        body: "### 项目名称 | 核心开发者 | 2024.01 — 2024.06\n- **背景：**项目目标与业务需求。\n- **技术：**实现方案与选型原因。\n- **难点：**解决了什么问题。\n- **成果：**真实可验证的结果。",
      },
    ],
  },
  {
    name: "专业技能",
    variants: [
      {
        name: "分类要点",
        body: "- **编程语言：**填写熟悉的语言与能力。\n- **框架工具：**填写实际使用过的框架。\n- **工程实践：**填写协作与交付经验。",
      },
      {
        name: "简洁段落",
        body: "熟悉的技能、工具与工作方法。突出与目标岗位相关的能力，并说明熟练程度。",
      },
    ],
  },
  {
    name: "专业奖项",
    variants: [
      {
        name: "逐项列举",
        body: "- 2024 · 奖项名称 · 颁发单位\n- 2023 · 奖学金 / 荣誉称号",
      },
      {
        name: "奖项 · 时间",
        body: "### 奖项名称 | 2024\n颁发单位与简要说明。",
      },
    ],
  },
];
modules.find((m) => m.name === "实习经历")!.name = "工作经历";
const extraVariants: Record<string, { name: string; body: string }[]> = {
  教育背景: [
    {
      name: "学位卡片 · 课程标签",
      body: "### 学校名称 | 专业 · 学位 | 入学 — 毕业\n`核心课程` `研究方向` `学业荣誉`\nGPA / 学术成果与相关经历。",
    },
    {
      name: "学术经历 · 成果列表",
      body: "### 学校名称 · 研究方向 | 入学 — 毕业\n1. 研究课题与个人贡献。\n2. 论文、竞赛或学术成果。",
    },
  ],
  工作经历: [
    {
      name: "职责 · 行动 · 结果",
      body: "### 公司名称 | 岗位名称 | 开始 — 结束\n**职责范围：**业务规模与负责的边界。\n- **关键行动：**设计方案、技术取舍与推进过程。\n- **业务结果：**可核验的交付成果与改进。",
    },
    {
      name: "技术标签 · 核心贡献",
      body: "### 公司名称 · 团队 | 开始 — 结束\n`岗位名称` `业务方向` `核心技术`\n- 主导的核心模块与工程实践。\n- 性能、稳定性或协作方面的改进。",
    },
  ],
  项目经历: [
    {
      name: "项目卡片 · 链接与技术栈",
      body: "### 项目名称 | 开始 — 结束\n[项目地址](https://github.com/Xiaoc7r)\n`技术一` `技术二` `技术三`\n**项目目标：**解决的问题与使用场景。\n- **个人贡献：**实现与取舍。",
    },
    {
      name: "方案拆解 · 编号成果",
      body: "### 项目名称 | 负责角色 | 开始 — 结束\n**项目概述：**目标与关键约束。\n1. 架构设计与技术选型。\n2. 核心难点及解决方案。\n3. 交付结果与验证方式。",
    },
  ],
  专业技能: [
    {
      name: "技能标签 · 能力说明",
      body: "`Java` `MySQL` `Redis` `工程实践`\n结合具体场景说明掌握深度，避免只列工具名称。",
    },
    {
      name: "能力分组 · 左右对照",
      body: "### 技术领域 | 实践能力\n### 后端开发 | 接口设计、并发与稳定性\n### 数据存储 | 索引设计、缓存与一致性",
    },
  ],
  专业奖项: [
    {
      name: "荣誉标签 · 说明",
      body: "### 奖项名称 | 获奖时间\n`颁发单位` `奖项等级`\n简述评选范围与获奖贡献。",
    },
    {
      name: "奖项 · 机构 · 时间",
      body: "### 奖项名称 | 颁发机构 | 获奖时间\n### 荣誉名称 | 颁发机构 | 获奖时间",
    },
  ],
};
for (const module of modules)
  module.variants.push(...(extraVariants[module.name] || []));
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
    const doc = initialResume();
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
  const doc = initialResume(),
    seen = new Set<string>();
  doc.name = str(r.name, "我的简历").slice(0, 100);
  doc.template = templates.some((t) => t.id === r.template)
    ? r.template
    : "blue";
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
      id: uid(),
      src: p.src,
      label: str(p.label, "图片"),
      x: numeric(p.x, 42, 0, 700),
      y: numeric(p.y, 36, 0, 1000),
      w: numeric(p.w, 72, 24, 300),
      h: numeric(p.h, 72, 24, 300),
      page: Math.floor(numeric(p.page, 0, 0, 500)),
    }));
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
