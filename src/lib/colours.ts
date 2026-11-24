import type { CSSProperties } from "react";
import { z } from "zod";

// Each person picks one base colour per quadrant. globals.css mixes it into the card colour
// for backgrounds and chips, so light and dark mode both follow from the same choice.
export const COLOUR_KEYS = ["inbox", "q1", "q2", "q3", "q4"] as const;
export type ColourKey = (typeof COLOUR_KEYS)[number];
export type Colours = Record<ColourKey, string> & { depth: number };

export const DEFAULT_COLOURS: Colours = { inbox: "#1d4fbf", q1: "#c0392b", q2: "#2e7d4f", q3: "#a8691a", q4: "#55555c", depth: 0 };
export const DEPTH_MIN = -5;
export const DEPTH_MAX = 5;

export const PALETTE = [
  ["Red", "#c0392b"],
  ["Orange", "#c2410c"],
  ["Amber", "#a8691a"],
  ["Green", "#2e7d4f"],
  ["Teal", "#0f766e"],
  ["Blue", "#1d4fbf"],
  ["Indigo", "#4338ca"],
  ["Purple", "#7e3fb0"],
  ["Pink", "#be185d"],
  ["Grey", "#55555c"],
] as const;

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a colour like #c0392b.");
export const coloursSchema = z
  .object({ inbox: hex, q1: hex, q2: hex, q3: hex, q4: hex, depth: z.number().int().min(DEPTH_MIN).max(DEPTH_MAX) })
  .strict();

export function parseColours(json: string | null): Colours {
  if (!json) return DEFAULT_COLOURS;
  try {
    return coloursSchema.parse(JSON.parse(json));
  } catch {
    return DEFAULT_COLOURS;
  }
}

/** How much of the base colour goes into card backgrounds and chips. Depth 0 matches the original design. */
export function tints(depth: number) {
  const bg = Math.round(10 * (depth < 0 ? 1 + depth * 0.1 : 1 + depth * 0.3)); // 5% at -5, 10% at 0, 25% at +5
  return { bg, chip: bg + 17 };
}

/** CSS variables read by the .q-* scope classes in globals.css. */
export function coloursStyle(c: Colours): CSSProperties {
  const t = tints(c.depth);
  return {
    ...Object.fromEntries(COLOUR_KEYS.map((k) => [`--${k}-base`, c[k]])),
    "--q-tint": `${t.bg}%`,
    "--q-chip-tint": `${t.chip}%`,
  } as CSSProperties;
}
