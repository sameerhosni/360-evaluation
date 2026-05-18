import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL } from "./client";
import { BiasExplanations } from "./schemas";
import { BIAS_SYSTEM, PROMPT_VERSIONS } from "./prompts";

export type BiasPatternInput = {
  axis: string; // gender | nationality | age_band | ...
  scope: string; // department | manager | peer_cluster
  scopeLabel: string;
  criterion: string | null;
  effectSize: number;
  ciLow: number;
  ciHigh: number;
  sampleSize: number;
  pValue: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

/**
 * Generate plain-language descriptions for a flagged bias pattern.
 * PRD §7.7 (FR-07), §10.5
 */
export async function describeBiasPattern(pattern: BiasPatternInput) {
  const userMessage = [
    `FLAGGED PATTERN:`,
    JSON.stringify(pattern, null, 2),
    ``,
    `Produce the JSON object with neutral / cautious / urgent explanations and a recommended action.`,
  ].join("\n");

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 2048,
    system: [
      { type: "text", text: BIAS_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userMessage }],
    output_config: { format: zodOutputFormat(BiasExplanations) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `Bias description parse failed (stop_reason=${response.stop_reason})`,
    );
  }

  return {
    explanations: parsed,
    promptVersion: PROMPT_VERSIONS.bias,
    usage: response.usage,
  };
}
