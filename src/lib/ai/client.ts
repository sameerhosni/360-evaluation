import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Anthropic client. Reads ANTHROPIC_API_KEY from env.
 *
 * Per Pulse360 PKG Architecture §7.3:
 *  - Foundation LLM is Anthropic Claude (Opus 4.7 default)
 *  - All inference calls audited via InferenceCall log (PRD §10.5)
 *  - Per-tenant model override possible via tenant config in production
 */
let _client: Anthropic | null = null;

export function anthropic() {
  if (!_client) {
    _client = new Anthropic({
      // SDK reads ANTHROPIC_API_KEY from env by default — making it explicit
      // here so the failure mode is clear if the key is missing.
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _client;
}

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

export function hasApiKey() {
  return !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 0;
}
