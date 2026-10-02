import "server-only";

import {
  getPublishedSheetNames,
  mapSheetRows,
  type DatabaseEntry,
  type PublishedSheetName,
  type RawRow,
} from "@/lib/mapping/sheets";
import { getCachedEntries, setCachedEntries } from "./cache";
import { getGoogleSheetsClient } from "./client";

const DEFAULT_SPREADSHEET_ID =
  "1zL07EjoVwH-nSPfTN2Nsz6yHXvzFskCxdz-tEdFwoWs";

type SheetReadResult = {
  sheet: PublishedSheetName;
  entries: DatabaseEntry[];
};

function getSpreadsheetId(): string {
  return (
    process.env.GOOGLE_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID
  );
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function rowsFromValues(values: unknown[][]): RawRow[] {
  if (!values.length) return [];

  const headers = (values[0] ?? []).map((value) => String(value ?? ""));
  const dataRows = values.slice(1);

  return dataRows.map((row) => {
    const record: RawRow = {};

    headers.forEach((header, index) => {
      if (!header.trim()) return;
      record[header] = row[index];
    });

    return record;
  });
}

async function readPublishedSheet(
  sheet: PublishedSheetName,
): Promise<SheetReadResult> {
  const sheets = getGoogleSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const range = `${quoteSheetName(sheet)}!A:AF`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
    majorDimension: "ROWS",
  });

  const values = (response.data.values ?? []) as unknown[][];
  const rows = rowsFromValues(values);

  return {
    sheet,
    entries: mapSheetRows(sheet, rows, 2),
  };
}

export async function readDatabaseEntries(options?: {
  forceRefresh?: boolean;
}): Promise<DatabaseEntry[]> {
  if (!options?.forceRefresh) {
    const cached = getCachedEntries();
    if (cached) return cached;
  }

  const publishedSheets = getPublishedSheetNames();

  const results = await Promise.all(
    publishedSheets.map((sheet) => readPublishedSheet(sheet)),
  );

  const entries = results.flatMap((result) => result.entries);

  setCachedEntries(entries);

  return entries;
}

export async function readDatabaseStats(): Promise<{
  total: number;
  bySheet: Record<string, number>;
}> {
  const entries = await readDatabaseEntries();

  const bySheet = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.category] = (acc[entry.category] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: entries.length,
    bySheet,
  };
}
