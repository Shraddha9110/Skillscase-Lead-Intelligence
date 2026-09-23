import {
  CLASSIFY_SYSTEM,
  CRITIC_SYSTEM,
  ENRICH_SYSTEM,
  OUTREACH_SYSTEM
} from "./prompts";
import type { Classification, CleanLead, Enrichment, PriorityResult, QualityReview } from "./types";

export interface LlmConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

async function chatJson<T>(config: LlmConfig, system: string, user: string): Promise<T> {
  const baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 280)}`);
  }

  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned an empty message.");
  return JSON.parse(content) as T;
}

export async function llmClassify(lead: CleanLead, config: LlmConfig): Promise<Classification> {
  return chatJson(config, CLASSIFY_SYSTEM, JSON.stringify(lead, null, 2));
}

export async function llmEnrich(lead: CleanLead, extraContext: string, config: LlmConfig): Promise<Enrichment> {
  return chatJson(
    config,
    ENRICH_SYSTEM,
    `${extraContext}\n\nLEAD:\n${JSON.stringify(lead, null, 2)}`
  );
}

export async function llmOutreach(
  lead: CleanLead,
  enrichment: Enrichment,
  relevant: string,
  config: LlmConfig
): Promise<string> {
  const result = await chatJson<{ outreach: string }>(
    config,
    OUTREACH_SYSTEM,
    JSON.stringify({ lead, enrichment, relevant }, null, 2)
  );
  return result.outreach || "";
}

export async function llmCritic(payload: unknown, config: LlmConfig): Promise<QualityReview> {
  return chatJson(config, CRITIC_SYSTEM, JSON.stringify(payload, null, 2));
}

export function llmEnabled(config?: LlmConfig | null): config is LlmConfig {
  return Boolean(config?.apiKey);
}
