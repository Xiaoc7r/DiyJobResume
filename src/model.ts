export const PAGE = { width: 794, height: 1123, margin: 48 };
export const STORAGE_KEY = "diyjobresume.document.v1";
export type Kind =
  | "header"
  | "education"
  | "experience"
  | "project"
  | "skills"
  | "awards"
  | "text"
  | "divider"
  | "shape"
  | "image";
export type Variant = "line" | "soft" | "minimal";
export type Font = "sans" | "serif";
export interface Block {
  id: string;
  kind: Kind;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle: string;
  meta: string;
  body: string;
  variant: Variant;
  fontSize: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  color: string;
  fill: string;
  radius: number;
  image?: string;
}
export interface Resume {
  version: 1;
  name: string;
  template: string;
  accent: string;
  font: Font;
  pages: number;
  blocks: Block[];
}
export interface HistoryState {
  past: Resume[];
  present: Resume;
  future: Resume[];
  group?: string;
  timestamp: number;
}
export type HistoryAction =
  | { type: "set"; doc: Resume; group?: string; now?: number; record?: boolean }
  | { type: "checkpoint" }
  | { type: "undo" }
  | { type: "redo" };
export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
      timestamp: 0,
    };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present].slice(-60),
      present: state.future[0],
      future: state.future.slice(1),
      timestamp: 0,
    };
  }
  if (action.type === "checkpoint")
    return {
      ...state,
      past: [...state.past, state.present].slice(-60),
      future: [],
      group: undefined,
      timestamp: 0,
    };
  const now = action.now ?? Date.now();
  const grouped = Boolean(
    action.group && action.group === state.group && now - state.timestamp < 700,
  );
  return {
    past:
      action.record === false || grouped
        ? state.past
        : [...state.past, state.present].slice(-60),
    present: action.doc,
    future: [],
    group: action.group,
    timestamp: now,
  };
}
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const labels: Record<Kind, string> = {
  header: "个人信息",
  education: "教育背景",
  experience: "实习经历",
  project: "项目经历",
  skills: "个人技能",
  awards: "专业奖项",
  text: "自由文本",
  divider: "分割线",
  shape: "色块",
  image: "照片 / 图片",
};
export const accents = [
  "#97634e",
  "#283f55",
  "#687958",
  "#715d7e",
  "#292c2d",
  "#b26c43",
];
const examples: Record<Kind, Partial<Block>> = {
  header: {
    title: "林予安",
    subtitle: "产品设计师 / 用户体验",
    body: "138 0000 0000   ·   hello@example.com   ·   上海",
    h: 120,
  },
  education: {
    title: "教育背景",
    subtitle: "某某大学 · 数字媒体艺术",
    meta: "2020.09 — 2024.06",
    body: "本科 · GPA 3.8 / 4.0\n主修课程：用户体验设计、交互设计、视觉传达",
    h: 128,
  },
  experience: {
    title: "实习经历",
    subtitle: "某某科技 · 产品设计实习生",
    meta: "2024.03 — 2024.09",
    body: "• 参与核心产品的体验优化，从用户访谈到界面设计跟进完整流程。\n• 与产品、研发共同梳理关键路径，让复杂的信息更清晰易用。\n• 整理组件规范与设计文档，帮助团队保持一致的产品体验。",
    h: 162,
  },
  project: {
    title: "项目经历",
    subtitle: "「留白」· 一款让记录更轻松的生活应用",
    meta: "独立项目 · 2024",
    body: "围绕日常记录场景，完成从需求探索到交互原型的设计。\n• 通过用户访谈发现高频需求，建立清晰的信息架构。\n• 设计轻量的记录流程与视觉系统，制作可交互原型。\n• 根据可用性测试反馈迭代，持续打磨细节体验。",
    h: 182,
  },
  skills: {
    title: "个人技能",
    subtitle: "",
    meta: "",
    body: "设计工具    Figma / Photoshop / Illustrator\n专业能力    用户研究 / 交互设计 / 设计系统\n综合能力    跨团队协作 / 英文阅读与沟通",
    h: 132,
  },
  awards: {
    title: "专业奖项",
    subtitle: "",
    meta: "",
    body: "2023  ·  全国大学生设计竞赛二等奖\n2022  ·  校级优秀学生奖学金",
    h: 102,
  },
  text: {
    title: "关于我",
    subtitle: "",
    meta: "",
    body: "在这里写下你的独特之处。可以是一段自我介绍，也可以是一项值得被看见的经历。",
    h: 106,
  },
  divider: { title: "分割线", body: "", h: 12 },
  shape: {
    title: "色块",
    body: "",
    w: 200,
    h: 100,
    fill: "#eee5da",
    radius: 8,
  },
  image: { title: "我的照片", body: "", w: 96, h: 128 },
};
export function createBlock(kind: Kind, variant: Variant = "line"): Block {
  return {
    id: uid(),
    kind,
    page: 0,
    x: 48,
    y: 48,
    w: 698,
    h: 120,
    title: labels[kind],
    subtitle: "",
    meta: "",
    body: "",
    variant,
    fontSize: 13,
    lineHeight: 1.75,
    align: "left",
    color: "#373632",
    fill: "transparent",
    radius: 0,
    ...examples[kind],
  };
}
export const templateInfo = [
  {
    id: "linen",
    name: "温柔留白",
    detail: "干净舒展，让内容自己说话",
    tag: "推荐",
    accent: "#97634e",
  },
  {
    id: "classic",
    name: "经典专业",
    detail: "清晰有序，适合大多数岗位",
    tag: "百搭",
    accent: "#283f55",
  },
  {
    id: "creative",
    name: "灵感拼贴",
    detail: "轻巧双栏，多一点个人风格",
    tag: "个性",
    accent: "#687958",
  },
];
export function initialResume(): Resume {
  const blocks: Block[] = [];
  let y = 48;
  for (const kind of [
    "header",
    "education",
    "experience",
    "project",
    "skills",
    "awards",
  ] as Kind[]) {
    const b = createBlock(kind, "minimal");
    b.y = y;
    blocks.push(b);
    y += b.h + 16;
  }
  return {
    version: 1,
    name: "我的第一份简历",
    template: "linen",
    accent: accents[0],
    font: "sans",
    pages: 1,
    blocks,
  };
}
// Layout affects geometry and visual treatment, never the user's content.
export function arrange(doc: Resume, template = doc.template): Resume {
  const ordered = [...doc.blocks];
  const result: Block[] = [];
  let y = 48,
    page = 0;
  for (const block of ordered) {
    if (
      block.kind === "shape" ||
      block.kind === "divider" ||
      block.kind === "image"
    ) {
      result.push({ ...block });
      continue;
    }
    const b = {
      ...block,
      x: 48,
      w: 698,
      align: "left" as Block["align"],
      variant: (template === "classic"
        ? "line"
        : template === "creative"
          ? "soft"
          : "minimal") as Variant,
    };
    if (b.kind === "header")
      b.align = template === "classic" ? "center" : "left";
    if (y + b.h > PAGE.height - 48 && y > 48) {
      page++;
      y = 48;
    }
    b.y = y;
    b.page = page;
    result.push(b);
    y += b.h + 16;
  }
  if (template === "creative") {
    const headerBottom = Math.max(
      184,
      ...result.filter((b) => b.kind === "header").map((b) => 48 + b.h),
    );
    let sideY = headerBottom + 24,
      mainY = headerBottom + 24,
      sidePage = 0,
      mainPage = 0;
    result.forEach((b) => {
      if (["shape", "divider", "image"].includes(b.kind)) return;
      if (b.kind === "header") {
        b.x = 48;
        b.y = 48;
        b.w = 698;
        b.page = 0;
        return;
      }
      const side = ["education", "skills", "awards"].includes(b.kind);
      b.w = side ? 224 : 446;
      b.x = side ? 48 : 300;
      // Reserve more room in the narrow column; users can still resize freely.
      if (side) b.h = Math.max(b.h, b.kind === "education" ? 184 : 166);
      if (side) {
        if (sideY + b.h > 1075) {
          sidePage++;
          sideY = 48;
        }
        b.y = sideY;
        b.page = sidePage;
        sideY += b.h + 22;
      } else {
        if (mainY + b.h > 1075) {
          mainPage++;
          mainY = 48;
        }
        b.y = mainY;
        b.page = mainPage;
        mainY += b.h + 22;
      }
    });
  }
  const maxPage = Math.max(0, ...result.map((b) => b.page));
  return { ...doc, template, pages: maxPage + 1, blocks: result };
}
export function addBlock(doc: Resume, block: Block): Resume {
  const page = doc.pages - 1;
  const bottom = Math.max(
    32,
    ...doc.blocks
      .filter((b) => b.page === page && b.kind !== "shape")
      .map((b) => b.y + b.h),
  );
  const next = { ...block, page, y: bottom + 18 };
  if (next.y + next.h > PAGE.height - 48) {
    next.page++;
    next.y = 48;
  }
  return {
    ...doc,
    pages: Math.max(doc.pages, next.page + 1),
    blocks: [...doc.blocks, next],
  };
}
export function constrain(block: Block): Block {
  const w = Math.max(
    block.kind === "divider" ? 40 : 60,
    Math.min(PAGE.width, block.w),
  );
  const h = Math.max(
    block.kind === "divider" ? 4 : 32,
    Math.min(PAGE.height, block.h),
  );
  return {
    ...block,
    w,
    h,
    x: Math.max(0, Math.min(PAGE.width - w, block.x)),
    y: Math.max(0, Math.min(PAGE.height - h, block.y)),
  };
}
const string = (v: unknown, max = 20000) =>
  typeof v === "string" ? v.slice(0, max) : "";
const number = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(min, Math.min(max, v))
    : fallback;
const color = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
export function parseResume(input: unknown): Resume {
  if (!input || typeof input !== "object")
    throw new Error("这不是有效的简历备份文件");
  const d = input as Record<string, unknown>;
  if (d.version !== 1 || !Array.isArray(d.blocks) || d.blocks.length > 100)
    throw new Error("备份版本不支持，或模块数量超过 100 个");
  const seen = new Set<string>();
  const blocks = d.blocks.map((raw: unknown) => {
    if (!raw || typeof raw !== "object")
      throw new Error("备份中的模块格式不正确");
    const b = raw as Record<string, unknown>;
    if (typeof b.kind !== "string" || !Object.hasOwn(labels, b.kind))
      throw new Error("备份中包含不支持的模块");
    let id = string(b.id, 100) || uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    const result: Block = {
      id,
      kind: b.kind as Kind,
      page: Math.floor(number(b.page, 0, 0, 19)),
      x: number(b.x, 48, 0, 794),
      y: number(b.y, 48, 0, 1123),
      w: number(b.w, 698, 4, 794),
      h: number(b.h, 120, 4, 1123),
      title: string(b.title, 300),
      subtitle: string(b.subtitle, 500),
      meta: string(b.meta, 200),
      body: string(b.body),
      variant: ["line", "soft", "minimal"].includes(String(b.variant))
        ? (b.variant as Variant)
        : "line",
      fontSize: number(b.fontSize, 13, 9, 32),
      lineHeight: number(b.lineHeight, 1.75, 1, 2.5),
      align: ["left", "center", "right"].includes(String(b.align))
        ? (b.align as Block["align"])
        : "left",
      color: color(b.color, "#373632"),
      fill:
        b.fill === "transparent" ? "transparent" : color(b.fill, "transparent"),
      radius: number(b.radius, 0, 0, 60),
    };
    if (
      typeof b.image === "string" &&
      b.image.length < 2200000 &&
      /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(b.image)
    )
      result.image = b.image;
    return constrain(result);
  });
  return {
    version: 1,
    name: string(d.name, 100) || "我的简历",
    template: templateInfo.some((t) => t.id === d.template)
      ? String(d.template)
      : "linen",
    accent: color(d.accent, accents[0]),
    font: d.font === "serif" ? "serif" : "sans",
    pages: Math.max(
      Math.floor(number(d.pages, 1, 1, 20)),
      ...blocks.map((b) => b.page + 1),
    ),
    blocks,
  };
}
export function loadResume(): { doc: Resume; recovered: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      doc: raw ? parseResume(JSON.parse(raw)) : initialResume(),
      recovered: false,
    };
  } catch {
    return { doc: initialResume(), recovered: true };
  }
}
