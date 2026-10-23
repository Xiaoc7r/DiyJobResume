import {
  OLD_KEY,
  STORAGE_KEY,
  initialResume,
  parseMarkdown,
  readResume,
  uid,
} from "./flow";
import type { Resume, Template } from "./flow";
import { AGENT_TURNS_KEY, turnsKey } from "./agent";

// 多份简历存在同一个键里：避免每份简历各占一个 localStorage 键，
// 也方便一次性读写、避免切换时漏存。
export const DOCS_KEY = "diyjobresume.docs.v1";
export const RECOVERY_KEY = "diyjobresume.docs.recovery";

export interface DocEntry {
  id: string;
  name: string;
  updatedAt: number;
  doc: Resume;
}
export interface DocLibrary {
  activeId: string;
  items: DocEntry[];
}

const now = () => Date.now();

export function makeEntry(doc: Resume, name = doc.name): DocEntry {
  return { id: uid(), name, updatedAt: now(), doc };
}

export function blankResume(template: Template, name: string): Resume {
  const doc = initialResume(template);
  return {
    ...doc,
    name,
    // 只留姓名和联系方式，方便直接开始写
    lines: parseMarkdown("# 姓名\n手机 | 邮箱\n## 教育背景\n## 实习经历"),
  };
}

export function cloneResume(doc: Resume, name: string): Resume {
  const copy = JSON.parse(JSON.stringify(doc)) as Resume;
  return { ...copy, name };
}

export function uniqueName(taken: string[], base: string) {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

function normalizeEntry(raw: unknown): DocEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<DocEntry>;
  if (!item.doc) return null;
  try {
    const doc = readResume(item.doc);
    return {
      id: String(item.id || uid()),
      name: String(item.name || doc.name || "未命名简历").slice(0, 60),
      updatedAt: Number(item.updatedAt) || now(),
      doc,
    };
  } catch {
    return null;
  }
}

type RawTurn = {
  role?: unknown;
  text?: unknown;
  notes?: unknown;
  rejected?: unknown;
};

function parseTurns(raw: string): RawTurn[] | null {
  try {
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? (list as RawTurn[]) : null;
  } catch {
    return null;
  }
}

// 只比较“对话内容”，忽略键顺序和空字段
const turnSig = (turn: RawTurn) =>
  JSON.stringify({
    role: turn.role,
    text: turn.text,
    notes: turn.notes ?? null,
    rejected: turn.rejected ?? null,
  });

// 判断 stored 是否以 legacy 开头；是的话返回多出来的部分（可能为空）
function stripLegacy(stored: RawTurn[], legacy: RawTurn[]) {
  if (stored.length < legacy.length) return null;
  for (let i = 0; i < legacy.length; i++)
    if (turnSig(stored[i]) !== turnSig(legacy[i])) return null;
  return stored.slice(legacy.length);
}

// 早期只有一条「公共」对话记录，而且会被读到就复制到当前简历里。
// 这里把旧对话交给最早的那份简历，并清掉其它简历里一模一样的副本，
// 免得新建的简历一打开助手就带着别人的对话。
function settleLegacyTurns(items: DocEntry[]) {
  try {
    const legacyRaw = localStorage.getItem(AGENT_TURNS_KEY),
      legacy = legacyRaw ? parseTurns(legacyRaw) : null;
    if (!legacyRaw || !legacy?.length || !items.length) return;
    const oldest = [...items].sort((a, b) => a.updatedAt - b.updatedAt)[0];
    for (const item of items) {
      if (item.id === oldest.id) continue;
      const key = turnsKey(item.id),
        storedRaw = localStorage.getItem(key),
        stored = storedRaw ? parseTurns(storedRaw) : null;
      if (!stored) continue;
      const rest = stripLegacy(stored, legacy);
      // 这份简历的对话就是旧对话的副本（可能后面又聊了几句）
      if (rest === null) continue;
      if (rest.length) localStorage.setItem(key, JSON.stringify(rest));
      else localStorage.removeItem(key);
    }
    const oldestKey = turnsKey(oldest.id);
    if (!localStorage.getItem(oldestKey))
      localStorage.setItem(oldestKey, legacyRaw);
    localStorage.removeItem(AGENT_TURNS_KEY);
  } catch {
    /* 只是收拾旧数据，失败不影响使用 */
  }
}

function write(library: DocLibrary) {
  const raw = localStorage.getItem(DOCS_KEY);
  if (raw) {
    let damaged = false;
    try {
      const parsed = JSON.parse(raw);
      damaged =
        !Array.isArray(parsed.items) ||
        !parsed.items.length ||
        parsed.items.some((item: unknown) => !normalizeEntry(item));
    } catch {
      damaged = true;
    }
    if (damaged) {
      // Never replace a damaged library unless its original bytes are safely backed up.
      const key = localStorage.getItem(RECOVERY_KEY)
        ? `${RECOVERY_KEY}.${uid()}`
        : RECOVERY_KEY;
      localStorage.setItem(key, raw);
    }
  }
  localStorage.setItem(DOCS_KEY, JSON.stringify(library));
}

// 读取简历列表；老版本只有单份文档，这里自动装进列表，用户不会丢稿。
export function loadLibrary(): { library: DocLibrary; notice: string } {
  let damaged = false;
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DocLibrary>;
      const items = Array.isArray(parsed.items)
        ? parsed.items.map(normalizeEntry).filter((x): x is DocEntry => !!x)
        : [];
      if (items.length) {
        const activeId = items.some((i) => i.id === parsed.activeId)
          ? String(parsed.activeId)
          : items[0].id;
        settleLegacyTurns(items);
        return {
          library: { activeId, items },
          notice:
            items.length === parsed.items?.length
              ? ""
              : "部分草稿无法读取，原始列表将在保存前备份保留。",
        };
      }
      damaged = true;
    }
  } catch {
    damaged = true;
    /* 损坏就尝试从旧键恢复，下面统一处理 */
  }
  let doc: Resume | null = null,
    notice = damaged
      ? "简历列表无法读取，原始数据仍保留；恢复旧稿或下载备份后再继续。"
      : "";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) doc = readResume(JSON.parse(saved));
    else {
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        doc = readResume(JSON.parse(old));
        notice = "已迁移旧版文字与图片，原草稿仍保留。旧版自由色块不转入正文。";
      }
    }
  } catch {
    notice = "草稿读取失败，原始数据仍保留。请先导出旧稿或导入备份。";
  }
  const first = makeEntry(doc || initialResume());
  const library = { activeId: first.id, items: [first] };
  if (!damaged) {
    try {
      write(library);
    } catch {
      notice = "无法保存到本机，请下载备份；刷新前不要关闭页面。";
    }
  }
  settleLegacyTurns(library.items);
  return { library, notice };
}

export function saveLibrary(library: DocLibrary) {
  write(library);
}
