import { getGeminiApiKey, getGeminiModel } from "./env";

const FALLBACK_MODELS: string[] = [];

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export function isQuotaError(error: unknown): boolean {
  if (error instanceof GeminiError && error.status === 429) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /429|quota/i.test(message);
}

let cachedModel = "";

export async function geminiJson<T>(system: string, user: string): Promise<{ data: T; model: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is missing. Add it to .env.");
  }

  const preferred = getGeminiModel();
  const models = [
    cachedModel,
    preferred,
    ...FALLBACK_MODELS.filter((model) => model !== preferred && model !== cachedModel)
  ].filter(Boolean);
  let lastError: GeminiError | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const data = await callGemini<T>(apiKey, model, system, user);
        cachedModel = model;
        return { data, model };
      } catch (error) {
        const timedOut = error instanceof Error && /timeout|aborted/i.test(error.message);
        lastError = error instanceof GeminiError ? error : new GeminiError(String(error));
        if (lastError.status === 429) {
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          throw lastError;
        }
        if (timedOut || lastError.status === 503) {
          const waitMs = 1200 * (attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        if (lastError.status === 404) break;
        throw lastError;
      }
    }
  }

  throw lastError || new GeminiError("Gemini request failed.");
}

async function callGemini<T>(apiKey: string, model: string, system: string, user: string): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new GeminiError(`Gemini ${model} failed (${response.status})`, response.status, raw.slice(0, 400));
  }

  const payload = JSON.parse(raw) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiError(`Gemini ${model} returned an empty candidate.`, response.status, raw.slice(0, 400));
  }

  return JSON.parse(stripFences(text)) as T;
}

function stripFences(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}
