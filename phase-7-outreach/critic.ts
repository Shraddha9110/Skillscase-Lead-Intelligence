export const BANNED_OUTREACH = /guarantee you a job|guaranteed job|we guarantee a job|₹\s*\d|rs\.?\s*\d/i;
export const INTERNAL_WORDS = /\bon file\b|\brow\b|\bfields?\b|\bCRM\b/i;
export const HARD_MAX_WORDS = 80;

export const UNVERIFIED_CLAIMS =
  /german wards ask|ask us to shortlist|verified (german )?healthcare employers|hospital[- ]vocabulary|nursing council proof|document list:|which houses are stricter|named hospital|charit[eé]|guaranteed interview/i;

export const ELIGIBILITY_YES =
  /\byes,?\s+you can apply\b|\bgnm nurses?\b.{0,40}\bdo apply\b|\byou are eligible\b|\bgnm is (accepted|eligible)\b|\byou can apply(?! before)/i;

export const ELIGIBILITY_CONFIRM = /we will confirm eligibility|confirm eligibility/i;

export interface OutreachCriticLead {
  education?: string;
  reviewRequired?: boolean;
  reviewReasons?: string[];
  signals?: { gnmQuestion?: boolean };
}

export function needsEligibilityConfirm(lead?: OutreachCriticLead): boolean {
  if (!lead) return false;
  const blob = `${lead.education || ""} ${(lead.reviewReasons || []).join(" ")}`;
  const gnm = /\bgnm\b/i.test(blob) || Boolean(lead.signals?.gnmQuestion);
  return gnm || Boolean(lead.reviewRequired && /eligib|qualification recognition/i.test(blob));
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sentenceKey(sentence: string): string {
  return sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function repeatedSentences(text: string): string[] {
  const seen = new Set<string>();
  const repeats: string[] = [];
  for (const sentence of splitSentences(text)) {
    const key = sentenceKey(sentence);
    if (!key) continue;
    if (seen.has(key)) repeats.push(sentence);
    else seen.add(key);
  }
  return repeats;
}

export function criticOutreach(text: string, lead?: OutreachCriticLead): string[] {
  if (!text.trim()) return [];
  const flags: string[] = [];
  if (BANNED_OUTREACH.test(text)) {
    flags.push("Outreach invents a rupee amount or a job guarantee.");
  }
  if (repeatedSentences(text).length) {
    flags.push("A sentence appears twice in the same message.");
  }
  if (INTERNAL_WORDS.test(text)) {
    flags.push("Outreach uses an internal word (on file, row, field, or CRM).");
  }
  if (wordCount(text) > HARD_MAX_WORDS) {
    flags.push(`Outreach is ${wordCount(text)} words; over ${HARD_MAX_WORDS} is not sendable.`);
  }
  if (UNVERIFIED_CLAIMS.test(text)) {
    flags.push("Outreach states an unsourced product, employer, or eligibility fact.");
  }
  if (ELIGIBILITY_YES.test(text)) {
    flags.push("Outreach tells the lead they can apply or are eligible.");
  }
  if (needsEligibilityConfirm(lead)) {
    if (!ELIGIBILITY_CONFIRM.test(text)) {
      flags.push("Review-queue / GNM outreach must say we will confirm eligibility.");
    }
    if (/\byes,?\s+you can apply\b|\bdo apply\b/i.test(text)) {
      flags.push("Review-queue / GNM outreach must never say yes, you can apply.");
    }
  }
  return flags;
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || "there";
}

export function endsWithNextStep(text: string): boolean {
  const last = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean).pop() || "";
  return /[?]$/.test(last) || /^(reply|send|when|want|shall|can i|are you|do you)/i.test(last);
}
