import type { Repeat } from "./model";

// Due dates are plain local calendar dates ("2026-11-23"), never timestamps.

const pad = (n: number) => String(n).padStart(2, "0");

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISODate(new Date());

export function addDays(s: string, n: number) {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

const daysBetween = (a: string, b: string) => Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 864e5);

/** Same day-of-month `months` later, clamped to the month's last day (31 Jan + 1 month = 28 Feb). */
function addMonthsClamped(s: string, months: number) {
  const d = parseISODate(s);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toISODate(target);
}

/** The first occurrence after both `from` and `today`. */
export function nextDue(from: string, repeat: Repeat, today: string) {
  for (let k = 1; ; k++) {
    const next =
      repeat === "daily" ? addDays(from, k)
      : repeat === "weekly" ? addDays(from, 7 * k)
      : repeat === "monthly" ? addMonthsClamped(from, k)
      : addMonthsClamped(from, 12 * k);
    if (next > today) return next;
  }
}

export type DueTone = "overdue" | "today" | "soon" | "later" | "none";

export function dueLabel(due: string | null, today: string): { label: string; tone: DueTone } {
  if (!due) return { label: "No date", tone: "none" };
  const diff = daysBetween(today, due);
  if (diff < 0) return { label: diff === -1 ? "Yesterday" : `${-diff}d overdue`, tone: "overdue" };
  if (diff === 0) return { label: "Today", tone: "today" };
  if (diff === 1) return { label: "Tomorrow", tone: "soon" };
  const d = parseISODate(due);
  if (diff < 7) return { label: d.toLocaleDateString("en-GB", { weekday: "short" }), tone: "soon" };
  const sameYear = due.slice(0, 4) === today.slice(0, 4);
  return { label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }), tone: "later" };
}
