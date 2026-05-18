import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client";
import { AADCandidate } from "./schemas";
import { AAD_SYSTEM, PROMPT_VERSIONS } from "./prompts";

export type AADEventInput = {
  kind: "task_closed" | "mention_positive" | "project_milestone" | "voice_capture";
  occurredAt: string; // ISO
  payload: Record<string, unknown>;
};

export type AADHistoryEntry = {
  category: string;
  points: number;
  description: string;
};

/**
 * Evaluate one work event for achievement candidacy.
 * PRD §7.2 (FR-02), §10.1
 */
export async function evaluateAchievementCandidate(args: {
  event: AADEventInput;
  history: AADHistoryEntry[];
  personJobTitle: string;
  language?: "en" | "ar";
}) {
  const userMessage = [
    `EVENT TO EVALUATE:`,
    JSON.stringify(args.event, null, 2),
    ``,
    `EMPLOYEE'S CONFIRMED ACHIEVEMENT HISTORY THIS CYCLE (for tier calibration):`,
    args.history.length === 0
      ? "(no prior confirmed achievements this cycle)"
      : args.history.map((h, i) => `${i + 1}. [${h.points}pt · ${h.category}] ${h.description}`).join("\n"),
    ``,
    `EMPLOYEE ROLE: ${args.personJobTitle}`,
    `LANGUAGE: ${args.language ?? "en"}`,
    ``,
    `Evaluate and respond with the JSON object.`,
  ].join("\n");

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    // Stable system prompt → cacheable. Cache miss is fine when the system
    // prompt is below the model's minimum cacheable prefix (~4K tokens on
    // Opus 4.7); the marker is a no-op in that case.
    system: [
      { type: "text", text: AAD_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: { format: zodOutputFormat(AADCandidate) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `AAD parse failed (stop_reason=${response.stop_reason}). Raw: ${JSON.stringify(response.content)}`,
    );
  }

  return {
    candidate: parsed,
    promptVersion: PROMPT_VERSIONS.aad,
    usage: response.usage,
  };
}
