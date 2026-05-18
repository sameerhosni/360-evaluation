import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client";
import { AdvocateBrief } from "./schemas";
import { TWIN_SYSTEM, PROMPT_VERSIONS } from "./prompts";

export type TwinPKGSlice = {
  person: {
    name: string;
    jobTitle: string;
    department: string;
    cycleLabel: string;
  };
  achievements: Array<{
    category: string;
    points: number;
    description: string;
    evidence: string;
  }>;
  peerFeedback: {
    totalCount: number;
    positiveCount: number;
    criticalCount: number;
    hostileCount: number;
    byDimension: Array<{
      dimension: string;
      averageRating: number;
      departmentAverage: number;
    }>;
  };
  taskMetrics: {
    closedTasks: number;
    averageQA: number;
    missedDeadlines: number;
  };
  managerDraft?: {
    [criterion: string]: { systemAnchor: number; managerScore: number };
  };
};

/**
 * Generate the Twin Advocate Brief shown to the manager during calibration.
 * PRD §7.11 (FR-11), §10.4
 */
export async function generateAdvocateBrief(slice: TwinPKGSlice) {
  const userMessage = [
    `EMPLOYEE: ${slice.person.name} — ${slice.person.jobTitle}, ${slice.person.department}`,
    `CYCLE: ${slice.person.cycleLabel}`,
    ``,
    `CONFIRMED ACHIEVEMENTS THIS CYCLE:`,
    slice.achievements.length === 0
      ? "(none yet confirmed)"
      : slice.achievements
          .map(
            (a, i) =>
              `${i + 1}. [${a.points}pt · ${a.category}] ${a.description}\n   Evidence: ${a.evidence}`,
          )
          .join("\n"),
    ``,
    `PEER FEEDBACK SUMMARY:`,
    `Total ratings: ${slice.peerFeedback.totalCount}`,
    `Positive: ${slice.peerFeedback.positiveCount} · Critical: ${slice.peerFeedback.criticalCount} · Hostile: ${slice.peerFeedback.hostileCount}`,
    `Per dimension (vs department average):`,
    slice.peerFeedback.byDimension
      .map(
        (d) =>
          `  - ${d.dimension}: ${d.averageRating.toFixed(2)} (dept avg ${d.departmentAverage.toFixed(2)}, delta ${(d.averageRating - d.departmentAverage >= 0 ? "+" : "")}${(d.averageRating - d.departmentAverage).toFixed(2)})`,
      )
      .join("\n"),
    ``,
    `TASK METRICS:`,
    `${slice.taskMetrics.closedTasks} tasks closed · avg QA ${slice.taskMetrics.averageQA.toFixed(1)} · ${slice.taskMetrics.missedDeadlines} missed deadlines`,
    ``,
    ...(slice.managerDraft
      ? [
          `MANAGER'S CURRENT DRAFT (system anchor → manager score):`,
          Object.entries(slice.managerDraft)
            .map(([c, v]) => `  - ${c}: ${v.systemAnchor.toFixed(1)} → ${v.managerScore.toFixed(1)} (delta ${(v.managerScore - v.systemAnchor).toFixed(1)})`)
            .join("\n"),
          ``,
        ]
      : []),
    `Generate the Advocate Brief.`,
  ].join("\n");

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: TWIN_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: { format: zodOutputFormat(AdvocateBrief) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `Twin brief parse failed (stop_reason=${response.stop_reason})`,
    );
  }

  return {
    brief: parsed,
    promptVersion: PROMPT_VERSIONS.twin,
    usage: response.usage,
  };
}
