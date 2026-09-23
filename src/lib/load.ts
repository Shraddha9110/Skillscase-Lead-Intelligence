import { RAW_CSV } from "../data/rawCsv";
import { parseCsv, rowsToLeads } from "./csv";
import type { RawLead } from "./types";

export function loadRawLeads(): RawLead[] {
  return rowsToLeads(parseCsv(RAW_CSV));
}
