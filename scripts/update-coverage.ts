/**
 * Update data/coverage.json with current counts from the database.
 *
 * Reads the se-energy.db, queries each table for row counts,
 * and writes updated item_count values and summary into coverage.json.
 */

import Database from "better-sqlite3";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env["SE_ENERGY_DB_PATH"] ?? join(__dirname, "..", "data", "se-energy.db");
const COVERAGE_PATH = join(__dirname, "..", "data", "coverage.json");

if (!existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

function count(sql: string): number {
  const row = db.prepare(sql).get() as { c: number } | undefined;
  return row?.c ?? 0;
}

const raw = readFileSync(COVERAGE_PATH, "utf-8");
const coverage = JSON.parse(raw);

// Map source IDs to DB queries for item counts
const SOURCE_QUERIES: Record<string, string> = {
  ei: "SELECT COUNT(*) as c FROM regulations WHERE regulator_id = 'ei'",
  elsakerhetsverket: "SELECT COUNT(*) as c FROM regulations WHERE regulator_id = 'elsakerhetsverket'",
  svenska_kraftnat: "SELECT COUNT(*) as c FROM grid_codes",
  energimyndigheten: "SELECT COUNT(*) as c FROM decisions",
};

let totalItems = 0;

for (const src of coverage.sources) {
  const query = SOURCE_QUERIES[src.id as string];
  if (query) {
    const c = count(query);
    src.item_count = c;
    totalItems += c;
  }
}

coverage.coverage_date = new Date().toISOString().split("T")[0];
coverage.summary.total_items = totalItems;
coverage.summary.total_sources = coverage.sources.length;
coverage.summary.total_tools = coverage.tools.length;
coverage.summary.known_gaps = coverage.gaps.length;
coverage.summary.gaps_planned = coverage.gaps.filter((g: { planned: boolean }) => g.planned).length;

db.close();

writeFileSync(COVERAGE_PATH, JSON.stringify(coverage, null, 2) + "\n");
console.log(`Updated ${COVERAGE_PATH}`);
console.log(`  Sources: ${coverage.summary.total_sources}`);
console.log(`  Items:   ${totalItems}`);
console.log(`  Tools:   ${coverage.summary.total_tools}`);
