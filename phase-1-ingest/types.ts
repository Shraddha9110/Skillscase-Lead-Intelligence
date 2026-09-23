/** Phase 1 contract: one messy spreadsheet row, 13 source columns, no repairs. */

export const RAW_COLUMNS = [
  "lead_id",
  "name",
  "phone",
  "email",
  "city",
  "education",
  "experience",
  "goal",
  "german_level",
  "source",
  "last_contacted",
  "conversation",
  "notes"
] as const;

export type RawColumn = (typeof RAW_COLUMNS)[number];

export type RawLead = {
  [K in RawColumn]: string;
};

export const EXPECTED_ROW_COUNT = 30;
export const SNAPSHOT_RELATIVE_PATH = "data/raw/skillcase_messy_b2c_leads.csv";

export interface Phase1Quality {
  ok: boolean;
  rowCount: number;
  uniqueLeadIds: boolean;
  duplicateLeadIds: string[];
  missingLeadIds: string[];
  extraLeadIds: string[];
  missingColumns: string[];
  errors: string[];
}

export interface Phase1Result {
  leads: RawLead[];
  sourcePath: string;
  quality: Phase1Quality;
}
