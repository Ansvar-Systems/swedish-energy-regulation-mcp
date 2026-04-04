/**
 * Seed the Swedish Energy Regulation database with sample data for testing.
 *
 * Inserts representative regulations, grid codes, and decisions from:
 *   - Energimarknadsinspektionen (Ei) (market regulation, EIFS)
 *   - Energimyndigheten (energy policy, elcertifikat)
 *   - Svenska kraftnat (grid codes, balancing rules)
 *   - Elsakerhetsverket (electrical safety)
 *
 * Usage:
 *   npx tsx scripts/seed-sample.ts
 *   npx tsx scripts/seed-sample.ts --force   # drop and recreate
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "../src/db.js";

const DB_PATH = process.env["SE_ENERGY_DB_PATH"] ?? "data/se-energy.db";
const force = process.argv.includes("--force");

const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

if (force && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log(`Deleted existing database at ${DB_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

console.log(`Database initialised at ${DB_PATH}`);

// -- Regulators --

const regulators = [
  {
    id: "ei",
    name: "Energimarknadsinspektionen",
    full_name: "Energimarknadsinspektionen (Ei)",
    url: "https://ei.se",
    description:
      "Swedish Energy Markets Inspectorate — market regulator for electricity, natural gas, and district heating. Responsible for network tariff supervision, revenue cap regulation, market monitoring, consumer protection, and licensing (natkoncessioner).",
  },
  {
    id: "svenska_kraftnat",
    name: "Svenska kraftnat",
    full_name: "Svenska kraftnat (Swedish TSO)",
    url: "https://svk.se",
    description:
      "Swedish transmission system operator — manages the national electricity transmission grid, sets grid codes and technical regulations, operates the balancing market, procures ancillary services, and manages cross-border interconnections.",
  },
  {
    id: "energimyndigheten",
    name: "Energimyndigheten",
    full_name: "Energimyndigheten (Swedish Energy Agency)",
    url: "https://energimyndigheten.se",
    description:
      "Swedish Energy Agency — responsible for energy policy implementation, elcertifikat (renewable energy certificates), energy efficiency regulations, climate reporting, and energy statistics.",
  },
  {
    id: "elsakerhetsverket",
    name: "Elsakerhetsverket",
    full_name: "Elsakerhetsverket (Electrical Safety Authority)",
    url: "https://elsakerhetsverket.se",
    description:
      "Swedish Electrical Safety Authority — responsible for electrical safety, installation regulations, product safety for electrical equipment, and supervision of electrical installations.",
  },
];

const insertRegulator = db.prepare(
  "INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)",
);

for (const r of regulators) {
  insertRegulator.run(r.id, r.name, r.full_name, r.url, r.description);
}
console.log(`Inserted ${regulators.length} regulators`);

// -- Regulations (Ei + Energimyndigheten + Elsakerhetsverket) --

const regulations = [
  // Ei
  {
    regulator_id: "ei",
    reference: "EIFS 2022:1",
    title: "Energimarknadsinspektionens foreskrifter om berakningsmetoder for bestammande av intaktsram for elnatsforetag",
    text: "Dessa foreskrifter innehaller bestammelser om de berakningsmetoder som ska tillampas for att bestamma intaktsramar for elnatsforetag under tillsynsperioden 2024-2027. Foreskrifterna reglerar hur kapitalbasen beraknas, vilka avskrivningstider som galler, hur kalkylrantan faststalls, och vilka drifts- och underhallskostnader som far inkluderas. Ei tillsynar att elnatsforetagens natavgifter ar skaligas och att intaktsramarna inte overskrids.",
    type: "foreskrift",
    status: "in_force",
    effective_date: "2022-07-01",
    url: "https://ei.se/om-oss/foreskrifter/eifs-2022-1",
  },
  {
    regulator_id: "ei",
    reference: "EIFS 2021:6",
    title: "Energimarknadsinspektionens foreskrifter om natkoncessioner",
    text: "Dessa foreskrifter reglerar ansokningsforfarandet for natkoncessioner (tillstand att bygga och driva elnat). Foreskrifterna anger vilka uppgifter en anskan ska innehalla, vilka handlingar som ska bifogas, och hur samrad med sakagare och myndigheter ska genomforas. Ei prövar ansokningar och beviljar natkoncessioner for linje (transmission) och omrade (distribution). En natkoncession galler normalt i 40 ar.",
    type: "foreskrift",
    status: "in_force",
    effective_date: "2021-12-01",
    url: "https://ei.se/om-oss/foreskrifter/eifs-2021-6",
  },
  // Energimyndigheten
  {
    regulator_id: "energimyndigheten",
    reference: "SFS 2011:1200",
    title: "Lag om elcertifikat",
    text: "Lagen om elcertifikat syftar till att framja produktionen av fornybar el i Sverige. Elproducenter som producerar el fran sol, vind, vatten (under 1,5 MW), biobransle, geotermisk energi eller vagorenergi har ratt att fa elcertifikat for varje producerad MWh. Elleverantorer och vissa elanvandare har kvotplikt att kopa en andel elcertifikat. Energimyndigheten administrerar elcertifikatsystemet, utfardar certifikat och overvakar marknaden. Systemet ar gemensamt med Norge sedan 2012.",
    type: "forordning",
    status: "in_force",
    effective_date: "2012-01-01",
    url: "https://riksdagen.se/sv/dokument-lagar/dokument/svensk-forfattningssamling/lag-20111200-om-elcertifikat_sfs-2011-1200",
  },
  {
    regulator_id: "energimyndigheten",
    reference: "STEMFS 2022:3",
    title: "Statens energimyndighets foreskrifter om energideklarationer for byggnader",
    text: "Dessa foreskrifter reglerar krav pa energideklarationer for byggnader i Sverige. Byggnadsagare ska lata utfora energideklaration vid forsaljning, uthyrning eller uppforande av byggnader. Energideklarationen ska innehalla uppgifter om byggnadstyp, uppvarmd area, energianvandning, energiprestanda, och rekommenderade atgarder for att forbattra energieffektiviteten. Energimyndigheten overvakar systemet och for register over energideklarationer.",
    type: "foreskrift",
    status: "in_force",
    effective_date: "2022-09-01",
    url: "https://energimyndigheten.se/foreskrifter/stemfs-2022-3",
  },
  // Elsakerhetsverket
  {
    regulator_id: "elsakerhetsverket",
    reference: "ELSAK-FS 2022:1",
    title: "Elsakerhetsverkets foreskrifter om elinstallationsforetag och om utforande av elinstallationsarbete",
    text: "Dessa foreskrifter reglerar krav pa elinstallationsforetag och utforande av elinstallationsarbete i Sverige. Foretag som utfor elinstallationsarbete ska vara registrerade hos Elsakerhetsverket och ha en utsedd elinstallator med ratt behorighet. Foreskrifterna anger vilka arbeten som kraver behorighet, vilka egenkontrollprogram som ska finnas, och hur dokumentation av utfort arbete ska ske. Elsakerhetsverket utfar tillsyn over efterlevnaden.",
    type: "foreskrift",
    status: "in_force",
    effective_date: "2022-07-01",
    url: "https://elsakerhetsverket.se/foreskrifter/elsak-fs-2022-1",
  },
];

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRegsAll = db.transaction(() => {
  for (const r of regulations) {
    insertRegulation.run(
      r.regulator_id, r.reference, r.title, r.text, r.type, r.status, r.effective_date, r.url,
    );
  }
});
insertRegsAll();
console.log(`Inserted ${regulations.length} regulations`);

// -- Grid codes (Svenska kraftnat) --

const gridCodes = [
  {
    reference: "SvKFS 2005:2",
    title: "Svenska kraftnats foreskrifter om driftssakerhetsteknisk utformning av produktionsanlaggningar",
    text: "Dessa foreskrifter anger krav pa driftssakerhetsteknisk utformning av produktionsanlaggningar som ansluts till transmissionsnatet. Kraven omfattar aktiv och reaktiv effektreglering, frekvensrespons, spanningsreglering, felgenomridningsformaga (fault ride-through), elkvalitet, och kommunikation med driftcentralen. Kraftverken ska kunna leverera spanningsstod vid natfel och aterga till normal drift inom specificerad tid. Galler vindkraft, solkraft, vattenkraft och termiska kraftverk.",
    code_type: "technical_regulation",
    version: "2.0",
    effective_date: "2023-01-01",
    url: "https://svk.se/aktorsportalen/tekniska-krav/",
  },
  {
    reference: "SvKFS 2022:1",
    title: "Svenska kraftnats foreskrifter om balansansvar",
    text: "Dessa foreskrifter reglerar villkor och skyldigheter for balansansvariga foretag pa den svenska elmarknaden. Balansansvariga ska sakerstalla balans mellan forbrukning och produktion i sin porfolj och avraknas for obalanser. Foreskrifterna reglerar anmalan av handelsplaner, avrakning av reglerkraft, och krav pa datarapportering. Svenska kraftnat administrerar balansmarknaden och utfor upp- och nedreglering for att upprathalla systembalansen.",
    code_type: "balancing",
    version: "3.0",
    effective_date: "2022-07-01",
    url: "https://svk.se/aktorsportalen/balansansvar/",
  },
  {
    reference: "SvK TR 2023:1",
    title: "Tekniska riktlinjer for natanslutning av forbrukningsanlaggningar",
    text: "Dessa tekniska riktlinjer anger krav for anslutning av stora forbrukningsanlaggningar till transmissionsnatet. Kraven omfattar reaktiv effektkompensation, spanningskvalitet, harmonisk emission, frekvensstabilitet, och automatisk frankobling vid under- eller overspanning. Anslutning kraver en anslutningsavtal med Svenska kraftnat, teknisk forutredning och godkannande av skyddsinstellningar.",
    code_type: "grid_connection",
    version: "1.0",
    effective_date: "2023-06-01",
    url: "https://svk.se/aktorsportalen/natanslutning/",
  },
];

const insertGridCode = db.prepare(`
  INSERT INTO grid_codes (reference, title, text, code_type, version, effective_date, url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertGridAll = db.transaction(() => {
  for (const g of gridCodes) {
    insertGridCode.run(g.reference, g.title, g.text, g.code_type, g.version, g.effective_date, g.url);
  }
});
insertGridAll();
console.log(`Inserted ${gridCodes.length} grid codes`);

// -- Decisions (Ei) --

const decisions = [
  {
    reference: "Ei/2024/EL/001",
    title: "Beslut om intaktsram for Vattenfall Eldistribution AB for tillsynsperioden 2024-2027",
    text: "Energimarknadsinspektionen har faststallt intaktsramen for Vattenfall Eldistribution AB for tillsynsperioden 2024-2027. Intaktsramen uppgar till 28 500 MSEK baserat pa kapitalbasen, kalkylrantan, avskrivningar och godkanda drifts- och underhallskostnader. Ei har stallt krav pa effektiviseringar av driftskostnader om 1,5% arligen. Beslutet kan overklagas till forvaltningsdomstolen inom tre veckor.",
    decision_type: "revenue_cap",
    date_decided: "2024-03-15",
    parties: "Vattenfall Eldistribution AB",
    url: "https://ei.se/bransch/elnatsreglering",
  },
  {
    reference: "Ei/2024/TILLSTAND/012",
    title: "Beslut om natkoncession for linje — 400 kV ledning Ekhyddan-Nybro-Hemsjö",
    text: "Energimarknadsinspektionen har beviljat natkoncession for linje for en ny 400 kV kraftledning mellan Ekhyddan, Nybro och Hemsjö i sodra Sverige. Koncessionen galler i 40 ar. Ledningen ar nodvandig for att forstarkas overforingkapaciteten i sodra Sverige och mojliggora anslutning av ny fornybar elproduktion. Ei har bedömt att behovet av ledningen overväger intrånget i enskilda intressen och allmanna intressen sasom naturvard.",
    decision_type: "tariff",
    date_decided: "2024-06-01",
    parties: "Svenska kraftnat",
    url: "https://ei.se/bransch/natkoncessioner",
  },
  {
    reference: "Ei/2023/KLAGOMÅL/045",
    title: "Beslut i tillsynsarende om natavgifter — Ellevio AB",
    text: "Energimarknadsinspektionen har granskat Ellevio AB:s natavgifter efter klagomal fran flera foretag i Stockholmsomradet. Ei konstaterar att natavgifterna i huvudsak ar skaliiga och i overensstammelse med den fastsattda intaktsramen. Ei papekar dock att transparensen i tariffstrukturen kan forbattras, sarskilt avseende fordelningen mellan fast och rorlig avgift. Ei foljer upp foretaget inom sex manader.",
    decision_type: "complaint",
    date_decided: "2023-11-22",
    parties: "Ellevio AB, klagande foretag (anonymiserade)",
    url: "https://ei.se/bransch/elnatsreglering",
  },
];

const insertDecision = db.prepare(`
  INSERT INTO decisions (reference, title, text, decision_type, date_decided, parties, url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertDecAll = db.transaction(() => {
  for (const d of decisions) {
    insertDecision.run(d.reference, d.title, d.text, d.decision_type, d.date_decided, d.parties, d.url);
  }
});
insertDecAll();
console.log(`Inserted ${decisions.length} decisions`);

// -- Metadata --

db.exec(`INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('build_date', '${new Date().toISOString().split("T")[0]}')`);
db.exec(`INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('schema_version', '1.0')`);
db.exec(`INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('tier', 'free')`);
db.exec(`INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('domain', 'swedish-energy-regulation')`);

// -- Summary --

const stats = {
  regulators: (db.prepare("SELECT count(*) as cnt FROM regulators").get() as { cnt: number }).cnt,
  regulations: (db.prepare("SELECT count(*) as cnt FROM regulations").get() as { cnt: number }).cnt,
  grid_codes: (db.prepare("SELECT count(*) as cnt FROM grid_codes").get() as { cnt: number }).cnt,
  decisions: (db.prepare("SELECT count(*) as cnt FROM decisions").get() as { cnt: number }).cnt,
  regulations_fts: (db.prepare("SELECT count(*) as cnt FROM regulations_fts").get() as { cnt: number }).cnt,
  grid_codes_fts: (db.prepare("SELECT count(*) as cnt FROM grid_codes_fts").get() as { cnt: number }).cnt,
  decisions_fts: (db.prepare("SELECT count(*) as cnt FROM decisions_fts").get() as { cnt: number }).cnt,
};

console.log(`\nDatabase summary:`);
console.log(`  Regulators:       ${stats.regulators}`);
console.log(`  Regulations:      ${stats.regulations} (FTS: ${stats.regulations_fts})`);
console.log(`  Grid codes:       ${stats.grid_codes} (FTS: ${stats.grid_codes_fts})`);
console.log(`  Decisions:        ${stats.decisions} (FTS: ${stats.decisions_fts})`);
console.log(`\nDone. Database ready at ${DB_PATH}`);

db.close();
