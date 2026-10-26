export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 2000;

export type CsvError = "empty" | "too_large" | "too_many_rows" | "unterminated_quote";

/** Picks the separator that appears most often in the header line (outside quotes). */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

/** RFC 4180 parser: quoted fields, escaped quotes, embedded newlines, CRLF or LF, optional BOM. */
export function parseCsv(input: string): { rows: string[][] } | { error: CsvError } {
  if (input.length > MAX_CSV_BYTES) return { error: "too_large" };
  const text = input.replace(/^﻿/, "");
  if (text.trim() === "") return { error: "empty" };

  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endRow = () => {
    row.push(field);
    field = "";
    if (row.some((c) => c.trim() !== "")) rows.push(row); // skip blank lines
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      if (rows.length > MAX_CSV_ROWS + 1) return { error: "too_many_rows" };
    } else field += ch;
  }
  if (quoted) return { error: "unterminated_quote" };
  if (field !== "" || row.length > 0) endRow();
  if (rows.length === 0) return { error: "empty" };
  if (rows.length > MAX_CSV_ROWS + 1) return { error: "too_many_rows" }; // +1 for the header
  return { rows };
}

/** Quotes a cell and neutralises spreadsheet formulas so exported files are safe to open in Excel. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
