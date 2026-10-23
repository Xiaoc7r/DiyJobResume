import {
  groupEnd,
  kindLabels,
  moveGroupToBoundary,
  templates,
  toMarkdown,
  uid,
} from "./flow";
import type { Kind, Line, Resume, Settings, Template } from "./flow";
import { contentToLines } from "./importText";

export const AGENT_CONFIG_KEY = "diyjobresume.agent.v1";
export const AGENT_TURNS_KEY = "diyjobresume.agent.turns.v1";
// 每份简历各存一份对话，切换简历不会串台
export const turnsKey = (docId: string) => `${AGENT_TURNS_KEY}.${docId}`;
const NOTICE_KEY = "diyjobresume.agent.notice.v1";

export interface AgentConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}
export interface AgentTurn {
  role: "user" | "assistant";
  text: string;
  /** 助手这一轮实际应用的改动，回传给模型当记忆 */
  notes?: string[];
  /** 用户没有接受这一轮方案 */
  rejected?: boolean;
}
export interface AgentReply {
  reply: string;
  actions: AgentAction[];
}
export type AgentAction = { type?: string } & Record<string, unknown>;

const KINDS: Exclude<Kind, "blank">[] = [
  "name",
  "section",
  "entry",
  "text",
  "bullet",
  "ordered",
  "h4",
  "h5",
  "h6",
];
const FONT_KEYS: Settings["font"][] = ["sans", "serif", "nunito"];
const TEMPLATE_IDS = templates.map((t) => t.id);

export const defaultAgentConfig = (): AgentConfig => ({
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "",
});

export function loadAgentConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(AGENT_CONFIG_KEY);
    if (!raw) return defaultAgentConfig();
    const saved = JSON.parse(raw) as Partial<AgentConfig>;
    return {
      baseUrl: String(saved.baseUrl || defaultAgentConfig().baseUrl),
      model: String(saved.model || defaultAgentConfig().model),
      apiKey: String(saved.apiKey || ""),
    };
  } catch {
    return defaultAgentConfig();
  }
}
export function saveAgentConfig(config: AgentConfig) {
  localStorage.setItem(AGENT_CONFIG_KEY, JSON.stringify(config));
}
export function noticeAccepted() {
  return localStorage.getItem(NOTICE_KEY) === "1";
}
export function acceptNotice() {
  localStorage.setItem(NOTICE_KEY, "1");
}

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n)
    ? Math.min(max, Math.max(min, Math.round(n * 100) / 100))
    : fallback;
};
// 行号必须严格落在范围内：不要把 0 / 超界的值“夹”进来，否则会误删第一行
const lineNo = (v: unknown, max: number, allowZero = false) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= (allowZero ? 0 : 1) && n <= max ? n : -1;
};
const hexColor = (v: unknown) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "";

// 给模型看的当前排版摘要：只放排版参数和板块结构，不放正文，省 token 也少泄露
export function describeDoc(
  doc: Resume,
  pageCount = 1,
  includeContent = false,
) {
  const s = doc.settings,
    types = KINDS.map((k) => {
      const t = s.types[k];
      return `${k} ${t.size}px(${t.before}/${t.after})`;
    }).join("，");
  const sections: string[] = [];
  let index = 0;
  for (let i = 0; i < doc.lines.length; i = groupEnd(doc.lines, i)) {
    const line = doc.lines[i];
    if (line.kind !== "section") continue;
    index++;
    sections.push(
      `${index}. ${line.text}（${groupEnd(doc.lines, i) - i - 1} 行内容）`,
    );
  }
  const head = [
    `模板：${doc.template}（${templates.find((t) => t.id === doc.template)?.name || ""}）`,
    `字体：${s.font}；行高：${s.lineHeight}；表头：${s.headerAlign}`,
    `页边距 上${s.top}/下${s.bottom}/左${s.left}/右${s.right}px`,
    `主题色：${s.accent}；正文色：${s.color}`,
    `字号(段前/段后)：${types}`,
    `板块顺序：${sections.join(" / ") || "（没有板块标题）"}`,
    `总行数：${doc.lines.length}；当前页数：${pageCount}`,
  ];
  if (includeContent)
    head.push(
      "",
      "正文（数字是行号，含 markdown 标记）：",
      ...doc.lines.map((line, index) => `${index + 1}: ${toMarkdown([line])}`),
    );
  return head.join("\n");
}

export const AGENT_CONTENT_PROMPT = `
你还被允许修改文字内容（仅在用户明确要求改写、补充、删除、调整顺序时使用，不要自作主张）：
12 {"type":"setText","line":4,"text":"新的这一行文字"} 改写第 4 行（保留原来的行类型，不要带 markdown 标记里的行前缀）
13 {"type":"setKind","line":4,"kind":"text|bullet|section|entry|h4|h5|h6|ordered"} 改这一行的类型
14 {"type":"insert","after":4,"kind":"bullet","text":"新的要点"} 在第 4 行后面插入一行（after 用 0 表示插到最前面）
15 {"type":"remove","line":4} 删除第 4 行
16 {"type":"replace","find":"原文片段","replace":"新片段"} 全文替换（谨慎使用）
17 {"type":"setContent","text":"# 姓名\n手机 | 邮箱\n## 板块\n### 标题 | 角色 | 时间\n- 要点"} 整份重排：用一条动作把整篇内容替换掉

内容编辑规则：
- 行号以「正文」列表里每行前面的数字为准，一次最多动 8 行；不要整篇重写，除非用户明确要求。
- 只能润色、精简、补全用户已经给出的信息，绝不能编造学历、公司、时间、数字、奖项；缺少的信息用「待补充」占位。
- 经历行的格式是「左侧 | 中间 | 右侧」，用 " | " 分隔，删除或改写时保持这个结构。
- 保持中文表达自然、简短，每条要点不超过 60 字。
- 用户一次性发来一整份简历（开头是姓名、接着联系方式，再用【板块】或多个小标题分段，经历行带公司/角色/时间，条目以 · • - 开头）时，用**一个** setContent 动作把全文整理成结构化文本，不要逐行 setText/insert：
  · 第一行写成 "# 姓名"；
  · 联系方式那一两行原样保留为普通行（不要画蛇添足加标签）；
  · "【个人总结】"这类标题改成 "## 个人总结"；没有方括号但本身就是板块名的（教育背景 / 实习经历 / 项目经历 / 专业技能 / 证书 等）也改成 "## xx"；
  · "► 公司  职位  2026.05 – 2026.09" 改成 "### 公司 | 职位 | 2026.05 – 2026.09"；"学校  专业  学历  时间" 同样合并成 "### 学校 | 专业 学历 | 时间"；
  · 以 · • ● - 或数字编号开头的条目改成 "- 要点"；数字编号保留成 "1. "；
  · 其余内容原样作为普通行；空行丢掉。
  · 公司名、学校名、专业、日期、数字、证书名称一律照抄，不润色、不合并、不编造；用户明确说“顺便改一下措辞”才动文字。
`;

export const AGENT_SYSTEM_PROMPT = `你是简历助手。用户会用中文描述需求；默认只调整「样式与结构」，不改动用户写下的文字，只有用户明确要求改写内容时才动文字。

只输出一个 JSON 对象，不要输出别的文字、不要用 markdown 代码块：
{"reply":"一句中文说明你做了什么","actions":[动作对象...]}

可用动作（actions 是数组，按顺序执行）：
1 {"type":"template","template":"blue|black|ribbon|academic|teal|violet"} 换模板
2 {"type":"font","font":"sans|serif|nunito"} 换字体
3 {"type":"fontSize","kind":"name|section|entry|text|bullet|ordered|h4|h5|h6|all","size":10到32的数字} 字号
4 {"type":"lineHeight","value":1.15到2.2} 行高
5 {"type":"spacing","kind":"同上","before":0到24,"after":0到24} 段前段后（px）
6 {"type":"margins","top":12到120,"bottom":12到120,"left":12到120,"right":12到120} 页边距（px）
7 {"type":"accent","color":"#rrggbb"} 主题色；{"type":"ink","color":"#rrggbb"} 正文色
8 {"type":"headerAlign","value":"left|center"} 表头对齐
9 {"type":"compact"} 一键紧凑：字号各减、行高 1.35、段距收紧
10 {"type":"moveSection","section":"板块标题原文","to":从1开始的目标位置} 调整板块顺序
11 {"type":"removeEmptyLines"} 删除空行

规则：
- 内容已经很长或页数偏多时，优先用 compact、缩小字号、收紧段距、减少页边距。
- 用户说“学术/简洁/商务/标签风”之类的感觉时，挑最接近的模板并说明选择理由。
- 一次最多给 6 个动作，不要重复堆叠同一种动作。
- 只要用户的要求能用上面的动作实现，就必须在 actions 里给出动作，不能只在 reply 里描述。
- 你可以看到这段对话的历史，用户说“再紧一点”“刚才那个模板”“回到之前那样”时，按历史里已经应用过的改动为基准继续调整。
- 如果请求和这份简历完全无关（闲聊、写代码等），actions 返回空数组，并在 reply 里说明你只处理这份简历。`;

function turnSuffix(turn: AgentTurn) {
  if (turn.role !== "assistant") return "";
  if (turn.rejected) return "\n（这一版方案用户没有接受，简历保持原样）";
  if (turn.notes?.length)
    return "\n（这一版实际应用到简历的改动：" + turn.notes.join("；") + "）";
  return "";
}

// 把历史对话整理成 messages：整段历史都给模型（不按条数或字符截断），
// 助手的每一轮会带上“实际改了什么”，模型才知道前后文到底发生了什么。
export function buildAgentMessages(
  system: string,
  turns: AgentTurn[],
  input: string,
) {
  const picked = [...turns];
  // 历史必须以 user 开头，避免出现没有对应问题的 assistant
  while (picked.length && picked[0].role === "assistant") picked.shift();
  return [
    { role: "system", content: system },
    ...picked.map((turn) => ({
      role: turn.role,
      content: turn.text + turnSuffix(turn),
    })),
    { role: "user", content: input },
  ];
}

// 供系统提示用的“这次会话已经做过的改动”，超出对话窗口也能记住
export function changesDigest(turns: AgentTurn[]) {
  const out: string[] = [];
  for (const turn of turns) {
    if (turn.role !== "assistant") continue;
    if (turn.notes?.length) out.push(turn.notes.join("、"));
    else if (turn.rejected) out.push("（有一版方案被拒绝，简历未改）");
  }
  return out;
}

export const AGENT_REVIEW_PROMPT = `你现在的任务是给一份「已经初排好」的简历调整格式。
可以动的：
- 行类型：setKind（把该是要点的行改成 bullet、该是经历行的改成 entry、该是板块标题的改成 section）
- 板块顺序：moveSection
- 整体版式：template、font、fontSize、lineHeight、spacing、margins、accent、headerAlign、compact
- 清理空行：removeEmptyLines
- 整篇重排：setContent（局部改动理不顺时，用它一次性重写整篇结构；
  必须保留原文全部信息，不许丢句、丢要点、编造内容）

文字以「不改」为默认；用户在对话里明确要求改写、精简、补写时才可以动字，
动字必须保持原意、不许编造公司/学校/时间/数字，并且只能在确实需要时小范围修改。

用户没有特别说明时，优先保证这几件事：
1) 姓名在第一行，联系方式紧跟其后；
2) 每个板块下面有内容，条目一律是 bullet；
3) 经历行是「左侧 | 中间 | 右侧」三栏（公司/学校 | 职位/专业 | 时间）。
只输出一个 JSON 对象，格式与平时一致。`;

// AI 复核只允许这些动作：改类型、调版式、删空行，绝不碰文字内容
const REVIEW_ACTIONS = new Set([
  "setKind",
  "setText",
  "insert",
  "remove",
  "replace",
  "setContent",
  "moveSection",
  "template",
  "font",
  "fontSize",
  "lineHeight",
  "spacing",
  "margins",
  "accent",
  "ink",
  "headerAlign",
  "compact",
  "removeEmptyLines",
]);

export function isReviewAction(type: string) {
  return REVIEW_ACTIONS.has(type);
}

// 和对话里「帮我把格式调好」走同一套动作协议，只是把权限收紧到不改字
export async function reviewLayout(
  config: AgentConfig,
  draft: Resume,
  original: string,
  signal?: AbortSignal,
): Promise<AgentReply> {
  const system =
    AGENT_SYSTEM_PROMPT +
    AGENT_CONTENT_PROMPT +
    "\n\n" +
    AGENT_REVIEW_PROMPT +
    "\n\n当前简历参数与正文：\n" +
    describeDoc(draft, 1, true);
  return requestAgent(
    config,
    system,
    [],
    `下面是我粘贴的原始简历。请只调整格式与结构，不要改字：\n<<<\n${original.slice(0, 120000)}\n>>>`,
    signal,
  );
}

// 校验 AI 复核有没有偷偷改字：只比较正文内容，忽略空白和结构符号
export function stripStructure(markdown: string) {
  return markdown
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[\s|｜·•]/g, "");
}

// 单次请求的上下文预算（粗略按 token 计）。超过就把早前的对话压成摘要。
export const AGENT_CONTEXT_LIMIT = 300_000;
// 摘要时至少保留最近这么多条原文，避免刚说过的内容被压掉
const KEEP_RECENT_TURNS = 12;
const SUMMARY_BATCH = 10;

// 中文按 1 字 1 token 估，其它字符按 3.5 字 1 token 估，偏保守
export function estimateTokens(text: string) {
  let wide = 0,
    narrow = 0;
  for (const char of text) {
    if ((char.codePointAt(0) || 0) >= 0x2e80) wide++;
    else narrow++;
  }
  return Math.ceil(wide + narrow / 3.5);
}

export const AGENT_SUMMARY_PROMPT = `你在压缩一段「简历编辑对话」，供后续继续对话时参考。
把「已有摘要」和「新增对话」合并成一段不超过 400 字的中文摘要，必须保留：
1) 用户提过的要求、偏好和禁止事项；
2) 已经应用的改动、被拒绝或被忽略的改动；
3) 还没解决的问题。
不要编造，不要写寒暄。只输出摘要正文。`;

async function summarizeTurns(
  config: AgentConfig,
  previous: string,
  batch: AgentTurn[],
  signal?: AbortSignal,
) {
  const url = config.baseUrl.trim().replace(/\/+$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: config.model.trim(),
      temperature: 0,
      messages: [
        { role: "system", content: AGENT_SUMMARY_PROMPT },
        {
          role: "user",
          content: `已有摘要：\n${previous || "（无）"}\n\n新增对话：\n${batch
            .map((turn) =>
              `${turn.role === "user" ? "用户" : "助手"}：${turn.text}${
                turn.notes?.length ? `（改动：${turn.notes.join("；")}）` : ""
              }`,
            )
            .join("\n")}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`摘要接口返回 ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content || "").trim();
}

export interface AgentSummary {
  text: string;
  count: number;
}

// 超出预算时，把最早的对话分批摘要，留一个可续用的摘要 + 最近若干条原文
export async function compactHistory(
  config: AgentConfig,
  system: string,
  input: string,
  turns: AgentTurn[],
  summary: AgentSummary,
  signal?: AbortSignal,
  budget = AGENT_CONTEXT_LIMIT,
) {
  let text = summary.text,
    count = Math.max(0, Math.min(summary.count, turns.length));
  const size = () =>
    estimateTokens(system) +
    estimateTokens(input) +
    estimateTokens(text) +
    estimateTokens(
      turns
        .slice(count)
        .map((turn) => turn.text + (turn.notes?.join("") || ""))
        .join(""),
    );
  let compacted = false;
  while (size() > budget && turns.length - count > KEEP_RECENT_TURNS) {
    const next = Math.min(turns.length - KEEP_RECENT_TURNS, count + SUMMARY_BATCH);
    text = await summarizeTurns(config, text, turns.slice(count, next), signal);
    count = next;
    compacted = true;
  }
  return { summary: { text, count }, compacted };
}

export async function requestAgent(
  config: AgentConfig,
  system: string,
  turns: AgentTurn[],
  input: string,
  signal?: AbortSignal,
): Promise<AgentReply> {
  const url = config.baseUrl.trim().replace(/\/+$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: config.model.trim(),
      temperature: 0.2,
      messages: buildAgentMessages(system, turns, input),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `接口返回 ${res.status}${detail ? "：" + detail.slice(0, 160) : ""}`,
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content || "";
  return parseAgentReply(text);
}

export function parseAgentReply(text: string): AgentReply {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{"),
    end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { reply: cleaned.slice(0, 500) || "（没有返回内容）", actions: [] };
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      reply?: unknown;
      actions?: unknown;
    };
    const actions = Array.isArray(parsed.actions)
      ? (parsed.actions.filter(
          (a) => a && typeof a === "object",
        ) as AgentAction[])
      : [];
    return {
      reply: String(parsed.reply || "已完成调整。"),
      actions: actions.slice(0, 12),
    };
  } catch {
    return { reply: cleaned.slice(0, 500), actions: [] };
  }
}

const withSettings = (doc: Resume, patch: Partial<Settings>): Resume => ({
  ...doc,
  settings: { ...doc.settings, ...patch },
});
const withType = (
  doc: Resume,
  kinds: Exclude<Kind, "blank">[],
  patch: Partial<Settings["types"]["text"]>,
): Resume => {
  const types = { ...doc.settings.types };
  for (const kind of kinds)
    types[kind] = { ...types[kind], ...patch } as Settings["types"][typeof kind];
  return withSettings(doc, { types });
};
const pickKinds = (value: unknown): Exclude<Kind, "blank">[] => {
  const text = String(value ?? "all").toLowerCase();
  if (text === "all" || text === "全部" || text === "") return KINDS;
  return KINDS.filter((k) => k === text);
};
export function sectionTitles(doc: Resume) {
  return doc.lines.filter((l) => l.kind === "section").map((l) => l.text.trim());
}

// 执行一组动作，返回新文档 + 给用户看的中文说明
export function applyAgentActions(
  doc: Resume,
  actions: AgentAction[],
): { doc: Resume; notes: string[]; skipped: string[] } {
  let next = doc;
  const notes: string[] = [],
    skipped: string[] = [];
  for (const action of actions) {
    const type = String(action.type || "");
    if (type === "template") {
      const id = String(action.template || "") as Template;
      if (!TEMPLATE_IDS.includes(id)) {
        skipped.push(`不认识的模板「${id}」`);
        continue;
      }
      next = {
        ...next,
        template: id,
        settings: {
          ...next.settings,
          accent: templates.find((t) => t.id === id)!.color,
        },
      };
      notes.push(`切换模板为「${templates.find((t) => t.id === id)!.name}」`);
    } else if (type === "font") {
      const font = String(action.font || "") as Settings["font"];
      if (!FONT_KEYS.includes(font)) {
        skipped.push("不认识的字体");
        continue;
      }
      next = withSettings(next, { font });
      notes.push(`字体改为 ${font === "sans" ? "黑体" : font === "serif" ? "宋体" : "Nunito"}`);
    } else if (type === "fontSize") {
      const kinds = pickKinds(action.kind);
      const size = num(action.size, 10, 32, 0);
      if (!kinds.length || !size) {
        skipped.push("字号值不合法");
        continue;
      }
      next = withType(next, kinds, { size });
      notes.push(
        `${kinds.length === KINDS.length ? "全部文字" : kinds.join("/")} 字号改为 ${size}px`,
      );
    } else if (type === "lineHeight") {
      const value = num(action.value, 1.15, 2.2, 0);
      if (!value) {
        skipped.push("行高值不合法");
        continue;
      }
      next = withSettings(next, { lineHeight: value });
      notes.push(`行高改为 ${value}`);
    } else if (type === "spacing") {
      const kinds = pickKinds(action.kind);
      const patch: { before?: number; after?: number } = {};
      if (action.before !== undefined)
        patch.before = num(action.before, 0, 24, 0);
      if (action.after !== undefined) patch.after = num(action.after, 0, 24, 0);
      if (!kinds.length || !Object.keys(patch).length) {
        skipped.push("段距参数不完整");
        continue;
      }
      next = withType(next, kinds, patch);
      notes.push(
        `${kinds.length === KINDS.length ? "所有段落" : kinds.join("/")} 段距改为${
          patch.before !== undefined ? ` 前${patch.before}px` : ""
        }${patch.after !== undefined ? ` 后${patch.after}px` : ""}`,
      );
    } else if (type === "margins") {
      const s = next.settings,
        patch: Partial<Settings> = {};
      if (action.top !== undefined) patch.top = num(action.top, 12, 120, s.top);
      if (action.bottom !== undefined)
        patch.bottom = num(action.bottom, 12, 120, s.bottom);
      if (action.left !== undefined) patch.left = num(action.left, 12, 120, s.left);
      if (action.right !== undefined)
        patch.right = num(action.right, 12, 120, s.right);
      if (!Object.keys(patch).length) {
        skipped.push("页边距参数不完整");
        continue;
      }
      next = withSettings(next, patch);
      notes.push(
        `页边距 上${next.settings.top}/下${next.settings.bottom}/左${next.settings.left}/右${next.settings.right}`,
      );
    } else if (type === "accent" || type === "ink") {
      const color = hexColor(action.color);
      if (!color) {
        skipped.push("颜色格式不对（要 #rrggbb）");
        continue;
      }
      next = withSettings(next, type === "accent" ? { accent: color } : { color });
      notes.push(`${type === "accent" ? "主题色" : "正文色"}改为 ${color}`);
    } else if (type === "headerAlign") {
      const value = action.value === "left" ? "left" : "center";
      next = withSettings(next, { headerAlign: value });
      notes.push(`表头${value === "left" ? "左对齐" : "居中"}`);
    } else if (type === "compact") {
      const types = { ...next.settings.types };
      for (const kind of KINDS)
        types[kind] = {
          ...types[kind],
          size: Math.max(10, types[kind].size - 1),
          before: Math.max(0, types[kind].before - 1),
          after: Math.max(0, types[kind].after - 1),
        };
      next = withSettings(next, { types, lineHeight: 1.35 });
      notes.push("一键紧凑：字号与段距各减 1，行高 1.35");
    } else if (type === "moveSection") {
      const wanted = String(action.section || "").trim();
      const lines = next.lines,
        at = lines.findIndex(
          (l) =>
            l.kind === "section" &&
            (l.text.trim() === wanted || l.text.includes(wanted)),
        );
      if (at < 0) {
        skipped.push(`没找到板块「${wanted}」`);
        continue;
      }
      const order = next.lines
        .map((l, i) => (l.kind === "section" ? i : -1))
        .filter((i) => i >= 0);
      const position = Math.round(num(action.to, 1, order.length, 0));
      if (!position) {
        skipped.push("目标位置不合法");
        continue;
      }
      const boundary =
        position <= 1
          ? order[0]
          : position > order.length
            ? lines.length
            : order[position - 1];
      const moved = moveGroupToBoundary(next, lines[at].id, boundary);
      if (moved === next) {
        skipped.push(`「${wanted}」已经在这个位置`);
        continue;
      }
      next = moved;
      notes.push(`把「${wanted}」排到第 ${position} 位`);
    } else if (type === "removeEmptyLines") {
      const lines = next.lines.filter((l) => l.kind !== "blank"),
        removed = next.lines.length - lines.length;
      if (!removed) {
        skipped.push("没有空行可删");
        continue;
      }
      next = { ...next, lines };
      notes.push(`删掉 ${removed} 个空行`);
    } else if (type === "setText") {
      const at = lineNo(action.line, next.lines.length);
      const text = typeof action.text === "string" ? action.text.slice(0, 2000) : "";
      if (at < 0) {
        skipped.push(`行号 ${String(action.line)} 不存在`);
        continue;
      }
      next = {
        ...next,
        lines: next.lines.map((line, i) => (i === at - 1 ? { ...line, text } : line)),
      };
      notes.push(`改写第 ${at} 行`);
    } else if (type === "setKind") {
      const at = lineNo(action.line, next.lines.length),
        kind = String(action.kind || "") as Kind;
      const allowed: Kind[] = [...KINDS, "blank"];
      if (at < 0 || !allowed.includes(kind)) {
        skipped.push(`第 ${at} 行的类型改不了`);
        continue;
      }
      next = {
        ...next,
        lines: next.lines.map((line, i) =>
          i === at - 1 ? { ...line, kind, ...(kind !== "ordered" ? {} : { order: 1 }) } : line,
        ),
      };
      notes.push(`第 ${at} 行改成 ${kindLabels[kind]}`);
    } else if (type === "insert") {
      const after = lineNo(action.after, next.lines.length, true),
        kind = String(action.kind || "text") as Kind,
        text = typeof action.text === "string" ? action.text.slice(0, 2000) : "";
      if (after < 0) {
        skipped.push("插入位置不合法");
        continue;
      }
      const line: Line = { id: uid(), kind, text };
      const lines = [...next.lines];
      lines.splice(after, 0, line);
      next = { ...next, lines };
      notes.push(
        after === 0
          ? `在最前面插入一行${kindLabels[kind]}`
          : `在第 ${after} 行后插入一行${kindLabels[kind]}`,
      );
    } else if (type === "remove") {
      const at = lineNo(action.line, next.lines.length);
      if (at < 0) {
        skipped.push(`行号 ${String(action.line)} 不存在`);
        continue;
      }
      next = { ...next, lines: next.lines.filter((_, i) => i !== at - 1) };
      notes.push(`删除第 ${at} 行`);
    } else if (type === "replace") {
      const find = typeof action.find === "string" ? action.find : "",
        to = typeof action.replace === "string" ? action.replace.slice(0, 2000) : "";
      if (!find) {
        skipped.push("替换缺少原文");
        continue;
      }
      let count = 0;
      next = {
        ...next,
        lines: next.lines.map((line) => {
          if (!line.text.includes(find)) return line;
          count += line.text.split(find).length - 1;
          return { ...line, text: line.text.split(find).join(to) };
        }),
      };
      if (!count) skipped.push(`没找到「${find}」`);
      else notes.push(`替换「${find}」共 ${count} 处`);
    } else if (type === "setContent") {
      const text =
          typeof action.text === "string" ? action.text.slice(0, 150000) : "",
        lines = text.trim() ? contentToLines(text) : [];
      if (!lines.length) {
        skipped.push("整篇内容为空或读不出来");
        continue;
      }
      next = { ...next, lines };
      notes.push(`整篇重排（${lines.length} 行）`);
    } else {
      skipped.push(`不支持的动作「${type}」`);
    }
  }
  return { doc: next, notes, skipped };
}
