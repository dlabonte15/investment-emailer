import * as XLSX from "xlsx";

export interface RawRow {
  [column: string]: string | number | null;
}

export interface MappedInvestment {
  [internalField: string]: string | number | null;
}

export interface ParseResult {
  rows: MappedInvestment[];
  rawColumns: string[];
  matchedColumns: string[];
  unmatchedColumns: string[];
  unmappedFields: string[];
  rowCount: number;
}

/**
 * Parse an Excel buffer into raw rows using SheetJS.
 * Uses the specified sheet name, or falls back to the first sheet.
 */
function parseExcelBuffer(buffer: Buffer, sheetName?: string): RawRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const targetSheet =
    sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheet];
  if (!worksheet) {
    throw new Error(`Sheet "${targetSheet}" not found in workbook`);
  }

  const rows: RawRow[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false,
  });

  return rows;
}

/**
 * Apply column mappings to raw rows.
 * Each mapping is { internalField, excelColumn }.
 * Returns mapped rows plus diagnostic info about which columns matched.
 */
function applyColumnMappings(
  rawRows: RawRow[],
  rawColumns: string[],
  mappings: { internalField: string; excelColumn: string }[]
): {
  rows: MappedInvestment[];
  matchedColumns: string[];
  unmatchedColumns: string[];
  unmappedFields: string[];
} {
  // Build lookup: excelColumn (lowercased, trimmed) → internalField
  const excelToInternal = new Map<string, string>();
  for (const m of mappings) {
    excelToInternal.set(m.excelColumn.toLowerCase().trim(), m.internalField);
  }

  // Determine which raw columns have a mapping
  const matchedColumns: string[] = [];
  const unmatchedColumns: string[] = [];
  const activeMapping = new Map<string, string>(); // raw column name → internal field

  for (const col of rawColumns) {
    const key = col.toLowerCase().trim();
    const internalField = excelToInternal.get(key);
    if (internalField) {
      matchedColumns.push(col);
      activeMapping.set(col, internalField);
    } else {
      unmatchedColumns.push(col);
    }
  }

  // Determine which internal fields have no matching Excel column
  const matchedInternalFields = new Set(activeMapping.values());
  const unmappedFields = mappings
    .map((m) => m.internalField)
    .filter((f) => !matchedInternalFields.has(f));

  // Map each row
  const rows: MappedInvestment[] = rawRows.map((raw) => {
    const mapped: MappedInvestment = {};
    for (const [excelCol, internalField] of activeMapping) {
      mapped[internalField] = raw[excelCol] ?? null;
    }
    return mapped;
  });

  return { rows, matchedColumns, unmatchedColumns, unmappedFields };
}

/**
 * Main entry point: parse Excel buffer and apply column mappings.
 */
export async function parseAndMapExcel(
  buffer: Buffer,
  sheetName: string | undefined,
  mappings: { internalField: string; excelColumn: string }[]
): Promise<ParseResult> {
  const rawRows = parseExcelBuffer(buffer, sheetName);

  // Get column names from the first row's keys (or empty if no rows)
  const rawColumns =
    rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  const { rows, matchedColumns, unmatchedColumns, unmappedFields } =
    applyColumnMappings(rawRows, rawColumns, mappings);

  return {
    rows,
    rawColumns,
    matchedColumns,
    unmatchedColumns,
    unmappedFields,
    rowCount: rows.length,
  };
}
