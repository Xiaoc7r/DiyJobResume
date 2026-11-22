export interface AgentTurn {
  role: "user" | "assistant";
  text: string;
  /** Applied changes included in the next conversation turn. */
  notes?: string[];
  rejected?: boolean;
}

export interface AgentSummary {
  text: string;
  count: number;
}

export const AGENT_TURNS_KEY = "diyjobresume.agent.turns.v1";
// 每份简历各存一份对话，切换简历不会串台
export const turnsKey = (docId: string) => `${AGENT_TURNS_KEY}.${docId}`;
export const summaryKey = (docId: string) =>
  `diyjobresume.agent.summary.v1.${docId}`;

export function loadSummary(docId: string): AgentSummary {
  try {
    const raw = localStorage.getItem(summaryKey(docId));
    if (!raw) return { text: "", count: 0 };
    const saved = JSON.parse(raw) as Partial<AgentSummary>;
    return {
      text: typeof saved.text === "string" ? saved.text : "",
      count: Number(saved.count) || 0,
    };
  } catch {
    return { text: "", count: 0 };
  }
}

export function loadTurns(docId: string): AgentTurn[] {
  try {
    const raw = localStorage.getItem(turnsKey(docId));
    if (!raw) return [];
    const list = JSON.parse(raw) as AgentTurn[];
    return Array.isArray(list)
      ? list
          .filter(
            (t) =>
              t &&
              (t.role === "user" || t.role === "assistant") &&
              typeof t.text === "string",
          )
          .map((t) => ({
            role: t.role,
            text: t.text,
            notes: Array.isArray(t.notes)
              ? t.notes.filter((n) => typeof n === "string")
              : undefined,
            rejected: t.rejected === true || undefined,
          }))
      : [];
  } catch {
    return [];
  }
}
