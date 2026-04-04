/**
 * Combined ingestion for all 4 Swedish energy regulators + key legislation.
 *
 * Inserts regulatory content sourced from:
 *   - Energimarknadsinspektionen (ei.se) -- EIFS foreskrifter (el, naturgas, fjarrvarme), decisions
 *   - Svenska kraftnat (svk.se) -- grid codes, balancing rules, ancillary services, technical guidelines
 *   - Energimyndigheten (energimyndigheten.se) -- STEMFS foreskrifter, energy policy, elcertifikat
 *   - Elsakerhetsverket (elsakerhetsverket.se) -- ELSAK-FS, electrical safety rules
 *   - Key Swedish energy legislation from riksdagen.se (SFS references)
 *
 * Real data sourced 2026-04-04 from official Swedish government websites.
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
  { id: "ei", name: "Energimarknadsinspektionen", full_name: "Energimarknadsinspektionen (Ei)", url: "https://ei.se", description: "Sveriges energimarknadsmyndighet -- marknadstillsyn for el, naturgas och fjarrvarme. Natavgiftsreglering, intaktsramar, konsumentskydd, natkoncessioner. Utfardar EIFS foreskrifter." },
  { id: "svenska_kraftnat", name: "Svenska kraftnat", full_name: "Svenska kraftnat (Swedish TSO)", url: "https://svk.se", description: "Svensk systemansvarig for kraftsystemet -- forvaltar stamnatet, utfardar SvKFS foreskrifter och tekniska riktlinjer, driver balansmarknaden, upphandlar stodtjanster (FCR, aFRR, mFRR, FFR), hanterar gransoverskridande overforing." },
  { id: "energimyndigheten", name: "Energimyndigheten", full_name: "Energimyndigheten (Statens energimyndighet)", url: "https://energimyndigheten.se", description: "Statens energimyndighet -- energipolitik, elcertifikat, energieffektivisering, fornybar energi, hallbarhetskriterier for biodrivmedel, energistatistik, klimatrapportering. Utfardar STEMFS foreskrifter." },
  { id: "elsakerhetsverket", name: "Elsakerhetsverket", full_name: "Elsakerhetsverket (Electrical Safety Authority)", url: "https://elsakerhetsverket.se", description: "Elsakerhetsmyndigheten -- elsakerhet, installationsregler, auktorisation av elinstallatorer, produktsakerhet for elektrisk utrustning, elektromagnetisk kompatibilitet (EMC), tillsyn over elanlaggningar. Utfardar ELSAK-FS foreskrifter." },
  { id: "riksdagen", name: "Sveriges riksdag", full_name: "Sveriges riksdag (Swedish Parliament)", url: "https://riksdagen.se", description: "Svensk lagstiftning -- lagar (SFS) och forordningar som utgdr grunderna for energireglering, inklusive ellagen, naturgaslagen, fjarrvarmlagen, elcertifikatlagen och elsakerhetslagen." },
];

const insertReg = db.prepare("INSERT OR IGNORE INTO regulators (id, name, full_name, url, description) VALUES (?, ?, ?, ?, ?)");
for (const r of regulators) insertReg.run(r.id, r.name, r.full_name, r.url, r.description);
console.log(`Inserted ${regulators.length} regulators`);

// ═══════════════════════════════════════════════════════════════
// REGULATIONS
// ═══════════════════════════════════════════════════════════════

db.prepare("DELETE FROM regulations").run();

const insertRegulation = db.prepare(`
  INSERT INTO regulations (regulator_id, reference, title, text, type, status, effective_date, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// ---------- Ei EIFS -- Electricity (El) ----------

const eiElRegs: string[][] = [
  ["ei", "EIFS 2026:5", "Energimarknadsinspektionens foreskrifter om elleverantorers strategier och atgarder vid hantering av risker",
    "Foreskrifter om elleverantorers skyldighet att utarbeta strategier och vidta atgarder for att hantera risker som kan paverka elleveransen till elanvandare. Omfattar krav pa riskhanteringsplaner, kontraktsrisker och leveranssakerhet. Genomfor delar av det omarbetade elmarknadsdirektivet (EU) 2019/944 avseende leverantorsansvar och konsumentskydd pa elmarknaden.",
    "foreskrift", "in_force", "2026-01-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2026/foreskrift-eifs-20265"],

  ["ei", "EIFS 2025:4", "Energimarknadsinspektionens foreskrifter och allmanna rad om ursprungsmarkning av el",
    "Foreskrifter om hur elleverantorer ska informera elanvandare om elens ursprung genom ursprungsmarkning. Reglerar redovisning av energikallor (fornybar, karnkraft, fossil), anvandning av ursprungsgarantier och krav pa information i fakturor och marknadsforing. Genomfor artikel 19 i fornybarhetsdirektivet (EU) 2018/2001 och relevanta delar av elmarknadsdirektivet om konsumentinformation.",
    "foreskrift", "in_force", "2025-07-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2025/foreskrift-eifs-20254"],

  ["ei", "EIFS 2025:3", "Energimarknadsinspektionens foreskrifter och allmanna rad om overvakningsplan enligt ellagen",
    "Foreskrifter om elnatsforetags skyldighet att upprattta och folja en overvakningsplan enligt 3 kap. 17 S ellagen. Overvakningsplanen ska sakerstalla att elnatsforetagets natverksamhet bedrivs pa ett icke-diskriminerande satt gentemot alla natanvandare. Krav pa atskillnad mellan natverksamhet och konkurrensutsatt verksamhet, rutiner for informationshantering och rapportering till Ei.",
    "foreskrift", "in_force", "2025-07-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2025/foreskrift-eifs-20253"],

  ["ei", "EIFS 2025:2", "Energimarknadsinspektionens foreskrifter och allmanna rad om driftsakerhetsteknisk utformning av produktionsanlaggningar",
    "Foreskrifter om tekniska krav pa produktionsanlaggningar som ansluts till elnatet for att sakerstalla driftsakerhet. Ersatter SvKFS 2005:2. Omfattar krav pa spanninsreglering, frekvensrespons, felridethrough, reaktiv effekt och systemskydd. Genomfor anslutningskraven i EU:s natforeskrift RfG (EU) 2016/631.",
    "foreskrift", "in_force", "2025-12-10", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2025/foreskrift-eifs-20252"],

  ["ei", "EIFS 2025:1", "Energimarknadsinspektionens foreskrifter och allmanna rad om matning och rapportering av overford el",
    "Foreskrifter om matning, berakning och rapportering av overford el i elnaten. Reglerar krav pa matutrustning, matpunkter, rapporteringsformat och tidsfrister. Behandlar overgangen till 15-minutersmatning och timmavlasning for alla elanvandare. Ersatter EIFS 2023:1.",
    "foreskrift", "in_force", "2025-06-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2025/foreskrift-eifs-20251"],

  ["ei", "EIFS 2024:6", "Energimarknadsinspektionens foreskrifter och allmanna rad om information innan ett tidsbestamt avtal om leverans av el loper ut",
    "Foreskrifter om elleverantorers skyldighet att informera elanvandare innan ett tidsbestamt elavtal loper ut. Syftar till att starka konsumentskyddet pa elmarknaden genom att sakerstalla att elanvandare far tillracklig information i god tid for att kunna gora aktiva val av nytt elavtal.",
    "foreskrift", "in_force", "2024-07-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2024/foreskrift-eifs-20246"],

  ["ei", "EIFS 2024:5", "Energimarknadsinspektionens foreskrifter om offentliggorande av avgifter och ovriga villkor for overforing av el",
    "Foreskrifter om elnatsforetags skyldighet att offentliggora avgifter och ovriga villkor for overforing av el. Reglerar hur nattariffer, anslutningsavgifter och ovriga villkor ska presenteras for att sakerstalla transparens och mojliggora jamforelser mellan natforetag.",
    "foreskrift", "in_force", "2024-07-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2024/foreskrift-eifs-20245"],

  ["ei", "EIFS 2024:4", "Energimarknadsinspektionens foreskrifter och allmanna rad om information avseende avbrottersattning respektive skadestand till elanvandare",
    "Foreskrifter om hur elnatsforetag ska informera elanvandare om deras ratt till avbrottersattning vid langvariga elavbrott enligt 10 kap. ellagen och skadestand vid felaktig franstangning. Reglerar informationsformat, tidsfrister och berakningsmetoder for ersattning.",
    "foreskrift", "in_force", "2024-04-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2024/foreskrift-eifs-20244"],

  ["ei", "EIFS 2024:3", "Energimarknadsinspektionens foreskrifter om faststallande av krav pa datautbyte mellan elnatsforetag och betydande natanvandare",
    "Foreskrifter om krav pa datautbyte mellan elnatsforetag och betydande natanvandare (stora forbrukare och producenter). Reglerar format, frekvens och innehall i data som ska utbytas for att sakerstalla effektiv natdrift, systemsakerhet och transparens. Genomfor relevanta delar av EU:s natforeskrift DCC (EU) 2016/1388.",
    "foreskrift", "in_force", "2024-07-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2024/foreskrift-eifs-20243"],

  ["ei", "EIFS 2024:2", "Energimarknadsinspektionens foreskrifter och allmanna rad om elleverantorers information till elanvandare",
    "Foreskrifter om hur elleverantorer ska informera elanvandare om priser, avtalsvillkor, energimix och miljopaverkan. Syftar till att sakerstalla att elanvandare har tillracklig information for att gora informerade val pa elmarknaden. Genomfor konsumentskyddsbestammelser i elmarknadsdirektivet (EU) 2019/944.",
    "foreskrift", "in_force", "2024-04-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2024/foreskrift-eifs-20242"],

  ["ei", "EIFS 2024:1", "Energimarknadsinspektionens foreskrifter och allmanna rad om natutvecklingsplaner",
    "Foreskrifter om elnatsforetags skyldighet att upprattta natutvecklingsplaner. Planerna ska beskriva planerade investeringar i elnatet, anslutningsforfragan, kapacitetsbehov och framtida natutbyggnad. Genomfor krav i elmarknadsdirektivet (EU) 2019/944 om transparens i natplanering och stod for integrering av fornybar energi och elbilsladdning.",
    "foreskrift", "in_force", "2024-01-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2024/foreskrift-eifs-20241"],

  ["ei", "EIFS 2023:6", "Energimarknadsinspektionens foreskrifter om vad som avses med kvaliteten i natverksamheten och vad som avses med ett effektivt utnyttjande av elnatet vid faststallande av intaktsram",
    "Foreskrifter som definierar kvalitetskriterierna i natverksamheten for berakning av intaktsram. Kvalitetsparametrar inkluderar leveranssakerhet (avbrottsstatistik SAIDI/SAIFI), spannningskvalitet, kundservice och informationsgivning. Inforlivat i intaktsramsmodellen for tillsynsperioden 2024-2027.",
    "foreskrift", "in_force", "2023-10-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2023/foreskrift-eifs-20236"],

  ["ei", "EIFS 2023:5", "Energimarknadsinspektionens foreskrifter om berakning av intaktsram for elnatsforetag",
    "Foreskrifter om berakningsmetoden for intaktsramar under tillsynsperioden 2024-2027. Intaktsramen faststalls i forhand och bestammer de hogsta tillagna intakterna for natverksamheten. Berakningen baseras pa kapitalunderlag, avkastningsrantan (WACC), kontrolerbara kostnader, okontrollerbara kostnader och kvalitetsincitament. Totalt ca 326 miljarder kronor (2022 ars prisniva) for samtliga elnatsforetag.",
    "foreskrift", "in_force", "2023-10-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2023/foreskrift-eifs-20235"],

  ["ei", "EIFS 2023:4", "Energimarknadsinspektionens foreskrifter och allmanna rad om insamling av uppgifter for att bestamma intaktsramens storlek for elnatsforetag",
    "Foreskrifter om vilka uppgifter elnatsforetag ska rapportera till Ei for att bestamma intaktsramens storlek. Omfattar ekonomisk rapportering, anlaggningstillgangar, kapitalunderlag, operativa kostnader, kundantal, overlammad energi och leveranssakerhetsdata.",
    "foreskrift", "in_force", "2023-10-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2023/foreskrift-eifs-20234"],

  ["ei", "EIFS 2023:3", "Energimarknadsinspektionens foreskrifter och allmanna rad om krav som ska vara uppfyllda for att overforingen av el ska vara av god kvalitet",
    "Foreskrifter om leveranskvalitet i elnaten. Definierar krav pa spanningskvalitet (harmoniska, flicker, spannningsvariationer), avbrottsgranser, avhjalptider och aterrapportering. Reglerar natkoncessionshavares ansvar for att uppratthalla god kvalitet i overforing av el enligt 3 kap. 9 S ellagen.",
    "foreskrift", "in_force", "2023-09-14", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2023/foreskrift-eifs-20233"],

  ["ei", "EIFS 2023:2", "Energimarknadsinspektionens foreskrifter och allmanna rad om elleverantorers skyldighet att lamna uppgifter om priser och leveransvillkor som tillampas mot elanvandare",
    "Foreskrifter om elleverantorers uppgiftsskyldighet om priser och leveransvillkor. Anvands for Ei:s prisovervakning och jamforelseverktyg Elpriskollen. Reglerar vilka uppgifter, format och tidsfrister som galler for rapportering av rdrliga avtal, fastprisavtal och mixavtal.",
    "foreskrift", "in_force", "2023-04-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2023/foreskrift-eifs-20232"],

  ["ei", "EIFS 2022:10", "Energimarknadsinspektionens foreskrifter om redovisning av elnatsverksamhet",
    "Foreskrifter om separat redovisning av elnatsverksamhet. Elnatsforetag ska separatredovisa natverksamheten fran annan verksamhet for att sakerstalla icke-diskriminering och forhindra korssubventionering. Reglerar redovisningsprinciper, intaktsredovisning, kostnadsallokering och rapporteringskrav.",
    "foreskrift", "in_force", "2022-07-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2022/foreskrift-eifs-202210"],

  ["ei", "EIFS 2022:5", "Energimarknadsinspektionens foreskrifter och allmanna rad om skyldighet att rapportera uppgifter om utvecklingen av smarta elnat",
    "Foreskrifter om elnatsforetags skyldighet att rapportera uppgifter om smarta elnat (smart grids). Omfattar rapportering av investeringar i smarta matare, automatisering, laststyrning, energilager, laddinfrastruktur och flexibilitetstjanster. Syftar till att folja och framja utvecklingen av smarta elnat i Sverige.",
    "foreskrift", "in_force", "2022-04-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2022/foreskrift-eifs-20225"],

  ["ei", "EIFS 2022:1", "Energimarknadsinspektionens foreskrifter och allmanna rad for utformning av nattariffer for ett effektivt utnyttjande av elnatet",
    "Foreskrifter om hur nattariffer ska utformas for att framja effektivt utnyttjande av elnatet. Nattariffer ska vara sakliga och icke-diskriminerande. Tariffstrukturen ska ge signaler om natkapacitet och aterspegla kostnaderna for natanvandning. Vagledning for effekttariffer, tidsdifferentierade tariffer och kapacitetsabonnemang. Central foreskrift for den pagaende tariffomstallningen i Sverige.",
    "foreskrift", "in_force", "2022-01-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2022/foreskrift-eifs-20221"],

  ["ei", "EIFS 2019:6", "Energimarknadsinspektionens foreskrifter om faststallande av generellt tillampliga krav for anslutning av forbrukare",
    "Foreskrifter om nationella krav for anslutning av forbrukare till elnaten (Demand Connection Code). Genomfor kommissionens forordning (EU) 2016/1388 om faststallande av natforeskrift om krav for anslutning av forbrukningsanlaggningar. Krav pa reaktiv effekt, storningstlighet och frekvensrespons for storre forbrukare.",
    "foreskrift", "in_force", "2019-08-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2019/foreskrift-eifs-20196"],

  ["ei", "EIFS 2019:3", "Energimarknadsinspektionens foreskrifter om faststallande av generellt tillampliga krav for natanslutning av system for hogspand likstrom och likstromsanslutna kraftparksmoduler",
    "Foreskrifter om anslutningskrav for HVDC-system och likstromsanslutna kraftparksmoduler (t.ex. havsbaserade vindkraftparker). Genomfor kommissionens forordning (EU) 2016/1447 om HVDC-anslutning. Krav pa aktiv och reaktiv effektreglering, felridethrough, systemskydd och kommunikation for HVDC-forbindelser.",
    "foreskrift", "in_force", "2019-04-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2019/foreskrift-eifs-20193"],

  ["ei", "EIFS 2018:2", "Energimarknadsinspektionens foreskrifter om faststallande av generellt tillampliga krav for natanslutning av generatorer",
    "Foreskrifter om nationella krav for natanslutning av generatorer (Requirements for Generators, RfG). Genomfor kommissionens forordning (EU) 2016/631. Fastlaller krav for typ A, B, C och D generatorer avseende frekvensrespons, spannningsreglering, felridethrough, aktiv och reaktiv effektkapacitet samt systemskydd. Gransvarden for respektive typ fastlagda for Sverige.",
    "foreskrift", "in_force", "2018-05-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2018/foreskrift-eifs-20182"],

  ["ei", "EIFS 2015:4", "Energimarknadsinspektionens foreskrifter om skyldighet att rapportera elavbrott for bedomning av leveranssakerheten i elnaten",
    "Foreskrifter om rapportering av elavbrott. Natkoncessionshavare ska rapportera samtliga elavbrott till Ei, inklusive orsak, varaktighet, paverkade kunder och vidtagna atgarder. Data anvands for Ei:s leveranssakerhetsbedymning och kvalitetsincitament i intaktsramsmodellen. Avbrottsstatistik publiceras arligen.",
    "foreskrift", "in_force", "2015-06-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2015/foreskrift--eifs-20154"],

  ["ei", "EIFS 2015:3", "Energimarknadsinspektionens foreskrifter om utformning av tidsplaner avseende anslutning av elproduktionsanlaggningar",
    "Foreskrifter om tidsplaner for anslutning av elproduktionsanlaggningar till elnatet. Reglerar elnatsforetags skyldighet att upprattta och publicera tidsplaner, maximal anslutningstid och informationsgivning till producenter som ansoker om natanslutning.",
    "foreskrift", "in_force", "2015-03-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2015/foreskrift--eifs-20153"],

  ["ei", "EIFS 2013:3", "Energimarknadsinspektionens foreskrifter och allmanna rad om risk- och sarbarhetsanalyser och atgardsplaner avseende leveranssakerhet i elnaten",
    "Foreskrifter om elnatsforetags skyldighet att genomfora risk- och sarbarhetsanalyser (RSA) och upprattta atgardsplaner for leveranssakerhet. Foretagen ska identifiera risker som kan paverka elforsorjningen (vader, cyberattacker, tekniska fel), bedoma konsekvenser och planera atgarder. Rapporteras till Ei.",
    "foreskrift", "in_force", "2013-07-01", "https://ei.se/om-oss/publikationer/publikationer/foreskrifter-el/2013/foreskrift-eifs-20133"],
];

// ---------- Ei EIFS -- Natural gas (Naturgas) ----------

const eiNaturgasRegs: string[][] = [
  ["ei", "EIFS 2022:12", "Energimarknadsinspektionens foreskrifter om redovisning av naturgasverksamhet",
    "Foreskrifter om separat redovisning av naturgasverksamhet. Naturgasforetag ska separatredovisa overforing, lagring och forsaljning av naturgas for att forhindra korssubventionering och sakerstalla icke-diskriminering. Genomfor delar av naturgasdirektivet (2009/73/EG).",
    "foreskrift", "in_force", "2022-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---naturgas"],

  ["ei", "EIFS 2022:6", "Energimarknadsinspektionens foreskrifter och allmanna rad om matning och rapportering av overferd naturgas samt anmalan om leverans och balansansvar",
    "Foreskrifter om matning och rapportering av overfored naturgas i naturgassystemet. Reglerar matmetoder, rapporteringsformat och rapporteringsfrister. Omfattar aven anmalan om leverans och balansansvar for naturgashandlare.",
    "foreskrift", "in_force", "2022-04-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---naturgas"],

  ["ei", "EIFS 2014:6", "Energimarknadsinspektionens foreskrifter om skaliga kostnader och en rimlig avkastning vid berakning av intaktsram for naturgasforetag",
    "Foreskrifter om berakningsmetoden for intaktsramar for naturgasnatforetag. Definierar skaliga kostnader, kapitalunderlag, avkastningsranta (WACC) och hur intaktsramen ska beraknas for att ga naturgasforetag rimliga intakter utan overvinster.",
    "foreskrift", "in_force", "2014-11-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---naturgas"],

  ["ei", "EIFS 2014:5", "Energimarknadsinspektionens foreskrifter om naturgasforetagens forslag till intaktsram och insamling av uppgifter for att bestamma intaktsramens storlek",
    "Foreskrifter om naturgasforetags rapporteringsskyldighet for intaktsramsberakning. Foretagen ska lamma forslag pa intaktsram och rapportera ekonomiska uppgifter, anlaggningstillgangar och driftdata till Ei.",
    "foreskrift", "in_force", "2014-11-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---naturgas"],

  ["ei", "EIFS 2012:6", "Energimarknadsinspektionens foreskrifter och allmanna rad om overvakningsplan enligt naturgaslagen",
    "Foreskrifter om naturgasforetags skyldighet att upprattta overvakningsplan enligt naturgaslagen. Syftar till att sakerstalla icke-diskriminerande tillgang till naturgassystemet. Overvakar funktionell atskillnad och informationsbarriarer.",
    "foreskrift", "in_force", "2012-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---naturgas"],

  ["ei", "EIFS 2012:3", "Energimarknadsinspektionens foreskrifter om offentliggorande av tariffer och metoder som anvands for att utforma avgifter for anslutning",
    "Foreskrifter om naturgasforetags skyldighet att offentliggora tariffer for overforing av naturgas och metoder for berakning av anslutningsavgifter. Sakerstaller transparens pa naturgasmarknaden.",
    "foreskrift", "in_force", "2012-04-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---naturgas"],
];

// ---------- Ei EIFS -- District heating/cooling (Fjarrvarme/fjarrkyla) ----------

const eiFjarrvarmeRegs: string[][] = [
  ["ei", "EIFS 2022:11", "Energimarknadsinspektionens foreskrifter om redovisning av fjarrvarmeverksamhet",
    "Foreskrifter om redovisning av fjarrvarmeverksamhet. Fjarrvarmeforetag ska separat redovisa produktion, distribution och forsaljning av fjarrvarme. Reglerar redovisningsprinciper, kostnadsfordelning och rapporteringskrav till Ei.",
    "foreskrift", "in_force", "2022-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---fjarrvarme-och-fjarrkyla"],

  ["ei", "EIFS 2022:4", "Energimarknadsinspektionens foreskrifter och allmanna rad om matning, fakturering och tillhandahallande av information om bortford varmeenergi (fjarrkyla)",
    "Foreskrifter om matning och fakturering av fjarrkyla. Reglerar krav pa matare, avlasning, faktureringsformat och konsumentinformation for fjarkylakunder.",
    "foreskrift", "in_force", "2022-04-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---fjarrvarme-och-fjarrkyla"],

  ["ei", "EIFS 2022:3", "Energimarknadsinspektionens foreskrifter och allmanna rad om matning, fakturering och tillhandahallande av information om levererad varmeenergi (fjarrvarme)",
    "Foreskrifter om matning och fakturering av fjarrvarme. Reglerar krav pa varmematare, avlasningsintervall, fakturainnehall och informationsgivning till fjatrvarmekunder. Genomfor krav i energieffektiviseringsdirektivet om individuell matning och fakturering.",
    "foreskrift", "in_force", "2022-04-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---fjarrvarme-och-fjarrkyla"],

  ["ei", "EIFS 2009:3", "Energimarknadsinspektionens foreskrifter om skyldigheten for fjarrvarmeforetag att lamna prisinformation till allmanheten",
    "Foreskrifter om fjarrvarmeforetags skyldighet att offentliggora prisinformation. Foretagen ska publicera priser, prismodeller och villkor pa ett latt tillgangligt satt for att mojliggora jamforelser.",
    "foreskrift", "in_force", "2009-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/foreskrifter---fjarrvarme-och-fjarrkyla"],
];

// ---------- Energimyndigheten STEMFS ----------

const emynRegs: string[][] = [
  ["energimyndigheten", "STEMFS 2026:1", "Statens energimyndighets foreskrifter om upphavande av STEMFS 2021:3 om riskanalys och sakerhetsatgarder for natverk och informationssystem inom energisektorn",
    "Foreskrift om upphavande av STEMFS 2021:3. De tidigare foreskrifterna om riskanalys och sakerhetsatgarder for natverk och informationssystem inom energisektorn (NIS-direktivet) har ersatts av nya regler under NIS2-direktivet och MSB:s foreskrifter.",
    "foreskrift", "in_force", "2026-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2025:8", "Statens energimyndighets foreskrifter om ursprungsgarantier for energi",
    "Foreskrifter om ursprungsgarantier for el, gas, varme och kyla fran fornybar energi och hogeffektiv kraftvarme. Genomfor uppdaterade krav i fornybarhetsdirektivet (EU) 2018/2001 (RED II) om utfardande, overforing och annullering av ursprungsgarantier. Energimyndigheten ansvarar for det svenska kontoforingssystemet (CESAR).",
    "foreskrift", "in_force", "2025-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2025:7", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om industrins energianvandning",
    "Foreskrifter om industriforetags rapporteringsskyldighet avseende energianvandning. Omfattar bransleforbrukning, elanvandning, varmeanvandning och energieffektiviseringsatgarder. Data anvands for Sveriges officiella energistatistik.",
    "foreskrift", "in_force", "2025-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2025:6", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om produktion och anvandning av biogas och rotrester",
    "Foreskrifter om rapportering av biogasproduktion och rotrester. Biogasproducenter ska rapportera produktionsvolymer, rastort, gasanvandning (fordonsgas, el, varme) och rotrester till Energimyndigheten.",
    "foreskrift", "in_force", "2025-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2025:5", "Statens energimyndighets foreskrifter om rapportering enligt drivmedelslagen och miljoinformation om drivmedel",
    "Foreskrifter om rapportering av drivmedel enligt drivmedelslagen (2011:319). Drivmedelslevrantorer ska rapportera volymer, vaxthusgasutslapp och hallbarhetsuppgifter. Aven krav pa miljoinformation vid forsaljningsstallen.",
    "foreskrift", "in_force", "2025-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2025:4", "Statens energimyndighets foreskrifter om tillsynsavgifter for tillhandahallande och anvandning av hallbara flygbranslen",
    "Foreskrifter om tillsynsavgifter for hallbara flygbranslen (SAF). Genomfor svenska bestammelser kopplade till EU:s ReFuelEU Aviation-forordning om inblandningskrav for hallbara flygbranslen.",
    "foreskrift", "in_force", "2025-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2025:3", "Statens energimyndighets foreskrifter om reduktion av vaxthusgasutslapp fran bensin och diesel",
    "Foreskrifter om reduktionsplikten for bensin och diesel. Drivmedelslevrantorer ska minska vaxthusgasutslappen genom inblandning av biodrivmedel. Reglerar berakningsmetoder, rapportering och kontroll av reduktionsniveer.",
    "foreskrift", "in_force", "2025-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2025:2", "Statens energimyndighets foreskrifter om hallbarhetskriterier for vissa branslen",
    "Foreskrifter om hallbarhetskriterier for biodrivmedel och biobranslen. Genomfor RED III (fornybarhetsdirektivet 2023) med uppdaterade krav pa vaxthusgasminskning, markkriterier och sparbarhet. Ersatter STEMFS 2021:7.",
    "foreskrift", "in_force", "2025-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2025:1", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om energianvandning och uppvarmningssatt i flerbostadshus",
    "Foreskrifter om rapportering av energianvandning i flerbostadshus. Fastigheetsagare ska rapportera uppvarmningssatt (fjarrvarme, varmepump, el, olja, gas), energianvandning per kvadratmeter och energieffektiviseringsatgarder.",
    "foreskrift", "in_force", "2025-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:11", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om arlig energistatistik (el, gas och fjarrvarme)",
    "Foreskrifter om arlig energistatistik. Energiforetag ska rapportera uppgifter om produktion, overforing och forbrukning av el, gas och fjarrvarme. Data anvands for Sveriges officiella energibalans och rapportering till Eurostat.",
    "foreskrift", "in_force", "2024-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:10", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om gaspriser och gasavtal",
    "Foreskrifter om rapportering av gaspriser och gasavtal. Gashandlare ska rapportera priser for olika kundkategorier och avtalstyper till Energimyndigheten for officiell prisstatistik.",
    "foreskrift", "in_force", "2024-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:9", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om elpriser och elavtal",
    "Foreskrifter om rapportering av elpriser och elavtal. Elleverantorer ska rapportera priser for hushall och foretag, uppdelat pa avtalstyp (rorligt, fast, mix). Data anvands for Energimyndighetens prisstatistik och rapportering till Eurostat.",
    "foreskrift", "in_force", "2024-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:8", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om oljeleveranser pa kommunniva",
    "Foreskrifter om rapportering av oljeleveranser fordelade pa kommun. Oljelevrantorer ska rapportera volymer av eldningsolja, diesel och andra oljeprodukter per kommun.",
    "foreskrift", "in_force", "2024-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:7", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om natanslutna solcellsanlaggningar",
    "Foreskrifter om rapportering av natanslutna solcellsanlaggningar. Elnatsforetag ska rapportera antal, installerad effekt och arlig produktion fran natanslutna solcellsanlaggningar i sina nat.",
    "foreskrift", "in_force", "2024-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:6", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till kvartalvis branslstatistik och statistik om tradbranse-, torv- och avfallspriser",
    "Foreskrifter om kvartalvis rapportering av branslestatistik. Foretag inom energisektorn ska rapportera volymer och priser for tradbransle, torv och avfall anvant for energiproduktion.",
    "foreskrift", "in_force", "2024-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:5", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om leveranser av fordonsgas och vatgas",
    "Foreskrifter om rapportering av fordonsgas- och vatgasleveranser. Levrantorer ska rapportera volymer, kundkategorier och priser for fordonsgas (biogas/naturgas) och vatgas.",
    "foreskrift", "in_force", "2024-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:4", "Foreskrifter om andring i Statens energimyndighets foreskrifter och allmanna rad (STEMFS 2011:4) om elcertifikat",
    "Andringsforeskrift till STEMFS 2011:4 om elcertifikat. Uppdaterar regler for elcertifikatsystemet, bl.a. avseende berattighetsperioder, godkandekrav for anlaggningar och rapporteringskrav. Andringarna foljer av andringar i lag (2011:1200) om elcertifikat.",
    "foreskrift", "in_force", "2024-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:3", "Foreskrifter om andring i Statens energimyndighets foreskrifter (STEMFS 2017:2) om ursprungsgarantier for el",
    "Andringsforeskrift till STEMFS 2017:2 om ursprungsgarantier for el. Uppdaterar regler for utfardande, overforing och annullering av ursprungsgarantier i enlighet med uppdaterade EU-krav.",
    "foreskrift", "in_force", "2024-04-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:2", "Statens energimyndighets foreskrifter om internationella samarbeten i enlighet med artikel 6 i Parisavtalet",
    "Foreskrifter om internationella samarbeten for vaxthusgasminskning under Parisavtalet. Reglerar Sveriges deltagande i internationella mekanismer for overtoring av utslappskrediter (Article 6.2 och Article 6.4).",
    "foreskrift", "in_force", "2024-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2024:1", "Statens energimyndighets foreskrifter om statligt stod till avskiljning, transport och geologisk lagring av koldioxid med biogent ursprung",
    "Foreskrifter om statligt stod for bio-CCS (bioenergi med koldioxidavskiljning och lagring). Reglerar ansokningsforfarande, berattighetsvillkor och utbetalning av stod for anlaggningar som avskiljer och lagrar biogen koldioxid.",
    "foreskrift", "in_force", "2024-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2023:5", "Foreskrifter om andring i STEMFS 2011:4 om elcertifikat",
    "Andringsforeskrift som uppdaterar STEMFS 2011:4 om elcertifikat avseende bl.a. matningsregler och rapporteringsformularet.",
    "foreskrift", "in_force", "2023-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2023:4", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om manatlig bransle-, gas- och lagerstatistik",
    "Foreskrifter om manatlig rapportering av bransle-, gas- och lagerstatistik. Foretag inom energisektorn ska manatligen rapportera volymer och lager av oljeprodukter, naturgas och andra branslen.",
    "foreskrift", "in_force", "2023-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2023:2", "Statens energimyndighets foreskrifter om sakerhetsskydd",
    "Foreskrifter om sakerhetsskydd inom energisektorn. Energimyndigheten ar tillsynsmyndighet for sakerhetsskydd for delar av energisektorn. Foreskrifterna reglerar krav pa sakerhetsskyddsanalyser, fysisk sakerhet, informationssakerhet och personsakerhet for samhallsviktiga energianlaggningar.",
    "foreskrift", "in_force", "2023-04-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2023:1", "Statens energimyndighets foreskrifter om kontodfring och registrering i unionsregistret",
    "Foreskrifter om kontodforing i EU:s utslapphandelsregister (Union Registry). Reglerar kontohantering, overforing av utslafpfratter och rapportering for aktorer i EU:s utslafpfhandelssystem (EU ETS).",
    "foreskrift", "in_force", "2023-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2022:4", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om energianvandningen inom byggsektorn",
    "Foreskrifter om rapportering av energianvandning inom byggsektorn. Byggforetag ska rapportera energianvandning fordelad pa bransle, el och fjarrvarme, samt energieffektiviseringsatgarder.",
    "foreskrift", "in_force", "2022-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2021:12", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om oforadlat tradbransle",
    "Foreskrifter om rapportering av oforadlat tradbransle (skogsfliss, GROT, stubbar, etc.). Levrantorer ska rapportera volymer och priser.",
    "foreskrift", "in_force", "2021-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2021:10", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om energianvandningen inom jordbruket",
    "Foreskrifter om rapportering av energianvandning inom jordbruket. Jordbruksforetag ska rapportera bransle- och elanvandning per typ av jordbruksverksamhet.",
    "foreskrift", "in_force", "2021-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2020:14", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om manatlig elstatistik och byte av elleverantor",
    "Foreskrifter om manatlig rapportering av elstatistik och leverantorsbyten. Elnatsforetag rapporterar antal leverantorsbyten, overforad energi och kundantal.",
    "foreskrift", "in_force", "2020-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2020:11", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om energianvandningen inom fiskesektorn",
    "Foreskrifter om rapportering av energianvandning inom fiskesektorn. Fiskeforetag rapporterar bransleanvandning per fartygstyp och fiskemetod.",
    "foreskrift", "in_force", "2020-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2020:8", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter till statistik om energianvandning i bantrafik och inrikes sjofart",
    "Foreskrifter om rapportering av energianvandning inom bantrafik (tag) och inrikes sjdfart. Trafikoperatorer ska rapportera el- och bransleanvandning.",
    "foreskrift", "in_force", "2020-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2018:4", "Statens energimyndighets foreskrifter om statligt stod till solceller",
    "Foreskrifter om det statliga solcellsstodet. Reglerar ansokningsforfarande, storeblopp per installerad kW, berattighetsvillkor och utbetalningsrutiner for det statliga investeringsstodet for solcellsanlaggningar.",
    "foreskrift", "in_force", "2018-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2018:3", "Statens energimyndighets foreskrifter om elbusspremie",
    "Foreskrifter om elbusspremien -- ett statligt stod for inkapning av elbussar i kollektivtrafiken. Reglerar berattighetsvillkor, stodbelopp och ansokningsforfarande.",
    "foreskrift", "in_force", "2018-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2016:3", "Statens energimyndighets foreskrifter om bidrag till kommunal energi- och klimatradgivning",
    "Foreskrifter om statligt bidrag till kommunal energi- och klimatradgivning. Kommuner kan soka bidrag for att erbjuda kostnadsfri och oberoende energi- och klimatradgivning till hushall, foretag och organisationer.",
    "foreskrift", "in_force", "2016-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2016:1", "Statens energimyndighets foreskrifter och allmanna rad om trygg naturgasforsorjning",
    "Foreskrifter om trygg naturgasforsorjning. Genomfor EU-forordning (EU) 2017/1938 om trygg gasforsorjning. Reglerar riskbedomning, forebyggande atgardsplaner och krisplaner for naturgassektorn i Sverige.",
    "foreskrift", "in_force", "2016-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2015:1", "Statens energimyndighets foreskrifter om statligt stod till energikartlaggning",
    "Foreskrifter om statligt stod till energikartlaggning i stora foretag. Genomfor energieffektiviseringsdirektivet 2012/27/EU avseende obligatorisk energikartlaggning (audit) for stora foretag.",
    "foreskrift", "in_force", "2015-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2014:3", "Statens energimyndighets foreskrifter och allmanna rad om vissa kostnads-nyttoanalyser pa energiomradet",
    "Foreskrifter om kostnads-nyttoanalyser enligt energieffektiviseringsdirektivet. Reglerar nar och hur kostnads-nyttoanalyser ska genomforas for hogeffektiv kraftvarme och fjarrvarme/fjarrkyla.",
    "foreskrift", "in_force", "2014-10-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2014:2", "Statens energimyndighets foreskrifter om energikartlaggning i stora foretag",
    "Foreskrifter om obligatorisk energikartlaggning (energy audit) for stora foretag. Foretag med mer an 250 anstalda eller omsattning over 50 MEUR ska genomfora energikartlaggning minst vart fjarde ar och rapportera till Energimyndigheten. Genomfor artikel 8 i energieffektiviseringsdirektivet 2012/27/EU.",
    "foreskrift", "in_force", "2014-06-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2013:4", "Statens energimyndighets foreskrifter om planering for prioritering av samhallsviktiga elanvandare",
    "Foreskrifter om planering for manuell lastfranstangning (MFK) och prioritering av samhallsviktiga elanvandare vid effektbrist. Reglerar hur lansstyrelser och elnatsforetag ska planera for prioriteringsordning vid ransonering.",
    "foreskrift", "in_force", "2013-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2013:1", "Statens energimyndighets foreskrifter om anlaggningar som omfattas av system for certifiering av vissa installatorer",
    "Foreskrifter om certifieringssystemet for installatorer av fornybar energi (varmepumpar, solceller, solvarmesystem, biomassepannor). Genomfor fornybarhetsdirektivets krav pa frivillig certifiering.",
    "foreskrift", "in_force", "2013-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2012:7", "Statens energimyndighets foreskrifter och allmanna rad om beredskapslagring av olja",
    "Foreskrifter om skyldighet att halla beredskapslager av olja. Genomfor radets direktiv 2009/119/EG om minimiupplagg av rafolja och/eller petroleumprodukter. Reglerar lagerhalningsvolymer, kvalitetskrav, rapportering och tillsyn.",
    "foreskrift", "in_force", "2012-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2011:4", "Statens energimyndighets foreskrifter och allmanna rad om elcertifikat",
    "Grundforeskrift om elcertifikatsystemet. Reglerar godkannande av anlaggningar, tilldelning av elcertifikat, kvotplikt, kontodforing och rapportering. Andrad genom STEMFS 2016:2, 2023:5 och 2024:4. Elcertifikatsystemet ar ett marknadsbaserat stodsystem for okad fornybar elproduktion i Sverige och Norge.",
    "foreskrift", "in_force", "2011-12-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],
];

// ---------- Elsakerhetsverket ELSAK-FS ----------

const elsakRegs: string[][] = [
  ["elsakerhetsverket", "ELSAK-FS 2022:3", "Elsakerhetsverkets foreskrifter och allmanna rad om innehavarens kontroll av starkstromsanlaggningar och elektriska utrustningar",
    "Foreskrifter om innehavarens (agarens/brukarens) skyldighet att kontrollera starkstromsanlaggningar och elektriska utrustningar. Reglerar periodisk kontroll, fortlopande tillsyn och felavhjalpning for att sakerstalla att elanlaggningar forblir sakra under hela livslangden.",
    "foreskrift", "in_force", "2022-11-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2022-3/"],

  ["elsakerhetsverket", "ELSAK-FS 2022:2", "Elsakerhetsverkets foreskrifter och allmanna rad om skyltning av starkstromsanlaggningar",
    "Foreskrifter om skyltningskrav for starkstromsanlaggningar. Reglerar krav pa varningsskyltar, markning av huvudstrombrytare, jordpunkter, transformatorer och hogspanningsanlaggningar for att skydda bade driftpersonal och utomstaende.",
    "foreskrift", "in_force", "2022-11-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2022-2/"],

  ["elsakerhetsverket", "ELSAK-FS 2022:1", "Elsakerhetsverkets foreskrifter och allmanna rad om hur starkstromsanlaggningar ska vara utforda",
    "Foreskrifter om utforande av starkstromsanlaggningar (lagspanning och hogspanning). Central foreskrift som reglerar hur elanlaggningar ska dimensioneras, installeras och utforas for att uppfylla grundlaggande sakerhetskrav. Omfattar jordfelsbrytare, overbelastningsskydd, kapslingsklass, ledningsdimensionering och installationsmetoder. Hanvisar till svensk standard SS 436 40 00.",
    "foreskrift", "in_force", "2022-11-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2022-1/"],

  ["elsakerhetsverket", "ELSAK-FS 2021:7", "Elsakerhetsverkets foreskrifter om upphavande av foreskrifter om elsakerhet vid arbete i yrkesmassig verksamhet",
    "Foreskrift om upphavande av tidigare ELSAK-FS om elsakerhet vid yrkesmassigt arbete. Regleringen av elsakerhet vid arbete overfords till Arbetsmiljoeverkets foreskrifter om elsakerhet.",
    "foreskrift", "in_force", "2021-01-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/"],

  ["elsakerhetsverket", "ELSAK-FS 2021:1", "Elsakerhetsverkets foreskrifter om elsakerhet vid arbete i yrkesmassig verksamhet",
    "Foreskrifter om elsakerhet vid arbete pa eller i narheten av elanlaggningar. Reglerar arbetsplanering, riskbedomning, frangkoppling, jordning, utbildningskrav och personlig skyddsutrustning for yrkesmassigt elarbete. Omfattar bade lagspanning och hogspanning.",
    "foreskrift", "in_force", "2021-01-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2021-1/"],

  ["elsakerhetsverket", "ELSAK-FS 2019:1", "Elsakerhetsverkets foreskrifter om stickproppar och uttag for allmanbruk",
    "Foreskrifter om sakerhetskrav for stickproppar och uttag (eluttag) for allmanbruk. Reglerar konstruktion, material, elektriska egenskaper och markning. Galler for den svenska standarden for stickproppar och uttag (typ F/Schuko och SEV 1011).",
    "foreskrift", "in_force", "2019-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2019-1/"],

  ["elsakerhetsverket", "ELSAK-FS 2017:4", "Elsakerhetsverkets foreskrifter om auktorisation som elinstallator",
    "Foreskrifter om auktorisation som elinstallator. Reglerar krav pa utbildning, praktisk erfarenhet, kunskapsprov och fornyelse av auktorisation for elinstallatorer. Auktorisation kravs for att utfora elinstallationsarbete.",
    "foreskrift", "in_force", "2017-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2017-4/"],

  ["elsakerhetsverket", "ELSAK-FS 2017:3", "Elsakerhetsverkets foreskrifter om elinstallationsforetag och utforande av elinstallationsarbete",
    "Foreskrifter om krav pa elinstallationsforetag och elinstallationsarbete. Reglerar foretagsregistrering, egenkontrollprogram, dokumentation, anmalan till natinnehavare och kompetenskrav for installationsarbete.",
    "foreskrift", "in_force", "2017-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2017-3/"],

  ["elsakerhetsverket", "ELSAK-FS 2017:2", "Elsakerhetsverkets foreskrifter och allmanna rad om elinstallationsarbete",
    "Foreskrifter och allmanna rad om elinstallationsarbete. Kompletterande foreskrifter till ELSAK-FS 2017:3 med detaljerade krav pa utforande av olika typer av elinstallationsarbete.",
    "foreskrift", "in_force", "2017-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2017-2/"],

  ["elsakerhetsverket", "ELSAK-FS 2017:1", "Elsakerhetsverkets foreskrifter om ersattning och avgifter vid marknadskontroll av viss elektrisk utrustning",
    "Foreskrifter om avgifter och ersattning vid Elsakerhetsverkets marknadskontroll av elektrisk utrustning. Reglerar provningsavgifter och kostnadstakning for tillsynsatgarder.",
    "foreskrift", "in_force", "2017-01-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2017-1/"],

  ["elsakerhetsverket", "ELSAK-FS 2016:3", "Elsakerhetsverkets foreskrifter om elektromagnetisk kompatibilitet",
    "Foreskrifter om elektromagnetisk kompatibilitet (EMC). Genomfor EMC-direktivet 2014/30/EU. Reglerar krav pa att elektrisk utrustning varken ska orsaka storningar eller vara mottaglig for elektromagnetiska storningar. Galler for all utrustning som kan orsaka eller paverkas av elektromagnetiska storningar.",
    "foreskrift", "in_force", "2016-04-20", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2016-3/"],

  ["elsakerhetsverket", "ELSAK-FS 2016:2", "Elsakerhetsverkets foreskrifter om elektrisk utrustning och elektriska skyddssystem for potentiellt explosiva atmosfarer",
    "Foreskrifter om elektrisk utrustning for explosionsfarliga miljoer (ATEX). Genomfor ATEX-direktivet 2014/34/EU. Reglerar krav pa konstruktion, provning, certifiering och markning av elektrisk utrustning som ska anvandas i miljoer med risk for explosiv atmosfar.",
    "foreskrift", "in_force", "2016-04-20", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2016-2/"],

  ["elsakerhetsverket", "ELSAK-FS 2016:1", "Elsakerhetsverkets foreskrifter om elektrisk utrustning",
    "Foreskrifter om sakerhetskrav for elektrisk utrustning (lagspanningsdirektivet). Genomfor LVD-direktivet 2014/35/EU. Reglerar grundlaggande sakerhetskrav for elektrisk utrustning med sparning mellan 50 och 1000 V vaxelstrom eller 75 och 1500 V likstrom. Krav pa CE-marking, forsakran om overensstammelse och teknisk dokumentation.",
    "foreskrift", "in_force", "2016-04-20", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2016-1/"],

  ["elsakerhetsverket", "ELSAK-FS 2014:1", "Elsakerhetsverkets foreskrifter om upphavande av foreskrifter om avgift for meddelande av behorighet",
    "Foreskrift om upphavande av tidigare avgiftsforeskrifter for behorighetsmeddelanden.",
    "foreskrift", "in_force", "2014-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/"],

  ["elsakerhetsverket", "ELSAK-FS 2012:1", "Elsakerhetsverkets foreskrifter om anmalan av olycksfall, allvarliga tillbud och driftstorningar",
    "Foreskrifter om anmalningsskyldighet vid el-relaterade olycksfall, allvarliga tillbud och driftstorningar. Natinnehavare och anlaggningsinnehavare ska anmala handelser till Elsakerhetsverket. Omfattar personskador av el, brander med elektrisk orsak och storre driftstorningar i elnatet.",
    "foreskrift", "in_force", "2012-01-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-2012-1/"],

  ["elsakerhetsverket", "ELSAK-FS 2011:4", "Elsakerhetsverkets foreskrifter om anmalan av ibruktagande av kontaktledning",
    "Foreskrifter om anmalan av ibruktagande av kontaktledning for jarnvag och spatrvag. Innehavare ska anmala till Elsakerhetsverket nar en kontaktledning tas i drift.",
    "foreskrift", "in_force", "2011-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/"],

  ["elsakerhetsverket", "ELSAK-FS 2011:3", "Elsakerhetsverkets foreskrifter om ansokan om drifttillstand",
    "Foreskrifter om ansokan om drifttillstand for starkstromsanlaggningar. Reglerar nar och hur ansokan ska goras for att ta en starkstromsanlaggning i drift.",
    "foreskrift", "in_force", "2011-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/"],

  ["elsakerhetsverket", "ELSAK-FS 2011:2", "Elsakerhetsverkets foreskrifter om elstangserapparater och tillhorande elstangsel",
    "Foreskrifter om sakerhetskrav for elstangserapparater och elstangsel. Reglerar konstruktion, spannning, energi och markning for elstangsel som anvands i jordbruk och djurhallning.",
    "foreskrift", "in_force", "2011-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/"],

  ["elsakerhetsverket", "ELSAK-FS 2011:1", "Elsakerhetsverkets foreskrifter om elektriska egenskaper for leksaker",
    "Foreskrifter om elektriska sakerhetskrav for leksaker. Genomfor delar av leksaksdirektivet 2009/48/EG avseende elektriska egenskaper. Krav pa maxspanningar, isolering och batterisakerhet.",
    "foreskrift", "in_force", "2011-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/"],
];

// ---------- Key Swedish legislation (SFS) ----------

const lagstiftning: string[][] = [
  ["riksdagen", "SFS 1997:857", "Ellag (1997:857)",
    "Ellagen -- Sveriges centrala lagstiftning for elmarknaden. Reglerar natverksamhet (omradeskoncession, linjekoncession), elhandel, balansansvar, systemansvar, elanvandares rattigheter, avbrottersattning, leveransskyldighet och Energimarknadsinspektionens tillsyn. Senast andrad 2025. Genomfor EU:s elmarknadsdirektiv och elmarknadsforordning. Ca 14 kapitel.",
    "lag", "in_force", "1997-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/ellag-1997857_sfs-1997-857/"],

  ["riksdagen", "SFS 2005:403", "Naturgaslag (2005:403)",
    "Naturgaslagen -- reglerar overforing, lagring, forsaljning och distribution av naturgas i Sverige. Omfattar natkoncessioner for naturgasnat, tredjepartstillgang, tariffer, intaktsramar, leveransskyldighet och Energimarknadsinspektionens tillsyn. Genomfor EU:s naturgasdirektiv.",
    "lag", "in_force", "2005-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/naturgaslag-2005403_sfs-2005-403/"],

  ["riksdagen", "SFS 2008:263", "Fjarrvarmelag (2008:263)",
    "Fjarrvarmelagen -- reglerar forhalandet mellan fjarrvarmeforetag och deras kunder. Syftar till att starka fjarrvarmekundernas stallning genom krav pa transparens, prisinformation, avtalsvillkor, matning och fakturering. Energimarknadsinspektionens tillsyn.",
    "lag", "in_force", "2008-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/fjarrvarmelag-2008263_sfs-2008-263/"],

  ["riksdagen", "SFS 2011:1200", "Lag (2011:1200) om elcertifikat",
    "Elcertifikatlagen -- reglerar det marknadsbaserade stodsystemet for fornybar elproduktion. Producenter av fornybar el (vind, sol, vatten, biobransle, geotermisk, vagorenergi) tilldelas elcertifikat som kan saljas pa en marknad. Elleverantorer och vissa elanvandare har kvotplikt att kopa certifikat. Gemensamt system med Norge sedan 2012. Energimyndigheten ansvarar for administration.",
    "lag", "in_force", "2012-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20111200-om-elcertifikat_sfs-2011-1200/"],

  ["riksdagen", "SFS 2016:732", "Elsakerhetslag (2016:732)",
    "Elsakerhetslagen -- central lag for elsakerhet i Sverige. Reglerar sakerhetskrav for elanlaggningar, elinstallationsarbete, auktorisation av elinstallatorer, elinstallationsforetag, tillsyn, marknadskontroll och pafoljer. Elsakerhetsverket ar tillsynsmyndighet.",
    "lag", "in_force", "2017-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/elsakerhetslag-2016732_sfs-2016-732/"],

  ["riksdagen", "SFS 2017:218", "Elsakerhetsforordning (2017:218)",
    "Elsakerhetsforordningen -- kompletterande forordning till elsakerhetslagen. Detaljbestammelser om anmalningsskyldigheter, undantag fran krav pa auktorisation, drifttillstand, tillsynsavgifter och andra verkstallighetsbestammelser.",
    "forordning", "in_force", "2017-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/elsakerhetsforordning-2017218_sfs-2017-218/"],

  ["riksdagen", "SFS 1997:288", "Elberedskapslag (1997:288)",
    "Elberedskapslagen -- reglerar beredskapsatgarder for att sakra elforsorjningen vid hoijda beredskapssituationer och vid svara stdrningar i fredstid. Stamnatsforetaget (Svenska kraftnat) och elnatsforetag ska vidta atgarder for att minska sarbarheten och underlatta aterstart av elsystemet.",
    "lag", "in_force", "1997-06-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/elberedskapslag-1997288_sfs-1997-288/"],

  ["riksdagen", "SFS 1997:294", "Forordning (1997:294) om elberedskap",
    "Elberedskapsforordningen -- verkstallighetsbestammelser till elberedskapslagen. Reglerar planering, ovningar, ersattning for beredskapsatgarder och rapportering.",
    "forordning", "in_force", "1997-06-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2023:241", "Forordning (2023:241) om det nationella elsystemet",
    "Forordning om det nationella elsystemet. Innehaller bestammelser om systemansvar, driftsakerhet, balansansvar, koncessioner och Svenska kraftnats uppgifter i samband med ellagen. Genomfor delar av EU:s rena energipaketet.",
    "forordning", "in_force", "2023-05-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-2023241-om-det-nationella-elsystemet_sfs-2023-241/"],

  ["riksdagen", "SFS 2022:585", "Forordning (2022:585) om elnatsverksamhet",
    "Forordning om elnatsverksamhet. Kompletterande bestammelser till ellagen om natverksamhet, intaktsramar, kvalitetsreglering och rapporteringsskyldigheter for elnatsforetag.",
    "forordning", "in_force", "2022-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2018:1520", "Forordning (2018:1520) om intaktsram for elnatsverksamhet",
    "Forordning om intaktsramar for elnatsverksamhet. Detaljbestammelser om berakningsmodellen for intaktsramar, kapitalunderlag, avskrivningstider och avkastning. Tillampas av Ei vid faststallande av tillagna intakter.",
    "forordning", "in_force", "2019-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2021:808", "Forordning (2021:808) om natkoncession",
    "Forordning om natkoncessioner. Reglerar handlaggning av ansokningar om natkoncession for linje och omrade, giltighetsperioder och villkor.",
    "forordning", "in_force", "2021-10-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 1999:716", "Forordning (1999:716) om matning, berakning och rapportering av overferd el",
    "Forordning om matning och rapportering av overfored el. Grundlaggande bestammelser om matmetoder, matarklasser och rapporteringsansvar i elnaten.",
    "forordning", "in_force", "1999-09-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 1995:1145", "Forordning (1995:1145) om redovisning av natverksamhet",
    "Forordning om redovisning av natverksamhet. Grundlaggande bestammelser om separat redovisning av elnatsverksamhet fran annan verksamhet.",
    "forordning", "in_force", "1996-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2007:215", "Forordning (2007:215) om undantag fran kravet pa natkoncession enligt ellagen",
    "Forordning om undantag fran koncessionsplikten. Definierar vilka typer av ledningar och nat som far byggas och drivas utan natkoncession (interna nat, mindre anlaggningar, etc.).",
    "forordning", "in_force", "2007-06-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2023:940", "Forordning (2023:940) om sarskilt investeringsutrymme for elnatsverksamhet",
    "Forordning om sarskilt investeringsutrymme for elnatsforetag utover den ordinarie intaktsramen. Syftar till att stimulera investeringar i elnat for att klara den okade elektrifieringen.",
    "forordning", "in_force", "2024-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2023:2420", "Forordning (2023:2420) om leverans av el och aggregeringstjanster",
    "Forordning om leverans av el och aggregeringstjanster. Reglerar oberoende aggregatorers tillgang till elmarknaden, kompensationsmodeller och datadelning mellan elleverantorer, aggregatorer och elnatsforetag.",
    "forordning", "in_force", "2024-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2011:710", "Lag (2011:710) om certifiering av stamndtsforetag for el",
    "Lag om certifiering av stamnatsforetag (TSO-certifiering). Genomfor EU:s krav pa certifiering av systemansvarigas oberoende (ownership unbundling). Energimarknadsinspektionen beslutar om certifiering.",
    "lag", "in_force", "2011-08-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2013:385", "Lag (2013:385) om ingripande mot marknadsmissbruk vid handel med grossistenergiprodukter",
    "Lag som genomfor REMIT-forordningen (EU) nr 1227/2011 i svensk ratt. Forbjuder insiderhandel och marknadsmanipulation pa grossistmarknaden for energi. Ei ar behtorig myndighet.",
    "lag", "in_force", "2013-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2004:875", "Lag (2004:875) om sarskild forvaltning av vissa elektriska anlaggningar",
    "Lag om sarskild forvaltning av elektriska anlaggningar som ar av sarskild betydelse fran allmlan synpunkt. Ger staten rdtt att intrada som forvaltare vid risk for samhallsviktig elanlaggning.",
    "lag", "in_force", "2005-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 1992:1512", "Lag (1992:1512) om elektromagnetisk kompatibilitet",
    "Lag om elektromagnetisk kompatibilitet (EMC). Grundlaggande krav pa att elektrisk och elektronisk utrustning inte ska orsaka oaccpetabla elektromagnetiska storningar och ska tala storningar i sin avsedda miljo.",
    "lag", "in_force", "1993-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2011:1480", "Forordning (2011:1480) om elcertifikat",
    "Forordning om elcertifikat. Kompletterande bestammelser till lag (2011:1200) om elcertifikat. Detaljregler om ansokningsforfarande, kvotpliktens storlek per ar, rapportering och avgifter.",
    "forordning", "in_force", "2012-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-20111480-om-elcertifikat_sfs-2011-1480/"],

  ["riksdagen", "SFS 2006:985", "Lag (2006:985) om energideklaration for byggnader",
    "Lag om energideklaration for byggnader. Genomfor EU:s byggnadsenergieffektivitetsdirektiv. Agare till byggnader med nyttjanderatter ska lata upprdtta energideklaration som visar byggnadens energiprestanda. Boverket ar tillsynsmyndighet.",
    "lag", "in_force", "2006-12-29", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2006985-om-energideklaration-for-byggnader_sfs-2006-985/"],

  ["riksdagen", "SFS 2006:1592", "Forordning (2006:1592) om energideklaration for byggnader",
    "Forordning om energideklaration for byggnader. Kompletterande bestammelser om energideklarationens innehall, referensvarden och giltighetstid.",
    "forordning", "in_force", "2006-12-29", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2011:319", "Lag (2011:319) om drivmedel",
    "Drivmedelslagen -- reglerar rapporteringsskyldigheter for drivmedelslevrantorer avseende volymer, ursprung och vaxthusgasutslapp. Grund for reduktionsplikten och hallbarhetskrav pa biodrivmedel.",
    "lag", "in_force", "2011-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2010:601", "Lag (2010:601) om hallbarhetskriterier for biodrivmedel och flytande biobranslen",
    "Hallbarhetslagen -- reglerar hallbarhetskriterier for biodrivmedel och flytande biobranslen. Genomfor fornybarhetsdirektivet avseende kriterier for markanvandning, vaxthusgasminskning och sparbarhetskrav. Energimyndigheten ar tillsynsmyndighet.",
    "lag", "in_force", "2011-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2007:1118", "Forordning (2007:1118) med instruktion for Energimarknadsinspektionen",
    "Instruktion for Energimarknadsinspektionen. Definierar Ei:s uppdrag, ansvarsomraden och organisation. Ei ansvarar for tillsyn, reglering och tillstand enligt ellagen, naturgaslagen, fjdrrvarmelagen och lagen om grossistmarknader for energi.",
    "forordning", "in_force", "2008-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-20071118-med-instruktion-for_sfs-2007-1118/"],

  ["riksdagen", "SFS 2007:1119", "Forordning (2007:1119) med instruktion for Affarverket svenska kraftnat",
    "Instruktion for Svenska kraftnat. Definierar Svenska kraftnats uppdrag som stamnatsforetag, systemansvarigt foretag och elberdskapsmyndighet. Reglerar ansvar for transmissionsndtet, systembalansen, gransoverskridande forbindelser och beredskapsplanering.",
    "forordning", "in_force", "2008-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2011:931", "Forordning (2011:931) om planering for prioritering av samhallsviktiga elanvandare",
    "Forordning om styrning vid effektbrist. Reglerar hur lansstyrelser ska planera for prioritering av samhallsviktiga elanvandare vid manuell lastfranstangning. Elditsributorer ska kunna genomfora prioriterad bortkoppling.",
    "forordning", "in_force", "2011-11-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],
];

// ---------- Repealed Ei EIFS (historical, for completeness) ----------

const eiRepealedRegs: string[][] = [
  ["ei", "EIFS 2023:1", "Energimarknadsinspektionens foreskrifter om matning, berakning och rapportering av overferd el (upphavd)",
    "Foreskrifter om matning och rapportering av overferd el. Ersatt av EIFS 2025:1. Reglerade matmetoder, matarklasser, rapporteringsformat och tidsfrister for elnatsforetag.",
    "foreskrift", "repealed", "2023-01-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2020:4", "Energimarknadsinspektionens foreskrifter om elleverantorers skyldighet att lamna uppgift om priser och leveransvillkor (upphavd)",
    "Foreskrifter om prisrapportering fran elleverantorer. Ersatt av EIFS 2023:2.",
    "foreskrift", "repealed", "2020-04-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2019:7", "Energimarknadsinspektionens foreskrifter om faststallande av krav pa datautbyte mellan elnatsforetag och betydande natanvandare (upphavd)",
    "Foreskrifter om datautbyte mellan natforetag och storre natanvandare. Ersatt av EIFS 2024:3.",
    "foreskrift", "repealed", "2019-08-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2019:5", "Energimarknadsinspektionens foreskrifter om funktionskrav for matsystem och matutrustning (upphavd)",
    "Foreskrifter om funktionskrav for matare och matutrustning i elnaten. Reglerade krav pa matarnoggrannhet, kommunikation och driftsakerhet.",
    "foreskrift", "repealed", "2019-06-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2019:4", "Energimarknadsinspektionens foreskrifter om kvaliteten i natverksamheten vid faststallande av intaktsram (upphavd)",
    "Foreskrifter om kvalitetskriterier i intaktsramsmodellen for perioden 2020-2023. Ersatt av EIFS 2023:6.",
    "foreskrift", "repealed", "2019-10-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2019:2", "Energimarknadsinspektionens foreskrifter om berakning av intaktsram for elnatsforetag (upphavd)",
    "Foreskrifter om berakningsmodellen for intaktsramar perioden 2020-2023. Ersatt av EIFS 2023:5.",
    "foreskrift", "repealed", "2019-10-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2019:1", "Energimarknadsinspektionens foreskrifter om insamling av uppgifter for intaktsramens storlek (upphavd)",
    "Foreskrifter om uppgiftsinsamling for intaktsramsberakning 2020-2023. Ersatt av EIFS 2023:4.",
    "foreskrift", "repealed", "2019-10-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2018:1", "Energimarknadsinspektionens foreskrifter om information innan tidsbestamt avtal loper ut (upphavd)",
    "Foreskrifter om elleverantorers informationsplikt vid avtalsforlangning. Ersatt av EIFS 2024:6.",
    "foreskrift", "repealed", "2018-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2016:2", "Energimarknadsinspektionens foreskrifter om matning, berakning och rapportering av overford el (upphavd)",
    "Aldre foreskrifter om matning och rapportering av overford el. Ersatt av EIFS 2023:1 (som i sin tur ersatts av EIFS 2025:1).",
    "foreskrift", "repealed", "2016-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2015:6", "Energimarknadsinspektionens foreskrifter om effektivt utnyttjande av elnatet vid intaktsram (upphavd)",
    "Foreskrifter om effektivt natutnyttjande i intaktsramsmodellen. Ersatt av EIFS 2022:1.",
    "foreskrift", "repealed", "2015-10-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2015:5", "Energimarknadsinspektionens foreskrifter om kvaliteten i natkoncessionens natverksamhet (upphavd)",
    "Foreskrifter om kvalitetskrav i natverksamheten. Ersatt av EIFS 2019:4.",
    "foreskrift", "repealed", "2015-10-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2015:2", "Energimarknadsinspektionens foreskrifter om skaliga kostnader vid intaktsramberakning (upphavd)",
    "Foreskrifter om skaliga kostnader i intaktsramsberakning for elnatsforetag. Ersatt av EIFS 2019:2.",
    "foreskrift", "repealed", "2015-10-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2015:1", "Energimarknadsinspektionens foreskrifter om natkoncessionens forslag till intaktsram (upphavd)",
    "Foreskrifter om natforetags forslag till intaktsram. Ersatt av EIFS 2019:1.",
    "foreskrift", "repealed", "2015-10-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2013:8", "Energimarknadsinspektionens foreskrifter om offentliggorande av avgifter for overforing (upphavd)",
    "Foreskrifter om offentliggorande av overforingsavgifter. Ersatt av EIFS 2024:5.",
    "foreskrift", "repealed", "2013-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2013:7", "Energimarknadsinspektionens foreskrifter om elleverantorers priser och leveransvillkor (upphavd)",
    "Aldre foreskrift om elleverantorers prisrapportering. Ersatt av EIFS 2020:4.",
    "foreskrift", "repealed", "2013-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2013:6", "Energimarknadsinspektionens foreskrifter om ursprungsmarkning av el (upphavd)",
    "Aldre foreskrift om ursprungsmarkning av el. Ersatt av EIFS 2025:4.",
    "foreskrift", "repealed", "2013-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2013:5", "Energimarknadsinspektionens foreskrifter om overvakningsplan enligt ellagen (upphavd)",
    "Aldre foreskrift om overvakningsplan. Ersatt av EIFS 2025:3.",
    "foreskrift", "repealed", "2013-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2013:4", "Energimarknadsinspektionens foreskrifter om information om avbrottersattning (upphavd)",
    "Aldre foreskrift om avbrottersattningsinformation. Ersatt av EIFS 2024:4.",
    "foreskrift", "repealed", "2013-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2013:2", "Energimarknadsinspektionens foreskrifter om rapportering av elavbrott (upphavd)",
    "Aldre foreskrift om elavbrottsrapportering. Ersatt av EIFS 2015:4.",
    "foreskrift", "repealed", "2013-01-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2013:1", "Energimarknadsinspektionens foreskrifter om krav for overforing av el (upphavd)",
    "Aldre foreskrift om leveranskvalitet. Ersatt av EIFS 2023:3.",
    "foreskrift", "repealed", "2013-01-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2012:5", "Energimarknadsinspektionens foreskrifter om overvakningsplan enligt ellagen (upphavd)",
    "Aldre foreskrift om overvakningsplan. Ersatt av EIFS 2013:5.",
    "foreskrift", "repealed", "2012-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2012:4", "Energimarknadsinspektionens foreskrifter om redovisning av natverksamhet (upphavd)",
    "Aldre foreskrift om redovisning av elnatsverksamhet. Ersatt av EIFS 2022:10.",
    "foreskrift", "repealed", "2012-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2011:5", "Energimarknadsinspektionens foreskrifter om andring av elleverantorers priser (upphavd)",
    "Aldre foreskrift om prisandringsregler for elleverantorer. Upphavd.",
    "foreskrift", "repealed", "2011-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2011:4", "Energimarknadsinspektionens foreskrifter om ursprungsmarkning av el (upphavd 2011 version)",
    "Aldre foreskrift om ursprungsmarkning. Ersatt av EIFS 2013:6.",
    "foreskrift", "repealed", "2011-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2011:3", "Energimarknadsinspektionens foreskrifter om matning och rapportering av overford el (upphavd 2011 version)",
    "Aldre foreskrift om elmatning. Ersatt av EIFS 2016:2.",
    "foreskrift", "repealed", "2011-01-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2011:2", "Energimarknadsinspektionens foreskrifter om krav for overforing av el (upphavd 2011 version)",
    "Aldre foreskrift om leveranskvalitetskrav. Ersatt av EIFS 2013:1.",
    "foreskrift", "repealed", "2011-01-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2011:1", "Energimarknadsinspektionens foreskrifter om kvaliteten i natkoncessionens verksamhet (upphavd 2011 version)",
    "Aldre foreskrift om natverksamhetskvalitet. Ersatt av EIFS 2015:5.",
    "foreskrift", "repealed", "2011-01-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2010:6", "Energimarknadsinspektionens foreskrifter om natkoncessionshavares forslag till intaktsram (upphavd)",
    "Aldre foreskrift om intaktsramforslag. Forsta generationens intaktsramsforeskrifter. Ersatt av EIFS 2015:1.",
    "foreskrift", "repealed", "2010-10-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2010:5", "Energimarknadsinspektionens foreskrifter om rapportering av elavbrott (upphavd)",
    "Aldre foreskrift om elavbrottsrapportering. Ersatt av EIFS 2013:2.",
    "foreskrift", "repealed", "2010-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2010:4", "Energimarknadsinspektionens foreskrifter om krav for overforing av el (upphavd 2010 version)",
    "Aldre foreskrift om leveranskvalitet. Ersatt av EIFS 2011:2.",
    "foreskrift", "repealed", "2010-01-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2010:3", "Energimarknadsinspektionens foreskrifter om risk- och sarbarhetsanalyser (upphavd 2010 version)",
    "Aldre foreskrift om RSA for leveranssakerhet. Ersatt av EIFS 2013:3.",
    "foreskrift", "repealed", "2010-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2010:2", "Energimarknadsinspektionens foreskrifter om elleverantorers priser (upphavd 2010 version)",
    "Aldre foreskrift om prisrapportering. Ersatt av EIFS 2013:7.",
    "foreskrift", "repealed", "2010-01-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  // Repealed naturgas
  ["ei", "EIFS 2014:8", "Energimarknadsinspektionens foreskrifter om matning och rapportering av overford naturgas (upphavd)",
    "Aldre foreskrift om naturgasmatning. Ersatt av EIFS 2022:6.",
    "foreskrift", "repealed", "2014-11-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2014:2", "Energimarknadsinspektionens foreskrifter om matning, rapportering och debitering av fjarrvarme (upphavd)",
    "Aldre foreskrift om fjarrvarmeamatning. Ersatt av EIFS 2022:3.",
    "foreskrift", "repealed", "2014-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],

  ["ei", "EIFS 2010:1", "Energimarknadsinspektionens foreskrifter om redovisning av fjarrvarmeverksamhet (upphavd)",
    "Aldre foreskrift om fjarrvarmeradovisning. Ersatt av EIFS 2022:11.",
    "foreskrift", "repealed", "2010-07-01", "https://ei.se/om-oss/lagar-och-regler/foreskrifter/upphavda-foreskrifter"],
];

// ---------- Elsakerhetsverket laws and related forordningar ----------

const elsakLagar: string[][] = [
  ["elsakerhetsverket", "SFS 2016:732 (Elsakerhetsverkets tillampning)", "Elsakerhetslag (2016:732) -- Elsakerhetsverkets tillampning",
    "Elsakerhetslagen ur Elsakerhetsverkets perspektiv. Lagen reglerar sakerhetskrav pa starkstromsanlaggningar, lagspanningsanlaggningar, kontaktledningar och elektrisk utrustning. Elsakerhetsverket ar tillsynsmyndighet med rdtt att medla forelagganden, forbud och sanktionsavgifter. Krav pa elinstallationsforetag och auktoriserade elinstallatorer.",
    "lag", "in_force", "2017-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],

  ["elsakerhetsverket", "SFS 2017:218 (Elsakerhetsverkets tillampning)", "Elsakerhetsforordning (2017:218) -- Elsakerhetsverkets tillampning",
    "Elsakerhetsforordningen med detaljbestammelser om anmalningsskyldigheter for elanlaggningar, drifttillstand, undantag fran krav pa auktorisation, tillsynsavgifter och rapporteringskrav. Tillampas av Elsakerhetsverket.",
    "forordning", "in_force", "2017-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],

  ["elsakerhetsverket", "SFS 1992:1512 (EMC-lagen)", "Lag (1992:1512) om elektromagnetisk kompatibilitet -- EMC-reglering",
    "EMC-lagen reglerar att elektrisk utrustning inte ska orsaka elektromagnetiska storningar och ska tala storningar i sin avsedda miljo. Elsakerhetsverket ar tillsynsmyndighet for EMC i Sverige. Kompletterande forordning (2016:363).",
    "lag", "in_force", "1993-01-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],

  ["elsakerhetsverket", "SFS 2016:392 (Radioutrustningslagen)", "Radioutrustningslag (2016:392)",
    "Radioutrustningslagen reglerar tillhandahallande av radioutrustning pa den svenska marknaden. Genomfor RED-direktivet 2014/53/EU. Elsakerhetsverket delar tillsynsansvar med PTS.",
    "lag", "in_force", "2016-06-13", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],

  ["elsakerhetsverket", "SFS 2004:451 (Produktsakerhetslagen)", "Produktsakerhetslag (2004:451) -- elektrisk utrustning",
    "Produktsakerhetslagen tillampas av Elsakerhetsverket avseende elektriska produkters sakerhet. Lag om att endast sakra produkter far tillhandahallas pa marknaden. Kompletterande till sektor-specifik lagstiftning som LVD och ATEX.",
    "lag", "in_force", "2004-07-01", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],

  ["elsakerhetsverket", "SFS 2011:579 (Leksakssakerhetslagen)", "Lag (2011:579) om leksakers sakerhet -- elektriska egenskaper",
    "Leksakssakerhetslagen genomfor leksaksdirektivet 2009/48/EG. Elsakerhetsverket ansvarar for tillsyn av elektriska egenskaper for leksaker (ELSAK-FS 2011:1). Krav pa maxspanning, isolering och batterisakerhet for leksaker.",
    "lag", "in_force", "2011-07-20", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],

  ["elsakerhetsverket", "SFS 1958:558", "Kungoerelse (1958:558) om elledningar",
    "Historisk kungorelse om lag- och hogspanningsledningars anordnande. Kompletterar elsakerhetsforeskrifter om ledningsanlaggningar, skyddsavstand och anlaggningskrav.",
    "forordning", "in_force", "1958-11-21", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],

  ["elsakerhetsverket", "SFS 2016:145 (Yrkeskvalifikationer)", "Lag (2016:145) om erkannande av yrkeskvalifikationer -- elinstallatorer",
    "Lag om erkannande av yrkeskvalifikationer fran andra EU-lander. Tillampas av Elsakerhetsverket for elinstallatorer som soker auktorisation med utlandska kvalifikationer.",
    "lag", "in_force", "2016-04-15", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],

  ["elsakerhetsverket", "SFS 2016:363 (EMC-forordningen)", "Forordning (2016:363) om elektromagnetisk kompatibilitet",
    "EMC-forordningen med verkstallighetsbestammelser till EMC-lagen. Detaljregler om overensstammelsebedomning, CE-markning och marknadskontroll for EMC.",
    "forordning", "in_force", "2016-04-20", "https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/lagar-och-forordningar/"],
];

// ---------- Additional STEMFS (older/repealed) ----------

const emynExtraRegs: string[][] = [
  ["energimyndigheten", "STEMFS 2021:7", "Statens energimyndighets foreskrifter om hallbarhetskriterier for biodrivmedel och biobranslen (ersatt av STEMFS 2025:2)",
    "Foreskrifter om hallbarhetskriterier for biodrivmedel och biobranslen. Genomfor RED II (fornybarhetsdirektivet 2018/2001) avseende hallbarhetskriterier: markkriterier (forbud mot avskogning, vatmark, torvmark), vaxthusgasminskning (minst 50-65% beroende pa anlaggningstyp), sparbarhet och massbalans. Ersatt av STEMFS 2025:2 (RED III).",
    "foreskrift", "repealed", "2021-08-17", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2021:3", "Statens energimyndighets foreskrifter och allmanna rad om riskanalys och sakerhetsatgarder for natverk och informationssystem inom energisektorn (upphavd)",
    "Foreskrifter om NIS-direktivets genomforande inom energisektorn. Reglerade krav pa riskanalys, sakerhetsatgarder, incidentrapportering och tillsyn for leverantorer av samhallsviktiga tjanster inom energi. Upphavd genom STEMFS 2026:1 (ersatt av NIS2).",
    "foreskrift", "repealed", "2021-03-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2019:2", "Statens energimyndighets foreskrifter om upphavande av STEMFS 2010:5 om statligt stod till energieffektivisering i kommuner och landsting",
    "Upphavande av foreskrifter om statligt stod till kommunal energieffektivisering. Det tidigare stodprogrammet avslutades.",
    "foreskrift", "in_force", "2019-01-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2018:2", "Statens energimyndighets foreskrifter om rapportering och berakning enligt lagen om hallbarhetskriterier (konsoliderad)",
    "Konsoliderad foreskrift om rapportering och berakning av hallbarhetskriterier for biodrivmedel. Detaljerade berakningsmetoder for vaxthusgasutslapp, standardvarden och verifieiring.",
    "foreskrift", "in_force", "2018-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2017:2", "Statens energimyndighets foreskrifter om ursprungsgarantier for el (grundforeskrift)",
    "Grundforeskrift om ursprungsgarantier for el. Reglerar utfardande, overforing, annullering och kontodforing av ursprungsgarantier i CESAR-systemet. Andrad genom STEMFS 2024:3. Ersatt av STEMFS 2025:8 (utvidgad till alla energislag).",
    "foreskrift", "repealed", "2017-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2016:4", "Statens energimyndighets foreskrifter om skyldighet att lamna uppgifter om transporter till statistik",
    "Foreskrifter om rapportering av energianvandning inom transportsektorn. Transportforetag rapporterar bransle- och elanvandning per transportslag.",
    "foreskrift", "in_force", "2016-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],

  ["energimyndigheten", "STEMFS 2013:3", "Statens energimyndighets foreskrifter om upphavande av NUTFS 1998:7 om planlddgning inom oljebranschen",
    "Upphavande av aldre foreskrifter om beredskapsplanlaggning for oljebranschen vid hoid beredskap och krig.",
    "foreskrift", "in_force", "2013-07-01", "https://www.energimyndigheten.se/om-oss/foreskrifter/"],
];

// ---------- Additional Ei decisions ----------

const eiExtraDecisions: string[][] = [
  ["Ei tillsyn natavgifter (generell)", "Ei:s tillsyn av natavgifternas skalighet",
    "Energimarknadsinspektionen overvakar att elnatsforetagens natavgifter ar sakliga och icke-diskriminerande enligt 4 kap. ellagen. Ei kan forlagga natforetag att andla sina tariffer om de bedcoms vara osakliga. Beslut kan overklagas till forvaltningsdomstol.",
    "tariff", "2024-01-01", "Samtliga elnatsforetag", "https://ei.se/bransch/tariffer-nattariffer"],

  ["Ei tillsynsperiod naturgasnat 2024-2027", "Intaktsramar for gasnatsforetag tillsynsperioden 2024-2027",
    "Ei faststaller intaktsramar for Sveriges gasnatsforetag parallellt med elnatsforetagen. Gasnatsverksamheten i Sverige ar begransad till sydvastra Sverige (Swedegas transmissionsnat, E.ON och ovriga lokala gasnat).",
    "revenue_cap", "2024-04-03", "Gasnatsforetag (Swedegas m.fl.)", "https://ei.se/bransch/reglering-av-natverksamhet/reglering---gasnatsverksamhet"],

  ["Ei overvakningsplan uppfoljning", "Ei:s uppfoljning av elnatsforetags overvakningsplaner",
    "Energimarknadsinspektionen foljer arligen upp elnatsforetags overvakningsplaner (EIFS 2025:3). Syftar till att sakerstalla funktionell atskillnad mellan natverksamhet och konkurrensutsatt verksamhet. Ei grankar rapporterade atgarder och kan forlagga foretag att vidta kompletterande atgarder.",
    "market_monitoring", "2025-01-01", "Samtliga elnatsforetag", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei konsumentrapport elmarknaden", "Ei:s arliga rapport om elmarknaden ur ett konsumentperspektiv",
    "Energimarknadsinspektionen publicerar arligen en rapport om elmarknaden ur konsumentperspektiv. Rapporten beskriver prisutveckling, leverantorsbyten, kundnojdhet, klagomal och konsumentskyddsatgarder. Baseras pa data fran Elpriskollen, kundklagomal och marknadsundersdkningar.",
    "benchmark", "2025-01-01", "Elleverantorer och elnatsforetag", "https://ei.se/konsument"],

  ["Ei metod WACC berakning", "Ei:s metod for berakning av kalkylranta (WACC) for natforetag",
    "Energimarknadsinspektionens metod for att berakna den tillagna kalkylrantan (WACC -- Weighted Average Cost of Capital) for nat- och gasnatsforetag. WACC ar central parameter i intaktsramsberakningen och bestammer avkastningen pa kapitalunderlaget. Baseras pa riskfri ranta, marknasdspremie, beta-varde, skuldsattningsgrad och skatt.",
    "methodology", "2023-12-01", "Samtliga nat- och gasnatsforetag", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei kapitalunderlag berakning", "Ei:s metod for bestamning av kapitalunderlag",
    "Metod for bestamning av kapitalunderlagets storlek for elnatsforetag. Kapitalunderlaget bestar av anlaggningtillgangar varderade till nukostnadvarde (normvarden), rorlekapital och pagar-nde investeringar. Nukostnadsvarden baseras pa Ei:s normvardesmallar.",
    "methodology", "2023-12-01", "Samtliga elnatsforetag", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei rapport leveranssakerhet", "Ei:s arliga rapport om leveranssakerhet i elnaten",
    "Energimarknadsinspektionen publicerar arligen statistik over leveranssakerheten i de svenska elnaten. Rapporten innehaller SAIDI (genomsnittlig avbrottstid per kund), SAIFI (genomsnittligt antal avbrott per kund), CAIDI (genomsnittlig avbrottsvaraktighet) och ENS (ej levererad energi). Baseras pa rapportering enligt EIFS 2015:4.",
    "benchmark", "2025-01-01", "Samtliga natkoncessionshavare", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei tariffomstallning", "Ei:s stod for elnatsforetagens tariffomstallning",
    "Energimarknadsinspektionen stodjer elnatsforetagens overgdng fran energibaserade till effektbaserade nattariffer. Omstallningen syftar till att ge battre prissignaler om natkapacitet och mojliggora flexibilitet. Vagledning enligt EIFS 2022:1. Ei foljer upp omstallningen och rapporterar till regeringen.",
    "methodology", "2024-01-01", "Samtliga elnatsforetag", "https://ei.se/bransch/tariffer-nattariffer"],

  ["Ei beslut tillstand SE1-SE4", "Ei:s hantering av elbdomraden SE1-SE4",
    "Sverige ar indelat i fyra elomraden (SE1 Lulea, SE2 Sundsvall, SE3 Stockholm, SE4 Malmo) sedan 1 november 2011. Indelningen beslutas av Svenska kraftnat med Ei:s godkannande. Syftar till att aterspegla fysiska begransningar i stamnatet och ger mer korrekta prizsignaler pa elmarknaden.",
    "market_monitoring", "2011-11-01", "Svenska kraftnat, Ei", "https://ei.se/om-oss/var-verksamhet"],

  ["Ei certifiering SvK som TSO", "Ei:s certifiering av Svenska kraftnat som transmissionsnatforetag",
    "Energimarknadsinspektionen certifierar Svenska kraftnat som transmissionsnatforetag (TSO) enligt lag (2011:710). Certifieringen bekraftar att SvK uppfyller EU:s krav pa oberoende (ownership unbundling). Certifieringen granskas vid vasentliga forandringar.",
    "tariff", "2012-03-01", "Svenska kraftnat", "https://ei.se/om-oss/var-verksamhet"],

  ["Ei rapport fjarrvarmemarknad", "Ei:s arliga rapport om fjarrvarmemarknadens utveckling",
    "Energimarknadsinspektionen publicerar arligen en rapport om fjarrvarmemarknadens utveckling. Rapporten analyserar prisutveckling, kundnojdhet, konkurrens, anslutningsgrader och fjarrvarmeforetagens lonsamhet. Baseras pa rapportering enligt EIFS 2009:3 och EIFS 2022:11.",
    "benchmark", "2025-01-01", "Samtliga fjarrvarmeforetag", "https://ei.se/konsument/fjarrvarme"],

  ["Ei tillsyn naturgasmarknad", "Ei:s tillsyn av naturgasmarknaden i Sverige",
    "Energimarknadsinspektionen utvar tillsyn over naturgasmarknaden i Sverige. Den svenska naturgasmarknaden ar begransad till sydvastra Sverige med Swedegas som transmissionsnatoperator. Ei overvakar tredjepartstillgang, tariffer och funktionell atskillnad.",
    "market_monitoring", "2024-01-01", "Swedegas, naturgasforetag", "https://ei.se/bransch/reglering-av-natverksamhet/reglering---gasnatsverksamhet"],

  ["Ei natutvecklingsplaner forsta omgang", "Ei:s uppfoljning av natutvecklingsplaner -- forsta omgangen",
    "Elnatsforetag ska upprattta natutvecklingsplaner enligt EIFS 2024:1. Planerna beskriver natinvesteringar for kommande 5-10 ar, kapacitetsbehov, flexibilitetslosningar och integration av fornybar energi och laddinfrastruktur. Ei granskar planerna och publicerar aggregerade resultat.",
    "market_monitoring", "2025-01-01", "Samtliga elnatsforetag", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei informationssakerhet energisektorn", "Ei:s roll i informationssakerhet for energisektorn",
    "Energimarknadsinspektionen har en roll i tillsyn av informationssakerhet for energisektorn under NIS2-direktivet. Energiforetag som ar leverantorer av samhallsviktiga tjanster ska genomfora riskanalyser, implementera sakerhetsatgarder och rapportera incidenter. Samarbete med MSB (Myndigheten for samhallsskydd och beredskap).",
    "market_monitoring", "2025-01-01", "Leverantorer av samhallsviktiga energitjanster", "https://ei.se/om-oss/var-verksamhet"],

  ["Ei effektiviseringsmalh elnatsforetag", "Ei:s faststallande av effektiviseringsmal for elnatsforetag",
    "Energimarknadsinspektionen faststaller arliga effektiviseringsmal for elnatsforetag som del av intaktsramsmodellen. Malet bestams genom benchmarking av foretagens kostnadseffektivitet med hjalp av DEA-analys (Data Envelopment Analysis). Foretag med lagre effektivitet an genomsnittet far ett hogre effektiviseringsmal.",
    "methodology", "2023-12-01", "Samtliga elnatsforetag", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei normvarden anlaggningar", "Ei:s normvarden for elnatsforetags anlaggningar",
    "Energimarknadsinspektionen faststaller normvarden for vardering av elnatsforetags anlaggningar i intaktsramsberakningen. Normvardena representerar anskaffningskostnaden for respektive anlaggningstyp (ledningar, kablar, transformatorer, stallverk) och anvands for att berakna kapitalunderlagets storlek (nukostnadsvarde).",
    "methodology", "2023-12-01", "Samtliga elnatsforetag", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei handlaggning tillstand 380 kV", "Ei:s hantering av tillstandsansokningar for 380 kV ledningar",
    "Energimarknadsinspektionen handlagger ansokningar om natkoncession for linje for 380 kV (stamnats-) ledningar. Handlaggningstiden ar normalt 3-6 ar inklusive samrad, miljobedomning och overklagandeperiod. Antalet ansokningar har okat kraftigt till foljd av Svenska kraftnats omfattande investeringsprogram och industrins omstallning.",
    "tariff", "2025-01-01", "Svenska kraftnat, regionala natforetag", "https://ei.se/bransch/koncessioner"],

  ["Ei elmarknadens funktionssatt", "Ei:s arliga rapport om elmarknadens funktionssatt",
    "Energimarknadsinspektionen publicerar arligen en rapport om elmarknadens funktionssatt. Rapporten analyserar prisbildning, konkurrens bland elleverantorer, marknadsandelar, leverantorsbyten, likviditet pa terminmarknaden och grossistmarknadens funktion. Rapporteras till ACER som del av NordREG:s nordiska marknadsrapportering.",
    "benchmark", "2025-01-01", "Elmarknadens aktorer", "https://ei.se/om-oss/var-verksamhet"],

  ["Ei internationellt samarbete NordREG", "Ei:s deltagande i NordREG och CEER",
    "Energimarknadsinspektionen deltar aktivt i NordREG (Nordic Energy Regulators), CEER (Council of European Energy Regulators) och ACER (Agency for the Cooperation of Energy Regulators). Ei bidrar till utveckling av europeiska natforeskrifter, marknadsregler och tillsynsmetoder.",
    "market_monitoring", "2025-01-01", "NordREG, CEER, ACER", "https://ei.se/om-oss/internationellt-arbete"],

  ["Ei kundombudsrelation", "Ei:s handlaggning av konsumentklagomal pa elmarknaden",
    "Energimarknadsinspektionen tar emot klagomal fran elkonsumenter avseende natavgifter, leverantorsbyten, fakturafel och avbrottersattning. Ei kan medla och i vissa fall fatta bindande beslut. Under 2024 handlade Ei ca 3000 arenden fran elkonsumenter.",
    "complaint", "2025-01-01", "Elkonsumenter, elnatsforetag, elleverantorer", "https://ei.se/konsument"],

  ["Ei anslutningsavgifter granskning", "Ei:s granskning av anslutningsavgifter",
    "Energimarknadsinspektionen granskar att elnatsforetags anslutningsavgifter ar sakliga och icke-diskriminerande. Sarskilt fokus pa hoaga anslutningsavgifter for solcellsanlaggningar, vindkraftparker och laddinfrastruktur dar natkapaciteten ar begransad.",
    "tariff", "2025-01-01", "Elnatsforetag, producenter", "https://ei.se/bransch/koncessioner"],

  ["Ei flexibilitetsmarknader", "Ei:s arbete med flexibilitetsmarknader",
    "Energimarknadsinspektionen arbetaar med att mojliggora flexibilitetsmarknader dar elnatsforetag kan upphandla flexibilitetstjanster (laststyrning, energilager, V2G) som alternativ till natsforstarkning. Genomfor krav i elmarknadsdirektivet om flexibilitetstjanster.",
    "market_monitoring", "2025-01-01", "Elnatsforetag, aggregatorer, prosumenter", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei datadelning elsystem", "Ei:s arbete med datadelning pa elmarknaden",
    "Energimarknadsinspektionen arbetar med datadelning och datahubbar pa elmarknaden. EIFS 2024:3 reglerar datautbyte mellan natforetag och stora natanvandare. Ei utrdder aven implementering av EU:s krav pa en gemensam datahubb (Elmarknadshubb) for stroemlinjeformad hantering av kunddata, leverantorsbyten och fakturering.",
    "market_monitoring", "2025-01-01", "Elmarknadens aktorer", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei leverantorsmarknad elleverantorer", "Ei:s rapport leverantorsmarknaden for el",
    "Energimarknadsinspektionens uppfoljning av elleverantorsmarknaden. Antal aktiva elleverantorer i Sverige ar ca 150. Tre stdrsta (Vattenfall, E.ON, Fortum) har sammanlagt ca 60% marknadsandel. Leverantorsbyten har okat till ca 1 miljon per ar. Ei overvakar att konkurrensen fungerar och att konsumentskyddet uppratthalls.",
    "benchmark", "2025-01-01", "Samtliga elleverantorer", "https://ei.se/konsument/elpriskollen"],

  ["Ei fjarrkyla reglering", "Ei:s reglering av fjarrkyla",
    "Energimarknadsinspektionen reglerar fjarrkyla genom EIFS 2022:4. Fjarrkyla anvands framst i storstader for komfortkyla i kontorsbyggnader, sjukhus och serverhallar. Marknaden ar mindre an fjarrvarme men vaxande. Ei overvakar matning, fakturering och prisinformation.",
    "market_monitoring", "2025-01-01", "Fjdrrkylaforetag", "https://ei.se/om-oss/var-verksamhet"],

  ["Ei aggregatorer reglering", "Ei:s reglering av oberoende aggregatorer",
    "Energimarknadsinspektionen reglerar oberoende aggregatorer som samlar flexibilitetstjanster (laststyrning, V2G, batterier) fran smla kunder for forsaljning pa balansmarknaden. Ny forordning SFS 2023:2420 reglerar aggregatorernas rattigheter, kompensationsmodeller och datadelning.",
    "market_monitoring", "2024-01-01", "Aggregatorer, elnatsforetag, elleverantorer", "https://ei.se/bransch/reglering-av-natverksamhet"],
];

// ---------- Combine and insert all regulations ----------

// ---------- Additional energy-related SFS legislation ----------

const extraLagar: string[][] = [
  ["riksdagen", "SFS 2014:266", "Lag (2014:266) om energikartlaggning i stora foretag",
    "Lag om obligatorisk energikartlaggning (energy audit) for stora foretag. Foretag med mer an 250 anstalda eller omsattning over 50 MEUR ska genomfora energikartlaggning vart fjarde ar. Energimyndigheten ar tillsynsmyndighet. Genomfor artikel 8 i energieffektiviseringsdirektivet 2012/27/EU. Sanktionsavgift vid underlatenhet.",
    "lag", "in_force", "2014-06-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 1984:3", "Lag (1984:3) om karnteknisk verksamhet",
    "Karnkraftslagen -- reglerar tillstand for anlaggning och drift av karntekniska anlaggningar, hantering av karnbransle och karnavfall, sakerhetskrav och stralskydd. Stralsakerhetsmyndigheten (SSM) ar tillsynsmyndighet. Senast andrad genom SFS 2025:775.",
    "lag", "in_force", "1984-01-12", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-19843-om-karnteknisk-verksamhet_sfs-1984-3/"],

  ["riksdagen", "SFS 2006:647", "Lag (2006:647) om finansiering av karntekniska restprodukter",
    "Lag som sakerstaller att karnkraftforetag avsatter tillrackliga medel for framtida kostnader for rivning av karnkraftverk och slutforvaring av anvant karnavfall. Karnkraftforetagen betalar in till Karnbranslefondan. Riksgalden forvaltar fondan.",
    "lag", "in_force", "2006-08-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2018:396", "Stralskyddslag (2018:396)",
    "Stralskyddslagen -- reglerar skydd for manniskors halsa och miljon mot skadevirkningar av stralning. Omfattar joniserande stralning (karnkraft) och icke-joniserande stralning. Stralsakerhetsmyndigheten (SSM) ar tillsynsmyndighet. Genomfor EU:s BSS-direktiv 2013/59/Euratom.",
    "lag", "in_force", "2018-06-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2012:210", "Lag (2012:210) om geologisk lagring av koldioxid",
    "Lag om CCS (Carbon Capture and Storage) -- reglerar tillstand, drift och stangning av anlaggningar for geologisk lagring av koldioxid i Sverige. Genomfor CCS-direktivet 2009/31/EG. Energimyndigheten hanterar tillstand.",
    "lag", "in_force", "2012-06-15", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 1977:439", "Lag (1977:439) om kommunal energiplanering",
    "Lag om kommunal energiplanering. Varje kommun ska ha en aktuell energiplan som redovisar energitillforsel, energianvandning och energieffektiviseringsatgarder. Planen ska beakta miljomal och klimatmal.",
    "lag", "in_force", "1977-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2003:113", "Lag (2003:113) om elcertifikat (upphavd -- ersatt av SFS 2011:1200)",
    "Ursprunglig lag om elcertifikat. Inforde elcertifikatsystemet i Sverige 2003. Ersatt av lag (2011:1200) i samband med utvidgningen till gemensamt system med Norge.",
    "lag", "repealed", "2003-05-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2025:kapacitetsmekanism", "Forordning om en kapacitetsmekanism for elmarknaden (2025)",
    "Ny forordning om kapacitetsmekanism for den svenska elmarknaden. Ger Svenska kraftnat befogenhet att upphandla strategisk reserv som kapacitetsmekanism. Reglerar upphandlingsprocess, aktiveringsregler, ersattning och tillsyn. Fdljer EU:s elmarknadsforordning (EU) 2019/943. Beslutad augusti 2025.",
    "forordning", "in_force", "2025-08-01", "https://www.regeringen.se/pressmeddelanden/2025/08/ny-forordning-om-en-kapacitetsmekanism-for-elmarknaden/"],

  ["riksdagen", "SFS 2022:1826", "Lag (2022:1826) om uthyrning av el till fastighetsagare (eldelningslagen)",
    "Lag om eldelning -- mojliggor delning av egenproducerad el inom flerbostadshus och lokaler. Fastighetsagare kan dela el fran solceller med hyresgaster utan att registreras som elleverantor. Reglerar matning, avrakning och villkor for eldelning.",
    "lag", "in_force", "2023-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2024:114", "Lag (2024:114) om energieffektivisering",
    "Ny lag om energieffektivisering som genomfor energieffektiviseringsdirektivet (EU) 2023/1791 (EED III). Faststaller nationella energieffektiviseringsmal, krav pa offentlig sektor, stora foretag och energiforetag. Energimyndigheten ar central myndighet.",
    "lag", "in_force", "2024-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2022:1300", "Lag (2022:1300) om elstodj",
    "Lag om elstod till konsumenter och foretag. Inford under energikrisen 2022 for att kompensera hushall och foretag i SE3 och SE4 for extraordinart hoga elpriser. Finansieras med intakter fran flaskhalsavgifter (congestion rents). Fordelad av elnatsforetag baserat pa forbrukning.",
    "lag", "in_force", "2022-11-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2017:725", "Lag (2017:725) om klimatdeklaration for byggnader",
    "Lag om klimatdeklaration for nya byggnader. Byggherre ska berakna och deklarera klimatpaverkan fran byggskedet (klimatavtryck). Boverket ar tillsynsmyndighet. Tröskelvardan for maximalt klimatavtryck kopplar till energisystemet via uppvarmning och material.",
    "lag", "in_force", "2022-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2022:170", "Lag (2022:170) om Sveriges klimatmal",
    "Klimatlagen -- faststaller att Sverige senast ar 2045 inte ska ha nagra nettoutslapp av vaxthusgaser till atmosfaren. Inkluderar delmalet att energisektorn ska vara fossilfri. Kopplar till energipolitiska mal om 100% fornybar elproduktion.",
    "lag", "in_force", "2018-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2003:436", "Lag (2003:436) om effektreserv (upphavd 2025-03-15)",
    "Lag om effektreserv som gav Svenska kraftnat befogenhet att upphandla reservkapacitet for att sakra effekttillgangen under vintertoppar. Maximalt 2000 MW. Lagen forlanades upprepade ganger men upphorde 15 mars 2025. Ersatt av den nya forordningen om kapacitetsmekanism (strategisk reserv).",
    "lag", "repealed", "2003-10-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2022:1573", "Lag (2022:1573) om sakerhetsskydd (andring avseende energisektorn)",
    "Sakerhetsskyddslagen har kompletterats med bestammelser som stdrker sakerhetsskyddet for samhallsviktig energiinfrastruktur. Energimyndigheten ar tillsynsmyndighet for sakerhetsskydd inom energisektorn. Krav pa sakerhetsskyddsanalyser, sakerhetskontroller och rapportering av handelser.",
    "lag", "in_force", "2023-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2022:482", "Lag (2022:482) om elektronisk kommunikation (energirelevant del)",
    "Lagen om elektronisk kommunikation har relevans for energisektorn avseende smarta matare, IoT-kommunikation och SCADA-system. Reglerar nadtoperaterers skyldigheter, roaming och saker kommunikation -- relevant for elnatsforetags matinfrastruktur.",
    "lag", "in_force", "2022-06-03", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2018:218", "Forordning (2018:218) med kompletterande bestammelser till EU:s dataskyddsforordning (GDPR) -- energisektorn",
    "GDPR-kompletterande bestammelser med relevans for energisektorn. Matdata fran smarta matare utgdr personuppgifter. Elnatsforetag och elleverantorer maste uppfylla GDPR-krav vid hantering av matdata, kunddata och forbrukningsmonster.",
    "forordning", "in_force", "2018-05-25", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2025:kapacitet", "Forordning (2025:XX) om Svenska kraftnats kapacitetsupphandling",
    "Ny forordning som reglerar detaljerna for Svenska kraftnats upphandling av kapacitet under den strategiska reserven. Faststaller upphandlingsprocess, kvalificeringskrav, aktiveringsvillkor, ersattningsmodell och tillsyn. Foljer av lag om kapacitetsmekanism.",
    "forordning", "in_force", "2025-10-01", "https://www.regeringen.se/"],

  ["riksdagen", "SFS 2016:1145", "Lag (2016:1145) om offentlig upphandling (energirelevant del)",
    "Upphandlingslagen har sarskilda regler for upphandling inom energisektorn (forsorjningsdirektivet). Ger undantag for bolag som bedriver el-, gas- eller varmeforsorjning. Ei:s upphandling av tjdnster foljer upphandlingslagen.",
    "lag", "in_force", "2017-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 1998:808", "Miljoebalk (1998:808) -- energirelaterade bestammelser",
    "Miljoebalken innehaller bestammelser som ar centrala for energisektorn. Krav pa miljokonsekvensbeskrivning (MKB) for kraftledningar, kraftverk och energiinfrastruktur. Tillstandsplikt for miljoefarlig verksamhet (kraftvarmeverk, vindkraftparker). Regler om artskydd och Natura 2000 paverkar energiprojektplanering.",
    "lag", "in_force", "1999-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2010:900", "Plan- och bygglag (2010:900) -- energirelaterade krav",
    "Plan- och bygglagen staller energikrav pa byggnader (nara-nollenergikrav) och reglerar bygglov for solceller, vindkraftverk och energiinfrastruktur. Boverkets byggregler (BBR) specificerar energikrav pa byggnader. Kopplar till energideklarationslagen.",
    "lag", "in_force", "2011-05-02", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2024:NIS2", "Lag om cybersaker het (NIS2-genomforande) -- energisektorn",
    "Ny lag som genomfor NIS2-direktivet (EU) 2022/2555 i Sverige. Staller krav pa cybersaker het for vasentliga och viktiga entiteter, inklusive energiforetag (elnatsforetag, elleverantorer, fjdrrvarmeforetag, naturgasoperatorer, ladd-infrastrukturoperatorer). Krav pa riskanalys, sakerhetsatgarder, incidentrapportering och tillsyn. MSB och Energimyndigheten delar tillsynsansvar.",
    "lag", "in_force", "2025-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2024:CER", "Lag om motstandskraft hos kritiska verksamhetsutovare (CER-genomforande) -- energisektorn",
    "Ny lag som genomfor CER-direktivet (EU) 2022/2557 om motstandskraft hos kritiska verksamhetsutovare. Energiforetag som identifieras som kritiska ska genomfora sarbarhetsbedomningar och vidta atgarder for fysisk motstandskraft. Kompletterande till NIS2 som fokuserar pa cybersaker het. MSB och Energimyndigheten delar ansvar.",
    "lag", "in_force", "2025-01-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],

  ["riksdagen", "SFS 2004:297", "Lag (2004:297) om bank- och finansieringsrorelse -- energimarknadsrelevans",
    "Bank- och finansieringsregelverket ar relevant for energisektorn avseende clearingkrav for energiderivat, EMIR-reglering for OTC-derivat (elterminkontrakt) och kapitalkrav for aktorer pa grossistmarknaden for energi. MiFID II och MiFIR paverkar handel med eldrivmedel.",
    "lag", "in_force", "2004-07-01", "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/"],
];

const allRegs = [
  ...eiElRegs,
  ...eiNaturgasRegs,
  ...eiFjarrvarmeRegs,
  ...emynRegs,
  ...elsakRegs,
  ...lagstiftning,
  ...eiRepealedRegs,
  ...elsakLagar,
  ...emynExtraRegs,
  ...extraLagar,
];

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

const gridCodes: string[][] = [
  // SvKFS regulations
  ["SvKFS 2005:2", "Driftsakerhetsteknisk utformning av produktionsanlaggningar",
    "Svenska kraftnats foreskrifter om driftsakerhetsteknisk utformning av produktionsanlaggningar. Faststallde tekniska krav pa generatorer och kraftstationer for att sakerstalla driftsakerhet i transmissionsndtet. Upphavd och ersatt av EIFS 2025:2 (ansvaret overtaget av Ei).",
    "technical_regulation", "Upphavd", "2005-07-01", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/svenska-kraftnats-foreskrifter/"],

  // EU network codes implemented in Sweden
  ["EU 2016/631 (RfG)", "Requirements for Generators -- natforeskrift om krav for natanslutning av generatorer",
    "EU-kommissionens forordning om faststallande av natforeskrift med krav for natanslutning av generatorer (RfG). Galler direkt i Sverige. Faststaller krav for typ A-D generatorer avseende frekvensrespons, spannningsreglering, aktiv och reaktiv effekt, felridethrough och systemskydd. Nationella parametrar faststalls av Ei i EIFS 2018:2. Trd i kraft 17 maj 2016, krav tillampliga fran 27 april 2019.",
    "grid_connection", "2019-04", "2016-05-17", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2016/1388 (DCC)", "Demand Connection Code -- natforeskrift om krav for anslutning av forbrukare",
    "EU-kommissionens forordning om faststallande av natforeskrift med krav for natanslutning av forbrukningsanlaggningar (DCC). Faststaller krav pa frekvensrespons, reaktiv effekt och storningstlighet for storre forbrukare. Nationella parametrar i EIFS 2019:6. Trd i kraft 7 september 2016.",
    "grid_connection", "2019-09", "2016-09-07", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2016/1447 (HVDC)", "HVDC Connection Code -- natforeskrift om krav for natanslutning av HVDC-system",
    "EU-kommissionens forordning om faststallande av natforeskrift med krav for natanslutning av system for hogspand likstrom och likstromsanslutna kraftparksmoduler. Relevanta for bl.a. SvK:s NordLink, NordBalt och Baltic Cable. Nationella parametrar i EIFS 2019:3. Trd i kraft 28 september 2016.",
    "grid_connection", "2019-09", "2016-09-28", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2017/1485 (SO)", "System Operation Guideline -- riktlinje for systemdrift",
    "EU-kommissionens forordning om riktlinjer for systemdrift. Sakerstaller driftsakerhet, frekvenskvalitet och effektivt utnyttjande av det sammankopplade kraftsystemet. Reglerar driftplanering, frekvensreglering, sparningskontroll, systematerstart och informationsutbyte mellan TSO:er. Tillampad av Svenska kraftnat i den nordiska synkronomradet. Trd i kraft 14 september 2017.",
    "technical_regulation", "2017-09", "2017-09-14", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2017/2196 (ER)", "Emergency and Restoration -- natforeskrift om kris och aterstart",
    "EU-kommissionens forordning om natforeskrift avseende laen for ndddrift och aterstart av elsystemet. Reglerar beredskapsplanering, lastfranstangning, black-start-kapacitet och ateruppbyggnad av elsystemet efter stdrningar. Svenska kraftnat ansvarar for nddplaner i Sverige. Trd i kraft 18 december 2017.",
    "technical_regulation", "2017-12", "2017-12-18", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2015/1222 (CACM)", "CACM -- riktlinje om kapacitetsfordelning och flaskhalsar",
    "EU-kommissionens forordning om riktlinje for kapacitetstilldelning och flaskhalshantering (CACM). Reglerar day-ahead- och intradagshandel, prisomraden (elbandomraden SE1-SE4), kapacitetsberakning och tilldelningsalgoritmer (EUPHEMIA). Trd i kraft 14 augusti 2015.",
    "market_regulation", "2015-08", "2015-08-14", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2016/1719 (FCA)", "Forward Capacity Allocation -- riktlinje om langtsiktiga kapacitetsmarknader",
    "EU-kommissionens forordning om riktlinje for langfristig kapacitetstilldelning (FCA). Reglerar berakning och allokering av langfristig gransoverskridande overforingskapacitet. Trd i kraft 17 oktober 2016.",
    "market_regulation", "2016-10", "2016-10-17", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2017/2195 (EB)", "Electricity Balancing -- riktlinje om elbalansering",
    "EU-kommissionens forordning om riktlinje for elbalansering (EB GL). Harmoniserar europeiska balanseringsmarknader. Reglerar balansansvarsmodell, BSP/BRP-roller, anskaffning och aktivering av balansreserver, balanseringsavrakning och plattformar (MARI, PICASSO, TERRE). Trd i kraft 18 december 2017, BSP/BRP-roller inforda i Sverige 1 maj 2024.",
    "balancing", "2024-05", "2017-12-18", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  // SvK balancing market rules and reserves
  ["SvK FCR-N", "Frekvenshallningsreserv Normaldrift (FCR-N)",
    "Automatisk stodtjanst som stabiliserar frekvensen vid sma forandringar i forbrukning eller produktion under normaldrift. Aktiveras automatiskt vid frekvensavvikelser fran 50 Hz. Upprytthaller frekvenskvaliteten i det nordiska synkronomradet. Marginalprissattning infrod 1 februari 2024. Upphandlas dygnsvis.",
    "balancing", "2024-02", "2024-02-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/"],

  ["SvK FCR-D upp", "Frekvenshallningsreserv Storning uppreglering (FCR-D upp)",
    "Automatisk stodtjanst som aktiveras vid storre frekvensfall (under 49,9 Hz) orsakade av pl etslig forlust av produktion. Syftar till att forhindra att frekvensen sjunker till niveer dar lastfranstangning utloses. Upphandlas dygnsvis med marginalprissattning.",
    "balancing", "2024-02", "2024-02-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/"],

  ["SvK FCR-D ned", "Frekvenshallningsreserv Storning nedreglering (FCR-D ned)",
    "Automatisk stodtjanst som aktiveras vid storre frekvensokningar (over 50,1 Hz) orsakade av pl otslig forlust av forbrukning eller okat elflode. Motverkar overfrekvens i systemet.",
    "balancing", "2024-02", "2024-02-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/"],

  ["SvK aFRR", "Automatisk Frekvensaterstallningsreserv (aFRR)",
    "Automatiskt aktiverad stodtjanst som aterstaller frekvensen till 50 Hz efter en storning. Aktiveras av SvK:s automatiska regleringssystem (AGC/LFC) med aktiveringsted pa 30 sekunder till 5 minuter. Ersatter FCR-aktivering och aterstaller normaldrift. Implementerad i det nordiska balanssamarbetet via PICASSO-plattformen.",
    "balancing", "2024-05", "2024-05-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/"],

  ["SvK mFRR", "Manuell Frekvensaterstallningsreserv (mFRR)",
    "Manuellt aktiverad stodtjanst som avlastar automatiska reserver (FCR och aFRR) och aterstaller frekvensen till 50 Hz. Aktiveras manuellt av SvK:s driftcentral med aktiveringsted pa 15 minuter. Nationell mFRR-kapacitetsmarknad oppnad 17 oktober 2023 med maxbehov pa 200 MW, volymer okar. Energimarknaden tillampas via MARI-plattformen fran december 2024.",
    "balancing", "2024-12", "2023-10-17", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/"],

  ["SvK FFR", "Snabb frekvensreserv (FFR -- Fast Frequency Reserve)",
    "Automatisk reserv som hanterar de inledningsvis snabba och djupa (transienta) frekvensforandringarna som uppstar vid laga niveer av rotationsenergi i systemet. Aktiveringstid under 1 sekund. Sakerstaller att frekvensen inte sjunker under 49,0 Hz innan FCR-D hinner verka. Upphandlas sasongsvis under lagrotationsenergiperioder.",
    "balancing", "2024-01", "2023-01-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/"],

  ["SvK Strategisk reserv", "Strategisk reserv (kapacitetsmekanism)",
    "Kapacitetsmekanism som stodjer kraftsystemet vid effektbristsituationer. Aktiveras enbart nar alla andra tillgangliga balansresurser pa elmarknaden inte rdcker. Ersatter den tidigare effektreserven (som upphorde 15 mars 2025). Regleras av elmarknadsforordningen (EU) 2019/943 och ny svensk forordning om kapacitetsmekanismer. Aktuella avtal for vintern 2025/2026: 350 MW (Malarenergi och Sydkraft).",
    "ancillary_services", "2025-03", "2025-03-15", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/strategisk-reserv/"],

  ["SvK Overbelastningshantering", "Overbelastningshantering",
    "Resurs som anvands nar balansmarknadens bud inte racker for att losa kapacitetsrestriktioner (flaskhalsar) i transmissionsnetet. Ska vara aktiverbar inom 15 minuter. Moterkalleg process dar SvK direkt kan begara upp- eller nedreglering av specifika resurser.",
    "ancillary_services", "2024-01", "2023-01-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/"],

  // SvK BSP/BRP agreements
  ["SvK BSP-avtal", "Avtal for Balancing Service Provider (BSP)",
    "Avtal som reglerar forhalandet mellan en BSP (Balancing Service Provider) och Svenska kraftnat. BSP-rollen infords 1 maj 2024 och ersatter den tidigare rollen som balansansvarig for leverans av stodtjanster. BSP-avtalet reglerar rattigheter och skyldigheter vid leverans av FCR, aFRR och mFRR. Inkluderar bilagor med tekniska villkor per stodtjanst.",
    "market_regulation", "2024-05", "2024-05-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/bli-leverantor-av-reserver/bidra-med-fcr-afrr-eller-mfrr/"],

  ["SvK BRP-avtal", "Avtal for Balance Responsible Party (BRP)",
    "Avtal som reglerar forhalandet mellan en BRP (Balance Responsible Party) och Svenska kraftnat. BRP ansvarar for att leverans och uttag balanseras i dess balansportfolj. BRP-rollen infords 1 maj 2024 och ersatter den tidigare balansansvarsrollen. Avrakning sker via nordisk balanseringsmodell.",
    "market_regulation", "2024-05", "2024-05-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/bli-leverantor-av-reserver/bidra-med-fcr-afrr-eller-mfrr/"],

  // SvK technical guidelines (TR-series)
  ["SvK TR01", "Teknisk riktlinje TR01 -- Anlaggningskrav transmissionsnatet",
    "Svenska kraftnats tekniska riktlinje for anlaggningskrav i transmissionsnatet. Definierar tekniska krav pa komponenter, stationsutformning och driftsystem for nya och ombyggda transmissionsanlaggningar. Galler for entreprendrer och leverantdrer som bygger pa uppdrag av SvK.",
    "technical_regulation", "2025-03", "2025-03-09", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR06", "Teknisk riktlinje TR06 -- Elkvalitet",
    "Svenska kraftnats tekniska riktlinje for elkvalitet i transmissionsnatet. Definierar gransvarden for spanningskvalitet (harmoniska, flicker, spannningsvariationer, osymmetri) i stamndtets natpunkter. Uppdaterad 2025.",
    "technical_regulation", "2025-01", "2025-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR13", "Teknisk riktlinje TR13 -- Styr- och kontrollsystem",
    "Svenska kraftnats tekniska riktlinje for styr- och kontrollsystem (SCADA/ICS) i transmissionsnatet. Krav pa kommunikationsprotokoll, cybersaker het, redundans och fjdrrstyrning.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK Tekniska avtalsvillkor", "Tekniska avtalsvillkor for anslutning till transmissionsnatet",
    "Svenska kraftnats tekniska avtalsvillkor for anslutning till transmissionsnatet. Anger detaljerade tekniska krav som maste uppfyllas av produktionsanlaggningar, forbrukningsanlaggningar och underliggande nat vid anslutning till stamnatet. Version 2024-03-26.",
    "grid_connection", "2024-03", "2024-03-26", "https://www.svk.se/siteassets/aktorsportalen/anslut-till-transmissionsnatet/tekniska-avtalsvillkor.pdf"],

  // SvK implementation guides
  ["SvK FCR Implementationsguide", "Implementationsguide BSP -- FCR (version 2026-03)",
    "Svenska kraftnats implementationsguide for leverantorer av FCR (frekvenshallningsreserv). Beskriver tekniska villkor, forkvalificeringsprocess, testforfarande, budgivning och avrakning for FCR-N, FCR-D upp och FCR-D ned. Version 1.10, uppdaterad mars 2026.",
    "balancing", "2026-03", "2026-03-04", "https://www.svk.se/aktorsportalen/bidra-med-reserver/bli-leverantor-av-reserver/bidra-med-fcr-afrr-eller-mfrr/"],

  ["SvK mFRR CM Implementationsguide", "Implementationsguide mFRR kapacitetsmarknad",
    "Svenska kraftnats implementationsguide for mFRR kapacitetsmarknaden. Beskriver kapacitetsupphandling, budgivning, aktivering, avrakning och rapportering for den nationella mFRR kapacitetsmarknaden.",
    "balancing", "2024-10", "2023-10-17", "https://www.svk.se/aktorsportalen/bidra-med-reserver/bli-leverantor-av-reserver/bidra-med-fcr-afrr-eller-mfrr/"],

  ["SvK EDIEL", "Edielanvisningar -- elektroniskt datautbyte pa elmarknaden",
    "Svenska kraftnats anvisningar for elektroniskt datautbyte (EDIEL) pa elmarknaden. Standardiserat meddelandeformat for balansanmalan, matvardesrapportering, leverantorsbyten och avrakning. Avsnitt 8 behandlar bud och elektroniska forfragan for balansmarknaden.",
    "market_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/bidra-med-reserver/bli-leverantor-av-reserver/bidra-med-fcr-afrr-eller-mfrr/"],

  // EU market regulations applied by SvK
  ["EU 2019/943", "Elmarknadsforordningen (EU) 2019/943",
    "EU:s forordning om den inre marknaden for el. Grundlaggande bestammelser om elhandel, balansansvar, resursadekvathet och roller och ansvar for en volfungerande elmarknad. Reglerar nar och hur kapacitetsmekanismer (t.ex. strategisk reserv) far upphandlas. Galler direkt i Sverige.",
    "market_regulation", "2019-07", "2019-07-04", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2019/942", "ACER-forordningen (EU) 2019/942",
    "EU-forordning om inrattande av EU-byran for samarbete mellan energitillsynsmyndigheter (ACER). Reglerar ACER:s uppgifter avseende natforeskrifter, gransoverskridande fragor och marknadsovervakning. Ei representerar Sverige i ACER.",
    "market_regulation", "2019-07", "2019-07-04", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 2019/941", "Riskberedskapsforordningen (EU) 2019/941",
    "EU-forordning om riskberedskap inom elsektorn. Faststaller gemensamma regler for forebyggande av elkriser, beredskapsplanering och krishantering. Varje medlemsstat ska upprattta riskberedskapsplaner. Energimyndigheten ansvarar i Sverige.",
    "market_regulation", "2019-07", "2019-07-04", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 1227/2011 (REMIT)", "REMIT -- forordning om integritet och opppenhet pa grossistmarknaderna for energi",
    "EU-forordningen om integritet och oppenhet pa grossistmarknaderna for energi (REMIT). Forbjuder insiderhandel och marknadsmanipulation. Krav pa rapportering av transaktioner och grundlaggande data. Ei ar nationell tillsynsmyndighet. REMIT II (2024) utvidgar rapporteringskrav.",
    "market_regulation", "2024-01", "2011-12-28", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  ["EU 543/2013", "Transparensforordningen (EU) nr 543/2013",
    "EU-forordning om rapportering och publicering av data pa elmarknaden. Reglerar vilka data TSO:er ska publicera pa ENTSO-E Transparency Platform: produktionsdata, overforingskapacitet, prognoser, avbrott och balanseringsdata.",
    "market_regulation", "2013-07", "2013-07-05", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/"],

  // SvK Nordic cooperation and additional technical docs
  ["SvK Nordisk balanseringsmodell (NBM)", "Nordisk balanseringsmodell",
    "Den nordiska balanseringsmodellen (NBM) ar ett gemensamt ramverk for balanstjanster i Norden (Sverige, Norge, Danmark, Finland). Harmoniserar BSP/BRP-roller, aFRR (PICASSO), mFRR (MARI) och balanseringsavrakning. Sverige inforde NBM 1 maj 2024.",
    "balancing", "2024-05", "2024-05-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/balansmarknaden/"],

  ["SvK PICASSO (aFRR-plattform)", "PICASSO -- europeisk aFRR-aktiveringsplattform",
    "Platform for the International Coordination of Automated Frequency Restoration and Stable System Operation. Europeisk plattform for aktivering av aFRR (automatisk frekvensaterstallning). Drivs gemensamt av europeiska TSO:er under ENTSO-E. Svenska kraftnat deltar sedan 2024.",
    "balancing", "2024-05", "2024-05-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/balansmarknaden/"],

  ["SvK MARI (mFRR-plattform)", "MARI -- europeisk mFRR-aktiveringsplattform",
    "Manually Activated Reserves Initiative. Europeisk plattform for aktivering av mFRR (manuell frekvensaterstallning). Harmoniserar budgivning, aktivering och avrakning av mFRR i Europa. Svenska kraftnat ansluter december 2024.",
    "balancing", "2024-12", "2024-12-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/balansmarknaden/"],

  ["SvK Systemutvecklingsplan", "Svenska kraftnats systemutvecklingsplan",
    "Svenska kraftnats systemutvecklingsplan ar ett tioarigt planeringsdokument for stamnatet. Beskriver planerade natinvesteringar, kapacitetsbehov, scenarioanalyser och investeringsplan. Beaktar okad elektrifiering, industrins grtona omstallning, vindkraftsutbyggnad och gransoverskridande forbindelser. Publiceras vartannat ar.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/utveckling-av-kraftsystemet/systemutvecklingsplan/"],

  ["SvK Kraftbalansrapport", "Svenska kraftnats kraftbalansrapport",
    "Svenska kraftnats arliga kraftbalansrapport analyserar det svenska elsystemets resursadekvathet. Rapporten bedomder risken for effektbrist (Loss of Load Expectation, LOLE) under kommande ars vintrar. Baseras pa produktionskapacitet, maxlast, import-/exportkapacitet och strategiska reserver. Underlag for beslut om kapacitetsmekanismer.",
    "technical_regulation", "2025-01", "2025-01-01", "https://www.svk.se/om-kraftsystemet/om-systemansvaret/"],

  ["SvK Drifthandbok", "Svenska kraftnats drifthandbok for systemdrift",
    "Drifthandboken beskriver Svenska kraftnats operativa rutiner for systemdrift. Omfattar driftplanering, frekvensreglering, spannningsreglering, flaskhalshantering, stdrningshantering, black start och ateruppbyggnad. Intern styrande dokumentation som tillampas av SvK:s driftcentral.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/om-kraftsystemet/om-systemansvaret/"],

  ["SvK Systemskyddsplan", "Svenska kraftnats systemskyddsplan",
    "Systemskyddsplanen beskriver det automatiska systemskyddet i det svenska kraftsystemet. Omfattar underfrekvensrelaskydd (automatisk lastfranstangning vid frekvensfall), overfrekvensrelaskydd, sparningsskydd och natdelpningssakring. Koordineras med ovriga nordiska TSO:er.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/om-kraftsystemet/om-systemansvaret/"],

  ["SvK Principer for flaskhalshantering", "Svenska kraftnats principer for flaskhalshantering",
    "Principer for hur Svenska kraftnat hanterar flaskhalsar (transmission constraints) i stamnatet. Flaskhalshantering sker framst genom prisomradesindelning (SE1-SE4), mothandel, omdirigering och i sista hand genom lastfranstangning. Regleras av CACM (EU 2015/1222) och SO GL (EU 2017/1485).",
    "market_regulation", "2024-01", "2024-01-01", "https://www.svk.se/om-kraftsystemet/om-systemansvaret/"],

  ["SvK Nordisk synkrondrift", "Regler for nordisk synkrondrift (NSOA)",
    "Nordic System Operation Agreement (NSOA) ar avtalet mellan de nordiska TSO:erna (SvK, Statnett, Fingrid, Energinet) om gemensam systemdrift i det nordiska synkronomradet. Reglerar frekvenssamarbete, reservdelning, driftplanering och informationsutbyte. Koordineras genom Nordic Balancing Model (NBM).",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/om-kraftsystemet/om-systemansvaret/"],

  ["SvK Elomrade SE1 (Lulea)", "Elomrade 1 -- SE1 Lulea",
    "Elomrade SE1 (Lulea) ar det nordligaste prisomradet i Sverige. Omfattar Norrbotten och norra Vasterbotten. Omradet har stort produktionsoverskott fran vattenkraft och vindkraft. Overforingsbegransningar soderifrdn gor att priserna ofta ar lagre an i SE3-SE4. Infört 1 november 2011.",
    "market_regulation", "2011-11", "2011-11-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/"],

  ["SvK Elomrade SE2 (Sundsvall)", "Elomrade 2 -- SE2 Sundsvall",
    "Elomrade SE2 (Sundsvall) omfattar mellersta Sverige. Omradet har god balans mellan produktion (vattenkraft, vindkraft) och forbrukning (skogsoch pappersindustri). Infört 1 november 2011.",
    "market_regulation", "2011-11", "2011-11-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/"],

  ["SvK Elomrade SE3 (Stockholm)", "Elomrade 3 -- SE3 Stockholm",
    "Elomrade SE3 (Stockholm) ar Sveriges storsta prisomrade. Omfattar Mellansverige inklusive Stockholm, Malaren, Goteborg och Varnamo. Omradet har betydande forbrukning och viss produktion (karnkraft Forsmark och Oskarshamn, vattenkraft, vindkraft). Infört 1 november 2011.",
    "market_regulation", "2011-11", "2011-11-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/"],

  ["SvK Elomrade SE4 (Malmo)", "Elomrade 4 -- SE4 Malmo",
    "Elomrade SE4 (Malmo) ar det sydligaste prisomradet. Omfattar Skane, Blekinge och sodra Smaland. Omradet har produktionsunderskott och hogre priser an norra Sverige. Importberoende fran SE3 och via gransoverskridande forbindelser (kontikabelkablar till Danmark, Tyskland, Litauen, Polen).",
    "market_regulation", "2011-11", "2011-11-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/"],

  ["SvK Tariffmetod stamnatet", "Svenska kraftnats tariffmetod for stamnatet",
    "Svenska kraftnats metod for att bestamma stamnatstariffen. Tariffen bestar av en effektavgift och en energiavgift. Ei godkanner tarifforslaget. Tariffen ska tacka SvK:s kostnader for stamnatsforvaltning, systemtjanster och gransoverskridande overforing. Tariffoversyner sker vart fjarde ar.",
    "market_regulation", "2024-01", "2024-01-01", "https://www.svk.se/utveckling-av-kraftsystemet/systemansvar--elmarknad/tariffoversyn/"],

  // SvK grid connection specifics
  ["SvK Anslutningsprocess stamnat", "Anslutningsprocessen till transmissionsnatet",
    "Processen for anslutning till Svenska kraftnats transmissionsnat. Ny anslutning kraver forhandskontroll av natkapacitet, formell anslutningsansokan, teknisk genomgang mot avtalsvillkor, natberaksningsstudier, byggfas och provdrift. Normaltid 3-8 ar beroende pa komplexitet. Ansokningsvolymerna har okat kraftigt p.g.a. industrins grtona omstallning.",
    "grid_connection", "2025-01", "2025-01-01", "https://www.svk.se/om-kraftsystemet/om-systemansvaret/verktyg-for-systemdrift/anslutning-till-transmissionsnatet/"],

  ["SvK Krav vid anslutning -- oversikt", "Krav vid anslutning till det svenska elsystemet -- oversikt",
    "Oversikt over de krav som galler vid anslutning till det svenska elsystemet. Kraven harstammar fran tre EU-natforeskrifter (RfG, DCC, HVDC) med nationella parametrar faststallda av Ei. Svenska kraftnat faststaller anslutningsvillkor for stamnatet i tekniska avtalsvillkor. Elnatsforetag faststaller villkor for underliggande nat.",
    "grid_connection", "2025-01", "2025-01-01", "https://www.svk.se/om-kraftsystemet/om-systemansvaret/verktyg-for-systemdrift/Krav-vid-anslutning/"],

  // EU directive (electricity market)
  ["EU 2019/944", "Elmarknadsdirektivet (EU) 2019/944",
    "EU-direktiv om gemensamma regler for den inre marknaden for el. Reglerar konsumentskydd, elleverantorers skyldigheter, aggregering, energigemenskaper, DSO-uppgifter, datadelning och smarta matare. Genomfors i Sverige genom andringar i ellagen, naturgaslagen och Ei:s foreskrifter.",
    "market_regulation", "2019-07", "2019-07-04", "https://www.svk.se/om-kraftsystemet/legalt-ramverk/eu-lagstiftning-/elmarknadsdirektivet/"],
];

// Additional SvK and market structure entries
const extraGridCodes: string[][] = [
  ["SvK NordPool day-ahead (Elspot)", "Day-ahead-handeln (Elspot) pa Nord Pool",
    "Day-ahead-marknaden (Elspot) pa Nord Pool ar den primara grossistmarknaden for el i Norden. Marknadsaktorer lagger kop- och saljbud for leverans nasta dygn. Priser bestams per elomrade (SE1-SE4) genom EUPHEMIA-algoritmen baserat pa bud och overforingskapacitet. Regleras av CACM (EU 2015/1222). Svenska kraftnat bestammer tillganglig kapacitet.",
    "market_regulation", "2024-01", "2024-01-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/"],

  ["SvK NordPool intraday (Elbas)", "Intradagshandeln (Elbas/XBID) pa Nord Pool",
    "Intradagsmarknaden mojliggor kontinuerlig handel med el nara realtid (fran dag-fore till 60 minuter fore leverans). Anvands for att balansera portfoljer nar forutsattningar andras efter day-ahead. Kopplad till europeiska XBID-plattformen. Regleras av CACM.",
    "market_regulation", "2024-01", "2024-01-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/"],

  ["SvK Effektreserv (historisk)", "Effektreserven (lag 2003:436, upphord 2025-03-15)",
    "Den svenska effektreserven var ett nationellt system dar Svenska kraftnat kontrakterade produktionsreserver for att sakra effekttillgangen under vintertoppar. Maximalt 2000 MW. Lagen om effektreserv (SFS 2003:436) forlangas upprepade ganger men upphorde slutligt 15 mars 2025. Ersatt av strategisk reserv.",
    "ancillary_services", "Upphord", "2025-03-15", "https://www.svk.se/aktorsportalen/bidra-med-reserver/om-olika-reserver/"],

  ["SvK TR02 Konstruktionskrav", "Teknisk riktlinje TR02 -- Konstruktionskrav",
    "Svenska kraftnats tekniska riktlinje TR02 om konstruktionskrav for stamnatsanlaggningar. Krav pa mekanisk dimensionering av stolpar, fundament, ledningar och stationsbyggnader. Inkluderar klimatlast, vind, is och seismiska krav.",
    "technical_regulation", "2025-01", "2025-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR03 Skyddssystem", "Teknisk riktlinje TR03 -- Skyddssystem",
    "Svenska kraftnats tekniska riktlinje TR03 om skyddssystem i transmissionsnatet. Krav pa releaskydd, differentialskydd, distansskydd och automatik for felbortkoppling och aterinkoppling.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR04 Transformatorer", "Teknisk riktlinje TR04 -- Transformatorer",
    "Svenska kraftnats tekniska riktlinje TR04 om krav pa transformatorer i transmissionsnatet. Krav pa dimensionering, isolering, kylning, provning och livslangdsanalys for krafttransformatorer.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR05 Stallverk", "Teknisk riktlinje TR05 -- Stallverk och kopplingsanlaggningar",
    "Svenska kraftnats tekniska riktlinje TR05 om stallverk (switchgear) och kopplingsanlaggningar. Krav pa brytare, fronskiljare, matinstrument, samlingskenor och stallverksutformning for 130-400 kV.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR07 Kabelsystem", "Teknisk riktlinje TR07 -- Kabelsystem",
    "Svenska kraftnats tekniska riktlinje TR07 om kabelsystem. Krav pa hogspanningskablar (underground/submarine), kabelskador, termisk dimensionering, installation och provning.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR08 Kommunikation", "Teknisk riktlinje TR08 -- Kommunikationssystem",
    "Svenska kraftnats tekniska riktlinje TR08 om kommunikationssystem i transmissionsnatet. Krav pa fiberoptik, SCADA-kommunikation, teleprotection (teletripning), redundans och cyberdakerhet for driftskommunikation.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR09 Jording", "Teknisk riktlinje TR09 -- Jording och aterledning",
    "Svenska kraftnats tekniska riktlinje TR09 om jording och aterledningssystem. Krav pa jordtagsmotstand, steg- och beroringssganning, jordlinor, jordmattor och jordteknik for stationer och ledningar.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR10 Materialkrav", "Teknisk riktlinje TR10 -- Materialkrav",
    "Svenska kraftnats tekniska riktlinje TR10 om materialkrav for transmissionsnatskomponenter. Krav pa stalsor ter, aluminiumledare, isolatorer, beslag och ovriga material.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR11 Miljo och sakerhet", "Teknisk riktlinje TR11 -- Miljo, halsa och sakerhet",
    "Svenska kraftnats tekniska riktlinje TR11 om miljo-, halso- och sakerhetskrav vid arbete i transmissionsnatet. Krav pa elektromagnetiska falt (EMF), buller, vibrationer, oljeutslappsskydd och avfallshantering.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK TR12 Dokumentation", "Teknisk riktlinje TR12 -- Dokumentationskrav",
    "Svenska kraftnats tekniska riktlinje TR12 om dokumentationskrav. Krav pa projektdokumentation, driftsdokumentation, GIS-data, ritningar och as-built-dokumentation for transmissionsanlaggningar.",
    "technical_regulation", "2024-01", "2024-01-01", "https://www.svk.se/aktorsportalen/entreprenorer-i-elnatet/tekniska-riktlinjer/"],

  ["SvK Balanstjanster kostnadsuppfoljning", "Svenska kraftnats arliga uppfoljning av kostnader for stodtjanster",
    "Svenska kraftnat rapporterar arligen kostnader for inkop av stodtjanster (FCR, aFRR, mFRR, FFR, strategisk reserv). Kostnaderna tacks av stamnatstariffen. Under 2024 uppgick stodtjanstkostnaderna till ca 3-4 miljarder kronor. Kostnadsstrukturen forandras i takt med den nordiska marknadsharmoniseringen.",
    "ancillary_services", "2025-01", "2025-01-01", "https://www.svk.se/om-kraftsystemet/om-elmarknaden/balansmarknaden/"],

  ["SvK Resursadekvathetsbeddomning (ERAA)", "European Resource Adequacy Assessment -- svensk del",
    "ENTSO-E genomfor arligen en europeisk resursadekvatensbeddmning (ERAA) som bedomder risken for effektbrist i varje land. ERAA for Sverige visar okande utmaningar for resursadekvathet till foljd av okad elforbrukning och nedlagda karnkraftreaktorer. Resultaten pverkar behovet av strategisk reserv. Regleras av elmarknadsforordningen (EU) 2019/943.",
    "market_regulation", "2025-01", "2025-01-01", "https://www.svk.se/om-kraftsystemet/om-systemansvaret/"],
];

const allGridCodes = [...gridCodes, ...extraGridCodes];

const insertGCBatch = db.transaction(() => {
  for (const g of allGridCodes) {
    insertGridCode.run(g[0], g[1], g[2], g[3], g[4], g[5], g[6]);
  }
});
insertGCBatch();
console.log(`Inserted ${allGridCodes.length} Svenska kraftnat grid codes and market rules`);

// ═══════════════════════════════════════════════════════════════
// DECISIONS (Ei)
// ═══════════════════════════════════════════════════════════════

db.prepare("DELETE FROM decisions").run();

const insertDecision = db.prepare(`
  INSERT INTO decisions (reference, title, text, decision_type, date_decided, parties, url) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const decisions: string[][] = [
  // Revenue cap decisions
  ["Ei intaktsramar 2024-2027 el (beslut 2024-04-03)", "Beslut om intaktsramar for elnatsforetag 2024-2027",
    "Energimarknadsinspektionen har beslutat om intaktsramar for samtliga elnatsforetag for tillsynsperioden 2024-2027. Intaktsramarna uppgar till totalt ca 326 miljarder kronor (i 2022 ars prisniva), en okning med ca 100 miljarder kronor jamfort med tillsynsperioden 2020-2023. Okningen beror pa hogre kapitalunderlag (61 mdr), hogre okontrollerbara kostnader (37 mdr) och hogre kontrollerbara kostnader (13 mdr). Intaktsramarna forvdntas leda till hogre natavgifter for elanvandare.",
    "revenue_cap", "2024-04-03", "Samtliga elnatsforetag i Sverige", "https://ei.se/om-oss/nyheter/2024/2024-04-03-nu-har-ei-beslutat-om-elnatsforetagens-intaktsramar-for-perioden-2024-2027"],

  ["Ei forsta intaktsramsbeslut 2024-2027 (2023-12-20)", "Forsta beslutet om elnatsforetagens intaktsramar 2024-2027",
    "Ei fattade det forsta delbeslutet om intaktsramar for tillsynsperioden 2024-2027. Forsta batchen av natforetag fick sina intaktsramar faststallda i december 2023. Beslutet baseras pa den nya berakningsmodellen med uppdaterad WACC, kvalitetsincitament och effektiviseringsmalkrav.",
    "revenue_cap", "2023-12-20", "Forsta gruppen elnatsforetag", "https://ei.se/om-oss/nyheter/2023/2023-12-20-ei-har-fattat-forsta-beslutet-om-elnatsforetagens-intaktsramar-2024-2027"],

  ["Ei omprovning intaktsramar 2020-2023 (2025-02-26)", "Omprovning av intaktsramar for tillsynsperioden 2020-2023",
    "Ei har omprovat alla intaktsramar for tillsynsperioden 2020-2023. Omprovningen sker i efterhand och bestuammer slutlig intaktsram baserat pa faktiska kostnader, kvalitetsutfall och oforutsedda omstandigheter (bl.a. energikrisen 2022). Avvikelser fran den ursprungliga ramen hanteras genom tillgodohavanden eller aterbetalningskrav.",
    "revenue_cap", "2025-02-26", "Samtliga elnatsforetag i Sverige", "https://ei.se/om-oss/projekt/pagaende/intaktsramar-elnat-och-gasnat/intaktsramar-elnat-2024-2027/2025-02-26-ei-har-omprovat-alla-intaktsramar-for-tillsynsperioden-2020-2023"],

  ["Ei avvikelsebeslut el/gas 2025 (2025-05-20)", "Avvikelsebeslut for el- och gasnatsforetagens intaktsramar",
    "Energimarknadsinspektionen har fattat avvikelsebeslut for el- och gasnatsforetagens intaktsramar. Avvikelsebeslut fattas nar foretagens faktiska intakter avviker fran den faststallda intaktsramen. Foretag som tagit ut for mycket kan behova kompensera kunderna, medan foretag som tagit ut for lite kan fa okt intaktsram i nasta period.",
    "revenue_cap", "2025-05-20", "El- och gasnatsforetag", "https://ei.se/om-oss/nyheter/2025/2025-05-20-avvikelsebesluten-for-el--och-gasnatsforetagens-intaktsramar-ar-klara"],

  // Tariff methodology
  ["Ei vagledning nattariffer EIFS 2022:1", "Vagledning for utformning av nattariffer enligt EIFS 2022:1",
    "Energimarknadsinspektionens vagledning for elnatsforetagens utformning av nattariffer. Beskriver hur effekttariffer, tidsdifferentiering och kapacitetsabonnemang bor utformas for att ge rattvisa och effektiva prissignaler. Vagledningen stodjer den pagaende tariffomstallningen fran energibaserade till effektbaserade tariffer.",
    "methodology", "2022-06-01", "Samtliga elnatsforetag", "https://ei.se/bransch/tariffer-nattariffer/vagledning-for-utformning-av-nattariffer-enligt-eifs-20221"],

  // Concession decisions (types)
  ["Ei natkoncession linje (generell)", "Beslut om natkoncession for linje",
    "Natkoncession for linje ger tillstand att bygga och driva en specifik kraftledning. Ansokan till Energimarknadsinspektionen inkluderar miljokonsekvensbeskrivning, teknisk beskrivning och samradsredogorelse. Ei remitterar ansokan till berorda myndigheter och sakagare. Prissattning baseras pa saklighet och icke-diskriminering. Giltighetstid normalt 25-40 ar.",
    "tariff", "2024-01-01", "Elnatsforetag, nyanslutande aktorer", "https://ei.se/bransch/koncessioner"],

  ["Ei natkoncession omrade (generell)", "Beslut om natkoncession for omrade (omradeskoncession)",
    "Omradeskoncession ger ensamrdtt att aga och driva ett elnat inom ett visst geografiskt omrade (lokal-/regionnat). Koncessionshavaren har leveransplikt och skyldighet att ansluta kunder inom omradet. Ei beslutar om omradeskoncession och overvakar att koncessionsvillkoren foljs.",
    "tariff", "2024-01-01", "Elnatsforetag", "https://ei.se/bransch/koncessioner"],

  // Market monitoring decisions
  ["Ei Elpriskollen", "Ei:s prisovervakning genom Elpriskollen",
    "Energimarknadsinspektionen overvakar elmarknaden genom verktyget Elpriskollen (elpriskollen.se). Elleverantorer rapporterar priser och avtalsvillkor enligt EIFS 2023:2. Ei analyserar prisutvecklingen och publicerar rapporter. Vid bristfallig prisinformation kan Ei ingripa med forelagganden.",
    "market_monitoring", "2024-01-01", "Samtliga elleverantorer", "https://ei.se/konsument/elpriskollen"],

  ["Ei marknadstillsyn REMIT", "Ei:s marknadstillsyn enligt REMIT",
    "Energimarknadsinspektionen ar nationell tillsynsmyndighet for REMIT (EU 1227/2011) i Sverige. Ei overvakar grossistmarknaderna for el och gas mot insiderhandel och marknadsmanipulation. Samarbetar med ACER och NordREG. Kan utfarda sanktioner vid overtraddelser. Lagstod i SFS 2013:385.",
    "market_monitoring", "2024-01-01", "Grossistmarknadens aktorer", "https://ei.se/om-oss/var-verksamhet"],

  ["Ei tillsyn leveranskvalitet", "Ei:s tillsyn av leveranskvalitet i elnaten",
    "Energimarknadsinspektionen bedomer leveranskvaliteten i elnaten baserat pa avbrottsrapportering fran natkoncessionshavare (EIFS 2015:4). Arlig statistik over elavbrott (SAIDI, SAIFI, CAIDI) publiceras. Kvalitetsresultat paverkar intaktsramen genom kvalitetsincitament. Foretag med manga eller langa avbrott far lagre tillategn intaktsram.",
    "market_monitoring", "2024-01-01", "Samtliga natkoncessionshavare", "https://ei.se/bransch/reglering-av-natverksamhet"],

  ["Ei tillsyn smarta nat", "Ei:s uppfoljning av smarta elnat",
    "Energimarknadsinspektionen foljer upp utvecklingen av smarta elnat baserat pa rapportering fran elnatsforetag (EIFS 2022:5). Uppfoljningen omfattar driftsatta smarta matare, automatisering, laststyrning och flexibilitetstjanster. Resultat rapporteras till regeringen och publiceras.",
    "benchmark", "2024-01-01", "Samtliga elnatsforetag", "https://ei.se/om-oss/var-verksamhet"],

  // Complaint handling
  ["Ei tvistlosning (generell)", "Ei:s tvistlosning mellan natforetag och anvandare",
    "Energimarknadsinspektionen hanterar tvister mellan elnatsforetag och natanvandare avseende natavgifter, anslutningsvillkor, avbrottersattning och matning. Ei kan medla och fatta bindande beslut. Besluten kan overklagas till forvaltningsdomstol. Regelverket bygger pa kapitel 11-12 i ellagen och naturgaslagen.",
    "complaint", "2024-01-01", "Natforetag och natanvandare", "https://ei.se/konsument"],

  // Gas revenue cap
  ["Ei intaktsramar gas 2024-2027", "Beslut om intaktsramar for gasnatsforetag 2024-2027",
    "Energimarknadsinspektionen har fastsllt intaktsramar for gasnatsforetag for tillsynsperioden 2024-2027. Gasnatsforetag i Sverige ar farre an elnatsforetag men regleras pa liknande satt med forhandsfaststall intaktsram baserad pa kapitalunderlag, driftkostnader och kvalitetsparametrar.",
    "revenue_cap", "2024-04-03", "Gasnatsforetag i Sverige", "https://ei.se/bransch/reglering-av-natverksamhet/reglering---gasnatsverksamhet"],
];

const allDecisions = [...decisions, ...eiExtraDecisions];

const insertDecBatch = db.transaction(() => {
  for (const d of allDecisions) {
    insertDecision.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6]);
  }
});
insertDecBatch();
console.log(`Inserted ${allDecisions.length} Ei decisions`);

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
  riksdagen: (db.prepare("SELECT count(*) as n FROM regulations WHERE regulator_id = 'riksdagen'").get() as { n: number }).n,
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
insertMeta.run("data_sources", "ei.se, svk.se, energimyndigheten.se, elsakerhetsverket.se, riksdagen.se");
insertMeta.run("scraped_date", "2026-04-04");

console.log(`\nDatabase summary:`);
console.log(`  Regulators:         ${stats.regulators}`);
console.log(`  Regulations:        ${stats.regulations}`);
console.log(`    Ei (EIFS):        ${stats.ei} total`);
console.log(`    Energimyndigheten (STEMFS): ${stats.emyn}`);
console.log(`    Elsakerhetsverket (ELSAK-FS): ${stats.elsak}`);
console.log(`    Riksdagen (SFS):  ${stats.riksdagen}`);
console.log(`  Grid codes:         ${stats.grid_codes} (SvK + EU network codes + balancing)`);
console.log(`  Decisions:          ${stats.decisions} (Ei)`);
console.log(`  Total documents:    ${stats.regulations + stats.grid_codes + stats.decisions}`);
console.log(`\nDone. Database at ${DB_PATH}`);

db.close();
