# Tools -- Swedish Energy Regulation MCP

8 tools for searching and retrieving Swedish energy sector regulations.

All data is in Swedish. Tool descriptions and parameter names are in English.

---

## 1. se_energy_search_regulations

Search across Swedish energy regulations from Ei, Energimyndigheten, and Elsakerhetsverket. Returns foreskrifter (regulations), lagar (acts), forordningar (government ordinances), and allmanna rad (general advice). Supports Swedish-language queries.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query in Swedish or English (e.g., `ellag`, `natavgift`, `elcertifikat`, `energieffektivitet`) |
| `regulator` | string | No | Filter by regulator: `ei`, `energimyndigheten`, `elsakerhetsverket` |
| `type` | string | No | Filter by regulation type: `forordning`, `foreskrift`, `allmanna_rad`, `vagledning` |
| `status` | string | No | Filter by status: `in_force`, `repealed`, `draft`. Defaults to all. |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching regulations with reference, title, text, type, status, effective date, and URL.

**Example:**

```json
{
  "query": "ellag",
  "regulator": "ei",
  "status": "in_force"
}
```

**Data sources:** Ei (ei.se), Energimyndigheten (energimyndigheten.se), Elsakerhetsverket (elsakerhetsverket.se), riksdagen.se.

**Limitations:** Summaries, not full legal text. Swedish-language content only.

---

## 2. se_energy_get_regulation

Get a specific Swedish energy regulation by its reference string. Returns the full record including text, metadata, and URL.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reference` | string | Yes | Regulation reference (e.g., `EIFS 2022:1`, `SFS 1997:857`) |

**Returns:** Single regulation record with all fields, or an error if not found.

**Example:**

```json
{
  "reference": "EIFS 2022:1"
}
```

**Data sources:** riksdagen.se, ei.se, energimyndigheten.se, elsakerhetsverket.se.

**Limitations:** Exact match on reference string. Partial matches are not supported -- use `se_energy_search_regulations` for fuzzy search.

---

## 3. se_energy_search_grid_codes

Search Svenska kraftnat grid codes, balancing rules, frequency regulation, and ancillary services specifications. Covers electricity transmission grid rules, market regulations, and grid connection requirements.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., `balansansvar`, `frekvens`, `natanslutning`, `systemdrift`) |
| `code_type` | string | No | Filter by code type: `technical_regulation`, `market_regulation`, `grid_connection`, `balancing`, `ancillary_services` |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching grid code documents with reference, title, text, code type, version, effective date, and URL.

**Example:**

```json
{
  "query": "balansansvar",
  "code_type": "balancing"
}
```

**Data sources:** Svenska kraftnat (svk.se).

**Limitations:** Summaries of technical regulations, not the full PDF documents. Swedish-language content only.

---

## 4. se_energy_get_grid_code

Get a specific Svenska kraftnat grid code document by its database ID. The ID is returned in search results from `se_energy_search_grid_codes`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `document_id` | number | Yes | Grid code document ID (from search results) |

**Returns:** Single grid code record with all fields, or an error if not found.

**Example:**

```json
{
  "document_id": 2
}
```

**Data sources:** Svenska kraftnat (svk.se).

**Limitations:** Requires a valid database ID. Use `se_energy_search_grid_codes` to find IDs.

---

## 5. se_energy_search_decisions

Search Ei tariff decisions, revenue cap (intaktsram) determinations, methodology approvals, benchmarking reports, and market monitoring decisions for Swedish energy utilities.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g., `natavgift`, `intaktsram`, `tillstand`, `natkoncessioner`) |
| `decision_type` | string | No | Filter by decision type: `tariff`, `revenue_cap`, `methodology`, `benchmark`, `complaint`, `market_monitoring` |
| `limit` | number | No | Maximum results (default 20, max 100) |

**Returns:** Array of matching decisions with reference, title, text, decision type, date decided, parties, and URL.

**Example:**

```json
{
  "query": "intaktsram",
  "decision_type": "revenue_cap"
}
```

**Data sources:** Energimarknadsinspektionen (ei.se).

**Limitations:** Summaries of decisions, not full legal text. Swedish-language content only.

---

## 6. se_energy_about

Return metadata about this MCP server: version, list of regulators covered, tool list, and data coverage summary. Takes no parameters.

**Parameters:** None.

**Returns:** Server name, version, description, list of regulators (id, name, URL), and tool list (name, description).

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.

---

## 7. se_energy_list_sources

List data sources with record counts, provenance URLs, and last refresh dates.

**Parameters:** None.

**Returns:** Array of data sources with id, name, URL, record count, data type, last refresh date, and refresh frequency.

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.

---

## 8. se_energy_check_data_freshness

Check data freshness for each source. Reports staleness status and provides update instructions.

**Parameters:** None.

**Returns:** Freshness table with source, last refresh date, frequency, and status (Current/Due/OVERDUE).

**Example:**

```json
{}
```

**Data sources:** N/A (server metadata).

**Limitations:** None.
