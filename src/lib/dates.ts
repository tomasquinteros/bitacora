// Días como "YYYY-MM-DD" en hora local (toISOString usaría UTC y corre el día de noche).
export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISO(new Date());
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function startOfWeek(s: string): string {
  const d = fromISO(s);
  return addDays(s, -((d.getDay() + 6) % 7));
}

const long = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
const short = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" });
const range = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

export function formatLong(s: string): string {
  return long.format(fromISO(s));
}

export function formatShort(s: string): string {
  return short.format(fromISO(s)).replace(".", "");
}

export function formatRange(from: string, to: string): string {
  return `${range.format(fromISO(from))} – ${range.format(fromISO(to))}`;
}

export function relativeLabel(s: string): string | null {
  const t = today();
  if (s === t) return "Hoy";
  if (s === addDays(t, -1)) return "Ayer";
  if (s === addDays(t, 1)) return "Mañana";
  return null;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86_400_000);
}

export function ageLabel(from: string, to: string): string {
  const n = daysBetween(from, to);
  if (n <= 0) return "hoy";
  if (n === 1) return "ayer";
  return `hace ${n} días`;
}

// created_at de SQLite: "YYYY-MM-DD HH:MM:SS" en UTC.
export function fromSqlUtc(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

export function noteStamp(s: string): string {
  const d = fromSqlUtc(s);
  const day = toISO(d);
  const rel = relativeLabel(day);
  return `${rel ? rel.toLowerCase() : formatShort(day)} ${time.format(d)}`;
}

export function timeAgo(s: string): string {
  const mins = Math.round((Date.now() - fromSqlUtc(s).getTime()) / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}
