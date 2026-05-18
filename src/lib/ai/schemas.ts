import { z } from "zod";

// ---------- Auto-Achievement Detection (FR-02, PRD §10.1) ----------
export const AchievementCategory = z.enum([
  "project_milestone",
  "process_improvement",
  "exceptional_performance",
  "cross_functional_leadership",
  "peer_witnessed",
]);

export const AADCandidate = z.object({
  isAchievement: z
    .boolean()
    .describe("Whether the event qualifies as a candidate achievement."),
  category: AchievementCategory.nullable().describe(
    "Achievement category. Null when isAchievement is false.",
  ),
  proposedPoints: z
    .number()
    .int()
    .min(1)
    .max(5)
    .nullable()
    .describe("Proposed point value 1-5. Null when isAchievement is false."),
  evidenceSummary: z
    .string()
    .describe(
      "One sentence, neutral, in source language. The summary the employee will read.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Calibration confidence in this proposal. 0.0 = guess, 1.0 = clear-cut.",
    ),
  rejectReason: z
    .string()
    .nullable()
    .describe(
      "If isAchievement is false, a one-sentence neutral reason. Otherwise null.",
    ),
});

export type AADCandidate = z.infer<typeof AADCandidate>;

// ---------- Twin Advocate Brief (FR-11, PRD §10.4) ----------
export const AdvocateBriefAchievement = z.object({
  rank: z.number().int().min(1).max(3),
  summary: z
    .string()
    .describe("One sentence describing the achievement and why it matters."),
  evidence: z
    .string()
    .describe("Concrete evidence — task IDs, metrics, projects."),
  points: z.number().int().min(1).max(5),
});

export const CounterEvidence = z.object({
  criterion: z
    .string()
    .describe("Which criterion the counter-evidence applies to."),
  concern: z
    .string()
    .describe(
      "What the manager appears to have under-weighted, factually framed.",
    ),
  evidence: z.string().describe("Specific events or data supporting the concern."),
});

export const AdvocateBrief = z.object({
  topAchievements: z
    .array(AdvocateBriefAchievement)
    .min(1)
    .max(3)
    .describe("Up to 3 highest-impact achievements, ranked."),
  peerSummary: z
    .string()
    .describe(
      "Narrative summary of peer feedback. No peer names. Aggregates counts and dimension-level patterns.",
    ),
  growthSignals: z
    .array(z.string())
    .max(4)
    .describe("Skills gained or growth observed this cycle, 1-2 sentences each."),
  counterEvidence: z
    .array(CounterEvidence)
    .max(3)
    .describe(
      "Discrepancies where the manager's draft score conflicts with PKG evidence. Empty if no concerns.",
    ),
});

export type AdvocateBrief = z.infer<typeof AdvocateBrief>;

// ---------- Bias Pattern Description (FR-07, PRD §10.5) ----------
export const BiasExplanations = z.object({
  oneSentence: z
    .string()
    .describe(
      "One-sentence plain-language description of the pattern. No individual names.",
    ),
  magnitudeInEverydayTerms: z
    .string()
    .describe(
      "Effect size translated into something an HRBP can quote in a meeting.",
    ),
  neutral: z
    .string()
    .describe("Most charitable explanation (1-2 sentences)."),
  cautious: z
    .string()
    .describe("Middle-ground explanation that justifies investigation."),
  urgent: z
    .string()
    .describe("Worst-case explanation that justifies immediate action."),
  recommendedAction: z
    .string()
    .describe("Concrete HR action with implied severity."),
});

export type BiasExplanations = z.infer<typeof BiasExplanations>;

// ---------- Self-Appraisal Scorer (FR-06, PRD §10.3) ----------
// Per the T2 deck (page 6): Goals 6, Growth 5, Career 5, Reflection 4 — sum = 20.
export const SelfAppraisalScore = z.object({
  personalGoalAchievement: z.object({
    score: z.number().min(0).max(6),
    rationale: z.string().describe("One short sentence grounding the score in the answer text and Reflection Brief."),
  }),
  selfIdentifiedGrowth: z.object({
    score: z.number().min(0).max(5),
    rationale: z.string(),
  }),
  careerDevelopment: z.object({
    score: z.number().min(0).max(5),
    rationale: z.string(),
  }),
  selfReflectionAccountability: z.object({
    score: z.number().min(0).max(4),
    rationale: z.string(),
  }),
  selfAwarenessMultiplier: z.number().min(0).max(2).describe(
    "Bonus 0-2 points awarded when the employee's reflection aligns honestly with the system-computed reality (Reflection Brief). Reward calibrated insight, not self-promotion or false modesty.",
  ),
  twinNote: z.string().describe(
    "One-paragraph note from the Twin to the employee about their reflection. Honest, warm, specific.",
  ),
});

export type SelfAppraisalScore = z.infer<typeof SelfAppraisalScore>;
