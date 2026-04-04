/**
 * Verify data/coverage.json against the actual database and codebase.
 *
 * Checks:
 *   1. item_counts in coverage.json match actual DB row counts
 *   2. All tools listed in coverage.json exist in the codebase
 *   3. summary.total_items matches sum of source item_counts
 *
 * Exit 1 if any mismatch is found.
 */

import Database from "better-sqlite3";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env["SE_ENERGY_DB_PATH"] ?? join(__dirname, "..", "data", "se-energy.db");
const COVERAGE_PATH = join(__dirname, "..", "data", "coverage.json");
const SRC_DIR = join(__dirname, "..", "src");

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

const errors: string[] = [];

// 1. Check item counts
const SOURCE_QUERIES: Record<string, string> = {
  ei: "SELECT COUNT(*) as c FROM regulations WHERE regulator_id = 'ei'",
  elsakerhetsverket: "SELECT COUNT(*) as c FROM regulations WHERE regulator_id = 'elsakerhetsverket'",
  svenska_kraftnat: "SELECT COUNT(*) as c FROM grid_codes",
  energimyndigheten: "SELECT COUNT(*) as c FROM decisions",
};

let actualTotal = 0;
for (const src of coverage.sources) {
  const query = SOURCE_QUERIES[src.id as string];
  if (query) {
    const actual = count(query);
    actualTotal += actual;
    if (src.item_count !== actual) {
      errors.push(`Source "${src.id}": coverage.json says ${src.item_count}, DB has ${actual}`);
    }
  }
}

// 2. Check tools exist in codebase
const srcFiles: string[] = [];
function collectSrcFiles(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSrcFiles(full);
    } else if (entry.endsWith(".ts")) {
      srcFiles.push(readFileSync(full, "utf-8"));
    }
  }
}
collectSrcFiles(SRC_DIR);

const allSrc = srcFiles.join("\n");
for (const tool of coverage.tools) {
  if (!allSrc.includes(tool.name)) {
    errors.push(`Tool "${tool.name}" listed in coverage.json but not found in src/`);
  }
}

// 3. Check summary totals
const declaredTotal = coverage.sources.reduce((sum: number, s: { item_count: number }) => sum + s.item_count, 0);
if (coverage.summary.total_items !== declaredTotal) {
  errors.push(`summary.total_items (${coverage.summary.total_items}) does not match sum of source item_counts (${declaredTotal})`);
}

db.close();

if (errors.length > 0) {
  console.error("Coverage verification FAILED:\n");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log("Coverage verification passed.");
  console.log(`  Sources: ${coverage.sources.length}`);
  console.log(`  Items:   ${declaredTotal} (matches DB)`);
  console.log(`  Tools:   ${coverage.tools.length} (all found in codebase)`);
}
