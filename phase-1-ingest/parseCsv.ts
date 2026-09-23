/**
 * Quoted-CSV parser that does not clean, shift, or infer values.
 * Phase 1 must preserve messy cells exactly (aside from trimming surrounding whitespace).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  const width = rows[0]?.length ?? 0;
  return rows
    .filter((entry) => entry.some((value) => value.trim() !== ""))
    .map((entry) => {
      const next = entry.slice();
      while (next.length < width) next.push("");
      return next.slice(0, width);
    });
}
