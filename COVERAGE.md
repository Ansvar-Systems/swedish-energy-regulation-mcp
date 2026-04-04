# Coverage -- Swedish Energy Regulation MCP

Current coverage of Swedish energy sector regulatory data.

**Last updated:** 2026-04-04

---

## Sources

| Source | Authority | Records | Content |
|--------|-----------|---------|---------|
| **Energimarknadsinspektionen (Ei)** | Swedish Energy Markets Inspectorate | 70 regulations | Market regulation, network tariffs, consumer protection, licence conditions, metering |
| **Riksdagen** | Swedish Parliament | 53 regulations | Ellagen (1997:857), naturgaslagen, fjarrvarmlagen, energy acts and government bills |
| **Energimyndigheten** | Swedish Energy Agency | 48 regulations | Energy efficiency, renewable energy, energy statistics, climate policy, R&D support |
| **Elsakerhetsverket** | Electrical Safety Authority | 28 regulations | Electrical installation safety, product safety, authorization requirements |
| **Svenska kraftnat** | Swedish TSO | 63 grid codes | Balancing rules, frequency regulation, grid connection, ancillary services, market regulations |
| **Ei (decisions)** | Swedish Energy Markets Inspectorate | 39 decisions | Revenue caps, tariff determinations, methodology approvals, benchmarking, market monitoring |
| **Total** | | **301 records** | ~396 KB SQLite database |

---

## Regulation Types

| Type | Swedish Term | Count | Regulators |
|------|-------------|-------|------------|
| `foreskrift` | Foreskrift (Regulation/Rule) | 137 | Ei, Energimyndigheten, Elsakerhetsverket |
| `lag` | Lag (Act/Law) | 40 | Riksdagen |
| `forordning` | Forordning (Government Ordinance) | 22 | Riksdagen, Energimyndigheten |

## Grid Code Types

| Type | Description | Count |
|------|-------------|-------|
| `technical_regulation` | Technical requirements for generation, consumption, and grid connection | 21 |
| `market_regulation` | Market rules for electricity trading, settlement, and imbalance | 20 |
| `balancing` | Balancing market rules, frequency regulation, and reserves | 12 |
| `grid_connection` | Grid connection requirements for transmission and distribution | 6 |
| `ancillary_services` | System services (FCR-N, FCR-D, aFRR, mFRR) | 4 |

## Decision Types

| Type | Description | Count |
|------|-------------|-------|
| `market_monitoring` | Market monitoring and surveillance reports | 13 |
| `benchmark` | Benchmarking of network operator efficiency | 6 |
| `methodology` | Methodology approvals for tariff calculation | 6 |
| `revenue_cap` | Revenue cap (intaktsram) determinations for network operators | 6 |
| `tariff` | Network tariff (natavgift) approvals | 6 |
| `complaint` | Consumer and industry complaint rulings | 2 |

---

## What Is NOT Included

This is a seed dataset. The following are not yet covered:

- **Full text of original documents** -- records contain summaries, not complete legal text from riksdagen.se
- **Court decisions** -- Forvaltningsratten and Kammarratten energy rulings are not included
- **Historical and repealed regulations** -- only current in-force regulations are covered
- **EU energy directives** -- EU Electricity Directive, Gas Directive, Renewable Energy Directive, etc. are covered by the [EU Regulations MCP](https://github.com/Ansvar-Systems/EU_compliance_MCP), not this server
- **Parliamentary energy debates** -- Riksdag committee reports and motions are not included
- **Municipal energy plans** -- local authority energy and climate plans are not covered
- **Individual tariff schedules** -- utility-specific tariff sheets are not included (only Ei approval decisions)

---

## Limitations

- **Seed dataset** -- 301 records across regulations, grid codes, and decisions
- **Swedish text only** -- all regulatory content is in Swedish. English search queries may return limited results.
- **Summaries, not full legal text** -- records contain representative summaries, not the complete official text from riksdagen.se or regulator websites.
- **Quarterly manual refresh** -- data is updated manually. Recent regulatory changes may not be reflected.
- **No real-time tracking** -- amendments and repeals are not tracked automatically.

---

## Planned Improvements

Full automated ingestion is planned from:

- **riksdagen.se** -- Swedish legislation (lagar, forordningar)
- **ei.se** -- Ei regulations, network tariff decisions, methodology documents
- **svk.se** -- Svenska kraftnat grid codes, balancing rules, market regulations
- **energimyndigheten.se** -- Energy agency publications, foreskrifter, guidance
- **elsakerhetsverket.se** -- Electrical safety regulations, product approvals

---

## Language

All content is in Swedish. The following search terms are useful starting points:

| Swedish Term | English Equivalent |
|-------------|-------------------|
| ellag | electricity act |
| natavgift | network tariff |
| intaktsram | revenue cap |
| elcertifikat | electricity certificate |
| balansansvar | balance responsibility |
| natanslutning | grid connection |
| frekvens | frequency |
| systemdrift | system operation |
| elsakerhet | electrical safety |
| energieffektivitet | energy efficiency |
| fornybar energi | renewable energy |
| fjarrvarme | district heating |
| natkoncessioner | network concessions |
| vindkraft | wind power |
