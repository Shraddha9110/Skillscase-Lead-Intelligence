import { compact } from "./detect";
import type { CleanLead } from "./types";

export function markDuplicates(leads: CleanLead[]): CleanLead[] {
  const byKey = new Map<string, CleanLead>();

  return leads.map((lead) => {
    const keys = [
      lead.phoneDigits ? `p:${lead.phoneDigits}` : "",
      lead.emailNormalized ? `e:${lead.emailNormalized}` : ""
    ].filter(Boolean);

    for (const key of keys) {
      const seen = byKey.get(key);
      if (seen && seen.lead_id !== lead.lead_id) {
        const nameClose =
          compact(seen.name) === compact(lead.name) ||
          compact(seen.name).startsWith(compact(lead.name).split(" ")[0]) ||
          compact(lead.name).startsWith(compact(seen.name).split(" ")[0]);

        return {
          ...lead,
          isDuplicate: true,
          duplicateOf: seen.lead_id,
          duplicateReason: nameClose
            ? `Same phone/email as ${seen.lead_id} (${seen.displayName})`
            : `Same contact details as ${seen.lead_id}, name differs`,
          qualityFlags: [...lead.qualityFlags, `duplicate_of_${seen.lead_id}`]
        };
      }
    }

    for (const key of keys) byKey.set(key, lead);
    return lead;
  });
}
