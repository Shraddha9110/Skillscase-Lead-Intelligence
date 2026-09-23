import { geminiJson, isQuotaError } from "../phase-3-classify/gemini";
import { formatSource, PRODUCT_SOURCES, type SourceKey } from "../phase-4-enrich/sources";
import type { PrioritizedLead } from "../phase-6-prioritize/types";
import { OUTREACH_SYSTEM } from "../src/lib/prompts";
import { criticOutreach, wordCount } from "./critic";
import { isOutreachEligible, toOutreachedLead } from "./outreach";
import { MAX_WORDS, MIN_WORDS, type OutreachedLead } from "./types";

export const OUTREACH_REVIEW_REASON =
  "Outreach failed QC after regenerate; counsellor must write the message.";

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function productFacts(): string {
  return (Object.keys(PRODUCT_SOURCES) as SourceKey[]).map((key) => `- ${formatSource(key)}`).join("\n");
}

export function outreachUserPrompt(lead: PrioritizedLead, extra = ""): string {
  return `Write one WhatsApp/email outreach message for this Skillcase lead.

lead_id: ${lead.lead_id}
name: ${lead.displayName}
city: ${lead.city}
education: ${lead.education}
experience: ${lead.experience}
goal: ${lead.goal}
german_level: ${lead.german_level}
conversation: ${lead.conversation}
intent: ${lead.intent}
needs: ${lead.needs}
objections: ${lead.objections}
relevant: ${lead.relevant}
reviewRequired: ${lead.reviewRequired}
reviewReasons: ${(lead.reviewReasons || []).join("; ") || "none"}
missingFields: ${lead.missingFields.join(", ") || "none"}

Public Skillcase facts. Do not invent anything else:
${productFacts()}

If this is a GNM or review-queue eligibility case, say we will confirm eligibility. Never say they can apply.
${extra}`.trim();
}

export function acceptGeminiOutreach(
  lead: PrioritizedLead,
  raw: unknown
): { ok: true; text: string } | { ok: false; text: string; flags: string[] } {
  const text = compact(typeof raw === "string" ? raw : String((raw as { outreach?: unknown })?.outreach || ""));
  const flags = criticOutreach(text, lead);
  const words = wordCount(text);
  if (!text) flags.push("Outreach is empty.");
  if (text && (words < MIN_WORDS || words > MAX_WORDS)) {
    flags.push(`Outreach is ${words} words; need ${MIN_WORDS}–${MAX_WORDS}.`);
  }
  if (flags.length) return { ok: false, text, flags };
  return { ok: true, text };
}

export function toAiOutreach(lead: PrioritizedLead, text: string): OutreachedLead {
  return {
    ...lead,
    outreach: text,
    outreachEligible: true,
    wordCount: wordCount(text),
    criticFlags: [],
    outreachPath: "ai",
    pipelineStep: "phase7-outreach"
  };
}

export function outreachReviewFallback(lead: PrioritizedLead, flags: string[]): OutreachedLead {
  return {
    ...lead,
    outreach: "",
    outreachEligible: true,
    wordCount: 0,
    criticFlags: flags,
    outreachPath: "ai",
    reviewRequired: true,
    reviewReasons: [...new Set([...(lead.reviewReasons || []), OUTREACH_REVIEW_REASON])],
    criticNotes: [...new Set([...(lead.criticNotes || []), ...flags])],
    pipelineStep: "phase7-outreach"
  };
}

export interface GeminiOutreachResult {
  lead: OutreachedLead;
  usedGemini: boolean;
  quota: boolean;
}

export async function writeOutreachWithGemini(lead: PrioritizedLead): Promise<GeminiOutreachResult> {
  if (!isOutreachEligible(lead)) {
    return { lead: toOutreachedLead(lead), usedGemini: false, quota: false };
  }

  try {
    const first = await geminiJson<{ outreach?: string }>(OUTREACH_SYSTEM, outreachUserPrompt(lead));
    const accepted = acceptGeminiOutreach(lead, first.data);
    if (accepted.ok) return { lead: toAiOutreach(lead, accepted.text), usedGemini: true, quota: false };

    const retry = await geminiJson<{ outreach?: string }>(
      OUTREACH_SYSTEM,
      outreachUserPrompt(
        lead,
        `Your previous draft failed QC: ${accepted.flags.join("; ")}\nPrevious draft: ${accepted.text}\nRewrite once. 50-70 words. Fix those issues.`
      )
    );
    const second = acceptGeminiOutreach(lead, retry.data);
    if (second.ok) return { lead: toAiOutreach(lead, second.text), usedGemini: true, quota: false };
    return { lead: outreachReviewFallback(lead, second.flags), usedGemini: true, quota: false };
  } catch (error) {
    return { lead: toOutreachedLead(lead), usedGemini: false, quota: isQuotaError(error) };
  }
}
