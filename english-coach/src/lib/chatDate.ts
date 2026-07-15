// Day-separator helpers shared by the AI chat screens (conversar, roleplay),
// mirroring the "Hoje" / "Ontem" / date logic already used in direct messages
// between users (app/mensagens/[userId]/page.tsx).

export function parseChatDate(dateStr: string): Date {
  let s = dateStr.replace(" ", "T");
  if (!s.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";
  s = s.replace(/\+00:00$/, "Z").replace(/\+00$/, "Z").replace(/\+0000$/, "Z");
  return new Date(s);
}

export function getBrasiliaDay(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parseChatDate(dateStr));
}

export function getDayLabel(dateStr: string): string {
  const now = new Date();
  const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const today = fmt(now);
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const yesterday = fmt(yest);
  const day = getBrasiliaDay(dateStr);
  if (day === today) return "Hoje";
  if (day === yesterday) return "Ontem";
  return day;
}

// Backfills a `createdAt` timestamp onto any message that doesn't have one
// yet (e.g. conversation history saved before this field existed), so day
// grouping never breaks on older, un-timestamped data.
export function ensureTimestamps<T extends { createdAt?: string }>(
  msgs: T[],
  fallbackIso: string = new Date().toISOString()
): T[] {
  return msgs.map((m) => (m.createdAt ? m : { ...m, createdAt: fallbackIso }));
}
