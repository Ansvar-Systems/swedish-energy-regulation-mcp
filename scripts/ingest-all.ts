/**
 * Combined ingestion for all 4 Swedish energy regulators.
 *
 * Inserts regulatory content sourced from:
 *   - Energimarknadsinspektionen (ei.se) — EIFS foreskrifter, natkoncessioner
 *   - Svenska kraftnat (svk.se) — grid codes, balancing rules, ancillary services
 *   - Energimyndigheten (energimyndigheten.se) — energy policy, elcertifikat
 *   - Elsakerhetsverket (elsakerhetsverket.se) — electrical safety rules
 *
 * Usage:
 *   npx tsx scripts/ingest-all.ts
 *   npx tsx scripts/ingest-all.ts --force   # drop and recreate
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["SE_ENERGY_DB_PATH"] ?? "data/se-energy.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

// ═══════════════════════════════════════════════════════════════
// REGULATORS
// ═══════════════════════════════════════════════════════════════

const regulators = [
  { id: "ei", name: "Energimarknadsinspektionen", full_name: "Energimarknadsinspektionen (Ei)", url: "https://ei.se", description: "Swedish Energy Markets Inspectorate — market regulator for electricity, natural gas, and district heating. Network tariff supervision, revenue cap regulation, market monitoring, consumer protection, natkoncessioner." },
  { id: "svenska_kraftnat", name: "Svenska kraftnat", full_name: "Svenska kraftnat (Swedish TSO)", url: "https://svk.se", description: "Swedish TSO — manages national electricity transmission grid, sets grid codes and technical regulations, operates balancing market, procures ancillary services, manages cross-border interconnections." },
  { id: "energimyndigheten", name: "Energimyndigheten", full_name: "Energimyndigheten (Swedish Energy Agency)", url: "https://energimyndigheten.se", description: "Swedish Energy Agency — energy policy implementation, elcertifikat, energy efficiency regulations, fornybar energi, climate reporting, energy statistics." },
  { id: "elsakerhetsverket", name: "Elsakerhetsverket", full_name: "Elsakerhetsverket (Electrical Safety Authority)", url: "https://elsakerhetsverket.se", description: "Swedish Electrical Safety Authority — electrical safety, installation regulations, product safety for electrical equipment, supervision of electrical installations." },
];

const insertReg = db.prepare("INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)");
for (const r of regulators) insertReg.run(r.id, r.name, r.full_name, r.url, r.description);
console.log(`Inserted ${regulators.length} regulators`);

// ═══════════════════════════════════════════════════════════════
// REGULATIONS (Ei + Energimyndigheten + Elsakerhetsverket)
// ═══════════════════════════════════════════════════════════════

db.prepare("DELETE FROM regulations").run();

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Data will be populated during full ingestion.
// For now, use seed-sample.ts for test data.
const allRegs: string[][] = [];

const insertRegBatch = db.transaction(() => {
  for (const r of allRegs) {
    insertRegulation.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]);
  }
});
insertRegBatch();
console.log(`Inserted ${allRegs.length} regulations`);

// ═══════════════════════════════════════════════════════════════
// GRID CODES (Svenska kraftnat)
// ═══════════════════════════════════════════════════════════════

db.prepare("DELETE FROM grid_codes").run();

const insertGridCode = db.prepare(`
  INSERT INTO grid_codes (reference, title, text, code_type, version, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Data will be populated during full ingestion.
const gridCodes: string[][] = [];

const insertGCBatch = db.transaction(() => {
  for (const g of gridCodes) {
    insertGridCode.run(g[0], g[1], g[2], g[3], g[4], g[5], g[6]);
  }
});
insertGCBatch();
console.log(`Inserted ${gridCodes.length} Svenska kraftnat grid codes`);

// ═══════════════════════════════════════════════════════════════
// DECISIONS (Ei)
// ═══════════════════════════════════════════════════════════════

db.prepare("DELETE FROM decisions").run();

const insertDecision = db.prepare(`
  INSERT INTO decisions (reference, title, text, decision_type, date_decided, parties, url) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Data will be populated during full ingestion.
const decisions: string[][] = [];

const insertDecBatch = db.transaction(() => {
  for (const d of decisions) {
    insertDecision.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6]);
  }
});
insertDecBatch();
console.log(`Inserted ${decisions.length} Ei decisions`);

// ═══════════════════════════════════════════════════════════════
// REBUILD FTS INDEXES
// ═══════════════════════════════════════════════════════════════

db.exec("INSERT INTO regulations_fts(regulations_fts) VALUES('rebuild')");
db.exec("INSERT INTO grid_codes_fts(grid_codes_fts) VALUES('rebuild')");
db.exec("INSERT INTO decisions_fts(decisions_fts) VALUES('rebuild')");

// ═══════════════════════════════════════════════════════════════
// DB METADATA
// ═══════════════════════════════════════════════════════════════

db.exec(`CREATE TABLE IF NOT EXISTS db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
)`);

const stats = {
  regulators: (db.prepare("SELECT count(*) as n FROM regulators").get() as { n: number }).n,
  regulations: (db.prepare("SELECT count(*) as n FROM regulations").get() as { n: number }).n,
  grid_codes: (db.prepare("SELECT count(*) as n FROM grid_codes").get() as { n: number }).n,
  decisions: (db.prepare("SELECT count(*) as n FROM decisions").get() as { n: number }).n,
  ei: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'ei'").get() as { n: number }).n,
  elsak: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'elsakerhetsverket'").get() as { n: number }).n,
  emyn: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'energimyndigheten'").get() as { n: number }).n,
};

const insertMeta = db.prepare("INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)");
insertMeta.run("schema_version", "1.0");
insertMeta.run("tier", "free");
insertMeta.run("domain", "swedish-energy-regulation");
insertMeta.run("build_date", new Date().toISOString().split("T")[0]);
insertMeta.run("regulations_count", String(stats.regulations));
insertMeta.run("grid_codes_count", String(stats.grid_codes));
insertMeta.run("decisions_count", String(stats.decisions));
insertMeta.run("total_records", String(stats.regulations + stats.grid_codes + stats.decisions));

console.log(`\nDatabase summary:`);
console.log(`  Regulators:         ${stats.regulators}`);
console.log(`  Regulations:        ${stats.regulations} (Ei: ${stats.ei}, Elsak: ${stats.elsak}, EMYN: ${stats.emyn})`);
console.log(`  Grid codes:         ${stats.grid_codes} (Svenska kraftnat)`);
console.log(`  Decisions:          ${stats.decisions} (Ei)`);
console.log(`  Total documents:    ${stats.regulations + stats.grid_codes + stats.decisions}`);
console.log(`\nDone. Database at ${DB_PATH}`);

db.close();
