import type { QcExample } from "./types";

export const QC_EXAMPLES: QcExample[] = [
  {
    id: "qc-1",
    leadId: "L029",
    title: "Deepa Krishnan — email missing",
    problem: "The email cell is empty. Notes say the contact field is missing.",
    handling:
      "Empty email stays empty and is reported as a missing field. Phase 5 queues WhatsApp-only contact until an email is collected."
  },
  {
    id: "qc-2",
    leadId: "L028",
    title: "Priya S. — fuzzy duplicate of L001",
    problem:
      "Different display name ('Priya S.' vs 'Priya Sharma') and '2' instead of '2 years'. Same phone and email as L001.",
    handling:
      "Dedup key is phone + email, not name. Phase 5 keeps L028 in the review queue as duplicate_of L001 so she is not messaged twice."
  },
  {
    id: "qc-3",
    leadId: "L016",
    title: "Farhan Ali — CRM says irrelevant, product says maybe not",
    problem:
      "Notes say 'Different profession'. A rule that trusted notes would drop a BPharm lead asking about healthcare jobs in Germany.",
    handling:
      "Skillcase signup lists Pharmacists. Phase 5 flags a product-vs-CRM conflict and will not auto-accept."
  },
  {
    id: "qc-4",
    leadId: "L007",
    title: "Arjun Nair — experience missing",
    problem: "The experience cell is empty. Notes say information is missing.",
    handling:
      "Empty experience stays empty. Phase 5 fails the row if anyone invents years of work, and queues it to collect experience first."
  }
];
