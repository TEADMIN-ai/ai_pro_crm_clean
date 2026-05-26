export type EscalationLevel =
  | "RESOLVED"
  | "NORMAL"
  | "WARNING"
  | "CRITICAL_ESCALATED";

export function getEscalationLevel(createdAt: string | Date, resolved: boolean): EscalationLevel {
  if (resolved) return "RESOLVED";

  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - created) / (1000 * 60);

  if (diffMinutes > 120) return "CRITICAL_ESCALATED";
  if (diffMinutes > 30) return "WARNING";
  return "NORMAL";
}
