import * as fs from "fs/promises";
import * as path from "path";
import type { MappedInvestment } from "./excel-parser";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "investments.json");

export interface StoredData {
  rows: MappedInvestment[];
  rawColumns: string[];
  parsedAt: string;
}

/**
 * Save parsed investment data to disk as JSON.
 * Creates the data/ directory if it doesn't exist.
 */
export async function saveInvestments(data: StoredData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Read stored investment data from disk.
 * Returns null if no data file exists.
 */
export async function getInvestments(): Promise<StoredData | null> {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content) as StoredData;
  } catch {
    return null;
  }
}
