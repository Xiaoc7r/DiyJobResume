import { parseMarkdown, uid } from "./flow";
import type { Line } from "./flow";

// 把「从 Word / 聊天记录里复制来的一大段简历」尽量还原成结构化行。
// 规则只做保守识别，认不出的内容一律当普通正文，不丢字。
// 流程分四段：清洗 → 识别 → 整理 → 复核，每一段都能单独拿来做进度显示。

const SECTION_NAMES = [
  "个人总结",
  "自我评价",
  "个人优势",
  "个人简介",
  "求职意向",
  "项目经历",
  "实习经历",
  "工作经历",
  "校园经历",
  "教育背景",
  "专业技能",
  "技能特长",
  "证书/其他",
  "证书 / 其他",
  "证书",
  "荣誉奖项",
  "获奖情况",
  "其他",
];

const BULLET = /^[·•●○◦▪▫‣⁃∙※+*\-–—]\s*/;
const ORDERED = /^(\d{1,2})\s*[.、)）]\s*/;
const ENTRY_MARK = /^[►▶▸▹➤◆◇■□]\s*/;
const DATE = /(?:19|20)\d{2}\s*[.\-/年]\s*\d{1,2}/;
const CONTACT_HINT = /(@|电话|手机|邮箱|微信|现居|住址|地址|📱|📧)/;
const SEPARATOR_ROW = /^[-—=_~*·•\s]{3,}$/;
const INLINE_SECTION = /^【\s*(.+?)\s*】(.*)$/;
const COLON_SECTION = new RegExp(
  `^(${SECTION_NAMES.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|")})\\s*[：:]\\s*(.*)$`,
);
const END_PUNCT = /[。！？；;.!?：:)\]】」』”"]$/;

const tidy = (value: string) =>
  value.replace(/[\t\u3000]+/g, " ").replace(/ {2,}/g, "  ").trim();

const cellsOf = (value: string) =>
  value
    .split(/\s{2,}|\s*[｜|]\s*/)
    .map((cell) => cell.trim())
    .filter(Boolean);

function entryText(value: string) {
  const cells = cellsOf(value);
  if (!cells.length) return value;
  // 四段以上（学校 / 专业 / 学历 / 时间）合并中间几段，保持「左 | 中 | 右」
  return cells.length >= 4
    ? `${cells[0]} | ${cells.slice(1, -1).join(" ")} | ${cells[cells.length - 1]}`
    : cells.join(" | ");
}

const line = (kind: Line["kind"], text: string, order?: number): Line =>
  order ? { id: uid(), kind, text, order } : { id: uid(), kind, text };

// ① 清洗：去掉空行、分隔线、重复的联系方式，统一空格
export function rowsOf(raw: string): string[] {
  const rows: string[] = [];
  let lastContact = "";
  for (const source of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const row = tidy(source.replace(/^[\s\u3000]+/, ""));
    if (!row || SEPARATOR_ROW.test(row)) continue;
    if (/@|电话|手机/.test(row)) {
      const key = row.replace(/\s/g, "");
      if (key === lastContact) continue;
      lastContact = key;
    }
    rows.push(row);
  }
  return rows;
}

// 「【项目经历】某某项目」这类写在一行里的，拆成标题 + 正文
function expand(rows: string[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const inline = INLINE_SECTION.exec(row);
    if (inline && inline[2].trim()) {
      out.push(`【${inline[1].trim()}】`, inline[2].trim());
      continue;
    }
    const colon = COLON_SECTION.exec(row);
    if (colon) {
      out.push(colon[1]);
      if (colon[2].trim()) out.push(colon[2].trim());
      continue;
    }
    out.push(row);
  }
  return out;
}

// ② 识别：把每一行判成姓名 / 联系方式 / 板块 / 经历 / 要点 / 正文
function toLines(rows: string[]): Line[] {
  const lines: Line[] = [];
  let nameTaken = false,
    contactTaken = false;

  for (const row of rows) {
    const section = /^【\s*(.+?)\s*】$/.exec(row);
    if (section) {
      lines.push(line("section", section[1]));
      continue;
    }

    const ordered = ORDERED.exec(row);
    if (ordered) {
      const text = row.replace(ORDERED, "").trim();
      if (text) lines.push(line("ordered", text, Number(ordered[1])));
      continue;
    }

    if (BULLET.test(row)) {
      const text = row.replace(BULLET, "").trim();
      if (text) lines.push(line("bullet", text));
      continue;
    }

    // 姓名：第一行、没有冒号/分隔符、不含数字，也不是板块名
    if (
      !nameTaken &&
      !lines.length &&
      row.length <= 24 &&
      !/[：:|｜/\d]/.test(row) &&
      !SECTION_NAMES.includes(row)
    ) {
      lines.push(line("name", row));
      nameTaken = true;
      continue;
    }

    // 联系方式：出现在最前面，且带 @ / 电话 / 邮箱 / 现居等关键词
    if (!contactTaken && lines.length <= 2 && CONTACT_HINT.test(row)) {
      lines.push(line("text", row));
      contactTaken = true;
      continue;
    }

    if (SECTION_NAMES.includes(row)) {
      lines.push(line("section", row));
      continue;
    }

    // 带「►」的行不一定是经历行：有日期或两段以上才当经历，
    // 否则它只是用符号代替圆点的要点（很多 Word 稿子就是 ▶ 当项目符号）
    if (ENTRY_MARK.test(row)) {
      const body = row.replace(ENTRY_MARK, "").trim();
      if (body) {
        const isEntry = DATE.test(body) || cellsOf(body).length >= 2;
        lines.push(
          isEntry ? line("entry", entryText(body)) : line("bullet", body),
        );
        continue;
      }
    }

    // 其余带日期的行：学校 / 公司那一行
    if (DATE.test(row)) {
      lines.push(line("entry", entryText(row)));
      continue;
    }

    lines.push(line("text", row));
  }

  return lines;
}

// ③ 整理：复制时被硬断行的要点接回上一行，避免一条要点拆成两行
export function reviewLines(lines: Line[]): Line[] {
  const out: Line[] = [];
  for (const current of lines) {
    const previous = out[out.length - 1];
    if (
      previous &&
      (previous.kind === "bullet" || previous.kind === "ordered") &&
      current.kind === "text" &&
      !DATE.test(current.text) &&
      !END_PUNCT.test(previous.text) &&
      current.text.length <= 120
    ) {
      previous.text += current.text;
      continue;
    }
    out.push(current);
  }
  return out;
}

// ④ 复核：姓名在第一位、联系方式紧跟其后、空板块和重复板块去掉
export function reviewStructure(lines: Line[]): Line[] {
  let body = [...lines];

  // 姓名被埋在后面时，把第一个像姓名的短行提到最前
  if (body[0]?.kind !== "name") {
    const at = body.findIndex(
      (item, index) =>
        index < 3 &&
        item.kind === "text" &&
        item.text.length <= 12 &&
        !/\d|@|[：:|｜/]/.test(item.text),
    );
    if (at > 0) {
      const [found] = body.splice(at, 1);
      body = [{ ...found, kind: "name" }, ...body];
    }
  }

  // 联系方式统一挪到姓名之后
  const contacts = body.filter(
    (item) =>
      item.kind === "text" &&
      /@|电话|手机|邮箱/.test(item.text) &&
      !DATE.test(item.text),
  );
  if (contacts.length) {
    body = body.filter((item) => !contacts.includes(item));
    const heads = body[0]?.kind === "name" ? [body[0]] : [];
    body = [...heads, ...contacts, ...body.slice(heads.length)];
  }

  // 去掉重复的板块标题，以及紧跟下一个标题（没有任何内容）的空板块
  const cleaned: Line[] = [];
  for (let i = 0; i < body.length; i++) {
    const item = body[i];
    if (item.kind === "section") {
      const previous = cleaned[cleaned.length - 1];
      if (previous?.kind === "section" && previous.text === item.text) continue;
      const next = body[i + 1];
      if (!next || next.kind === "section") continue;
    }
    cleaned.push(item);
  }
  return cleaned;
}

const CONTACT_LINE = /@|电话|手机|邮箱|微信|现居|住址|地址/;
const ONLY_DATE = /^[\s\d.年月日\-–—/]+$/;

const joinContact = (left: string, right: string) =>
  `${left.replace(/[｜|\s]+$/, "")} | ${right.replace(/^[｜|\s]+/, "")}`;

// ⑤ 重新排格式（第二遍）：把联系方式并成一行、补全经历行的分栏、
// 把「正文里明显是经历行」的认出来、清掉空要点。只调整结构，不改字。
export function reformat(lines: Line[]): Line[] {
  let contact: Line | null = null;
  const merged: Line[] = [];
  for (const item of lines) {
    const isContact =
      item.kind === "text" &&
      CONTACT_LINE.test(item.text) &&
      !DATE.test(item.text);
    if (isContact) {
      if (!contact) {
        contact = { ...item, text: item.text.replace(/\s*[｜|]\s*/g, " | ") };
        merged.push(contact);
      } else {
        contact.text = joinContact(
          contact.text,
          item.text.replace(/\s*[｜|]\s*/g, " | "),
        );
      }
      continue;
    }
    contact = null;
    merged.push(item);
  }

  const fixed: Line[] = [];
  for (const item of merged) {
    const previous = fixed[fixed.length - 1];
    // 只有日期的行，接到上一条经历行右边，避免多出一行
    if (
      previous?.kind === "entry" &&
      item.kind === "entry" &&
      ONLY_DATE.test(item.text)
    ) {
      previous.text = `${previous.text.replace(/\s*\|\s*$/, "")} | ${item.text.trim()}`;
      continue;
    }
    // 正文里带着日期和两段以上内容的，基本就是经历行
    if (
      item.kind === "text" &&
      DATE.test(item.text) &&
      cellsOf(item.text).length >= 2
    ) {
      fixed.push({ ...item, kind: "entry", text: entryText(item.text) });
      continue;
    }
    if (item.kind === "entry") {
      fixed.push({ ...item, text: entryText(item.text) });
      continue;
    }
    fixed.push(item);
  }

  return fixed
    .filter((item) => item.text.trim() !== "")
    .map((item) => ({
      ...item,
      text: item.text.trim().replace(/\s{2,}/g, " "),
    }));
}

export function textToLines(raw: string): Line[] {
  return reformat(
    reviewStructure(reviewLines(toLines(expand(rowsOf(raw))))),
  );
}

// 分步执行，供界面显示「排版进行到哪一步」
export interface LayoutStage {
  label: string;
  lines: Line[];
}

export function* layoutSteps(raw: string): Generator<LayoutStage> {
  const rows = rowsOf(raw);
  yield { label: `清洗文字（${rows.length} 行）`, lines: [] };

  let lines = toLines(expand(rows));
  yield { label: `识别姓名、联系方式与板块（${lines.length} 行）`, lines };

  lines = reviewLines(lines);
  yield { label: `整理要点与断行（${lines.length} 行）`, lines };

  lines = reviewStructure(lines);
  yield { label: `姓名、联系方式与板块归位（${lines.length} 行）`, lines };

  lines = reformat(lines);
  yield { label: `重新排格式（${lines.length} 行）`, lines };

  yield { label: "按当前模板生成排版", lines };
}

// 判断一段文字是「markdown 写法」还是「从文档里复制来的原始排版」。
// 只看有没有 # 标题：从 Word 复制来的稿子常用 - 或 · 当项目符号，
// 如果按 markdown 解析，姓名和【板块】就会被当成普通正文。
export function looksLikeMarkdown(text: string) {
  return /(^|\n)\s{0,3}#{1,6}\s+\S/.test(text);
}

// 判断用户发来的这一段是不是「整份简历」而不是一句指令。
export function looksLikeResumeBlock(text: string) {
  const rows = text.split("\n").filter((row) => row.trim());
  if (rows.length < 5) return false;
  return /【.+?】/.test(text) || /[►▶]/.test(text) || /(^|\n)\s*[·•]/.test(text);
}

// markdown 写法交给 flow 的解析器（同一套规则，不重复实现）
export function contentToLines(text: string): Line[] {
  return looksLikeMarkdown(text) ? parseMarkdown(text) : textToLines(text);
}
