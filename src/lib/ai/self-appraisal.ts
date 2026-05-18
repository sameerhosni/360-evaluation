import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client";
import { SelfAppraisalScore } from "./schemas";
import { SELF_APPRAISAL_SYSTEM, PROMPT_VERSIONS } from "./prompts";

export type ReflectionBrief = {
  cycleLabel: string;
  tasksClosed: number;
  averageQA: number;
  missedDeadlines: number;
  topAchievements: string[]; // already confirmed
  peerSummary: string;
  topGrowingSkill?: string;
};

export type SelfAppraisalAnswers = {
  personalGoalAchievement: string;
  selfIdentifiedGrowth: string;
  careerDevelopment: string;
  selfReflectionAccountability: string;
};

/**
 * Score an employee's written self-appraisal against the T2 4-criterion rubric.
 * PRD §7.6 (FR-06) — voice flow is Phase 2; this is the text path.
 */
export async function scoreSelfAppraisal(args: {
  person: { name: string; jobTitle: string };
  brief: ReflectionBrief;
  answers: SelfAppraisalAnswers;
}) {
  const userMessage = [
    `EMPLOYEE: ${args.person.name} — ${args.person.jobTitle}`,
    `CYCLE: ${args.brief.cycleLabel}`,
    ``,
    `REFLECTION BRIEF (what the system already knows):`,
    `- Tasks closed: ${args.brief.tasksClosed}`,
    `- Average QA: ${args.brief.averageQA.toFixed(1)}`,
    `- Missed deadlines: ${args.brief.missedDeadlines}`,
    `- Confirmed achievements:`,
    ...args.brief.topAchievements.map((a, i) => `   ${i + 1}. ${a}`),
    `- Peer summary: ${args.brief.peerSummary}`,
    args.brief.topGrowingSkill ? `- Top growing skill: ${args.brief.topGrowingSkill}` : "",
    ``,
    `THE EMPLOYEE'S FOUR ANSWERS:`,
    ``,
    `1) Personal Goal Achievement (max 6):`,
    args.answers.personalGoalAchievement || "(empty)",
    ``,
    `2) Self-Identified Growth Areas (max 5):`,
    args.answers.selfIdentifiedGrowth || "(empty)",
    ``,
    `3) Career Development Planning (max 5):`,
    args.answers.careerDevelopment || "(empty)",
    ``,
    `4) Self-Reflection & Accountability (max 4):`,
    args.answers.selfReflectionAccountability || "(empty)",
    ``,
    `Score the four criteria, award the Self-Awareness Multiplier, and write a Twin note.`,
  ].filter(Boolean).join("\n");

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 2048,
    system: [
      { type: "text", text: SELF_APPRAISAL_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: { format: zodOutputFormat(SelfAppraisalScore) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(`Self-appraisal scoring failed (stop_reason=${response.stop_reason})`);
  }

  return {
    score: parsed,
    promptVersion: PROMPT_VERSIONS.selfAppraisal,
    usage: response.usage,
  };
}
