// View preferences live in a cookie so the server renders the chosen view on first paint.

export type View = "matrix" | "list" | "board";
export type SortKey = "priority" | "due" | "tag" | "title";
/** `area` is "all" or an area name. */
export type Prefs = { view: View; area: string; sort: SortKey; dir: 1 | -1; hideDone: boolean; group: boolean };

export const PREFS_COOKIE = "odot_prefs";
export const DEFAULT_PREFS: Prefs = { view: "matrix", area: "all", sort: "priority", dir: 1, hideDone: false, group: true };

const pick = <T>(v: unknown, allowed: readonly T[], fallback: T) => (allowed.includes(v as T) ? (v as T) : fallback);

export function parsePrefs(raw: string | undefined): Prefs {
  let p: Record<string, unknown> = {};
  try {
    p = JSON.parse(raw ?? "{}");
  } catch {}
  return {
    view: pick(p.view, ["matrix", "list", "board"] as const, DEFAULT_PREFS.view),
    area: typeof p.area === "string" && p.area.length <= 40 ? p.area : DEFAULT_PREFS.area,
    sort: pick(p.sort, ["priority", "due", "tag", "title"] as const, DEFAULT_PREFS.sort),
    dir: p.dir === -1 ? -1 : 1,
    hideDone: p.hideDone === true,
    group: p.group !== false,
  };
}
