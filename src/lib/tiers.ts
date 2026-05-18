// Unified rate-based color tiers for every evaluation surface.
// Anything in the UI that visualises a quality / performance value
// (a peer rating, a dimension fill, a Pulse total, a calibration anchor)
// flows through this module so the colour language is identical everywhere.

export type Tier = "bad" | "warn" | "sky" | "good";

/**
 * Map a 0–100 percentage to a quality tier.
 * - <40 → bad     (red)     · Below baseline
 * - <65 → warn    (amber)   · Developing
 * - <85 → sky     (blue)    · Solid
 * - ≥85 → good    (green)   · Strong
 */
export function tierForPct(pct: number): Tier {
  if (pct < 40) return "bad";
  if (pct < 65) return "warn";
  if (pct < 85) return "sky";
  return "good";
}

/** Map a value/max pair to a tier. */
export function tierForValue(value: number, max: number): Tier {
  if (max <= 0) return "bad";
  return tierForPct((value / max) * 100);
}

/** Map a 1–5 peer rating to a tier. */
export function tierForRating5(rating: number): Tier {
  if (rating <= 1) return "bad";
  if (rating <= 3) return "warn";
  if (rating <= 4) return "sky";
  return "good";
}

// ---------- Tailwind class maps ----------
// Used as exact string values so the Tailwind compiler can find them.
// Do not build these by string concatenation elsewhere.

export const TIER_BG: Record<Tier, string> = {
  bad: "bg-bad-500",
  warn: "bg-warn-500",
  sky: "bg-sky-500",
  good: "bg-good-500",
};

export const TIER_BG_SOFT: Record<Tier, string> = {
  bad: "bg-bad-50",
  warn: "bg-warn-50",
  sky: "bg-sky-50",
  good: "bg-good-50",
};

export const TIER_TEXT: Record<Tier, string> = {
  bad: "text-bad-700",
  warn: "text-warn-700",
  sky: "text-sky-700",
  good: "text-good-700",
};

export const TIER_BORDER: Record<Tier, string> = {
  bad: "border-bad-600",
  warn: "border-warn-600",
  sky: "border-sky-600",
  good: "border-good-600",
};

export const TIER_BORDER_SOFT: Record<Tier, string> = {
  bad: "border-bad-100",
  warn: "border-warn-100",
  sky: "border-sky-100",
  good: "border-good-100",
};

// Used by dimension fill bars + cockpit pulse cells
export const TIER_GRADIENT: Record<Tier, string> = {
  bad: "bg-gradient-to-r from-bad-500 to-bad-700",
  warn: "bg-gradient-to-r from-warn-500 to-warn-700",
  sky: "bg-gradient-to-r from-sky-500 to-sky-700",
  good: "bg-gradient-to-r from-good-500 to-good-700",
};

// Human-readable tier names, bilingual.
export const TIER_LABEL_EN: Record<Tier, string> = {
  bad: "Below baseline",
  warn: "Developing",
  sky: "Solid",
  good: "Strong",
};

export const TIER_LABEL_AR: Record<Tier, string> = {
  bad: "دون المستوى",
  warn: "في تطور",
  sky: "متين",
  good: "قوي",
};

export function tierLabel(tier: Tier, locale: "en" | "ar" = "en"): string {
  return locale === "ar" ? TIER_LABEL_AR[tier] : TIER_LABEL_EN[tier];
}

/** Map a 1–5 rating to the equivalent of "Rarely … Consistently" — bilingual. */
export const RATING_LABEL_EN = ["", "Rarely", "Sometimes", "Often", "Usually", "Consistently"];
export const RATING_LABEL_AR = ["", "نادراً", "أحياناً", "غالباً", "عادةً", "باستمرار"];
