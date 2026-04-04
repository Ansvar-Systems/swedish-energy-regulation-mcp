/**
 * Freshness checker for the Swedish Energy Regulation MCP.
 *
 * Reads data/coverage.json, checks each source's last_refresh against
 * refresh_frequency, writes .freshness-stale (true/false) and
 * .freshness-report (markdown summary).
 *
 * Exit 0 always — staleness is informational, not a build failure.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COVERAGE_PATH = join(__dirname, "..", "data", "coverage.json");

interface Source {
  id: string;
  name: string;
  last_refresh: string;
  refresh_frequency: string;
}

interface Coverage {
  sources: Source[];
}

const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

const raw = readFileSync(COVERAGE_PATH, "utf-8");
const coverage: Coverage = JSON.parse(raw);

const lines: string[] = ["# Freshness Report", "", `Generated: ${new Date().toISOString()}`, "", "| Source | Last Refresh | Frequency | Age (days) | Status |", "|--------|-------------|-----------|------------|--------|"];

let anyStale = false;

for (const src of coverage.sources) {
  const age = daysSince(src.last_refresh);
  const maxAge = FREQUENCY_DAYS[src.refresh_frequency] ?? 90;
  const stale = age > maxAge;
  if (stale) anyStale = true;
  const status = stale ? "STALE" : "OK";
  lines.push(`| ${src.name} | ${src.last_refresh} | ${src.refresh_frequency} | ${age} | ${status} |`);
}

lines.push("");
lines.push(anyStale ? "**Result: STALE** — one or more sources need a refresh." : "**Result: FRESH** — all sources within refresh window.");

const report = lines.join("\n");
const rootDir = join(__dirname, "..");

writeFileSync(join(rootDir, ".freshness-stale"), String(anyStale));
writeFileSync(join(rootDir, ".freshness-report"), report);

console.log(report);
console.log(`\nWrote .freshness-stale (${anyStale}) and .freshness-report`);
