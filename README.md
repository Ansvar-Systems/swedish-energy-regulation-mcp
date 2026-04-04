# Swedish Energy Regulation MCP

MCP server for Swedish energy sector regulations -- Ei market rules, Svenska kraftnat grid codes, Energimyndigheten policy, Elsakerhetsverket safety rules.

[![npm version](https://badge.fury.io/js/@ansvar%2Fswedish-energy-regulation-mcp.svg)](https://www.npmjs.com/package/@ansvar/swedish-energy-regulation-mcp)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Covers four Swedish energy regulators with full-text search across regulations, grid codes, and regulatory decisions. All data is in Swedish.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Regulators Covered

| Regulator | Role | Website |
|-----------|------|---------|
| **Energimarknadsinspektionen (Ei)** | Energy market regulation, network tariffs, consumer protection, licence conditions | [ei.se](https://ei.se) |
| **Svenska kraftnat** | Electricity transmission, grid codes, balancing market, frequency regulation, ancillary services | [svk.se](https://svk.se) |
| **Energimyndigheten** (Swedish Energy Agency) | Energy policy, renewable energy, energy efficiency, climate reporting, R&D | [energimyndigheten.se](https://energimyndigheten.se) |
| **Elsakerhetsverket** (Electrical Safety Authority) | Electrical installation safety, product safety, authorization requirements | [elsakerhetsverket.se](https://elsakerhetsverket.se) |

---

## Quick Start

### Use Remotely (No Install Needed)

**Endpoint:** `https://mcp.ansvar.eu/swedish-energy-regulation/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude Desktop** | Add to `claude_desktop_config.json` (see below) |
| **Claude Code** | `claude mcp add swedish-energy-regulation --transport http https://mcp.ansvar.eu/swedish-energy-regulation/mcp` |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "swedish-energy-regulation": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/swedish-energy-regulation/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/swedish-energy-regulation-mcp
```

Or add to Claude Desktop config for stdio:

```json
{
  "mcpServers": {
    "swedish-energy-regulation": {
      "command": "npx",
      "args": ["-y", "@ansvar/swedish-energy-regulation-mcp"]
    }
  }
}
```

---

## Tools

| Tool | Description |
|------|-------------|
| `se_energy_search_regulations` | Full-text search across energy regulations from Ei, Energimyndigheten, and Elsakerhetsverket |
| `se_energy_get_regulation` | Get a specific regulation by reference string (e.g., `EIFS 2022:1`) |
| `se_energy_search_grid_codes` | Search Svenska kraftnat grid codes, balancing rules, and market regulations |
| `se_energy_get_grid_code` | Get a specific grid code document by database ID |
| `se_energy_search_decisions` | Search Ei tariff decisions, revenue caps, and market rulings |
| `se_energy_about` | Return server metadata: version, regulators, tool list, data coverage |
| `se_energy_list_sources` | List data sources with record counts and provenance URLs |
| `se_energy_check_data_freshness` | Check data freshness and staleness status for each source |

Full tool documentation: [TOOLS.md](TOOLS.md)

---

## Data Coverage

| Source | Records | Content |
|--------|---------|---------|
| Ei | 70 regulations | Market regulation, network tariffs, consumer protection, licence conditions |
| Riksdagen | 53 regulations | Ellagen, naturgaslagen, fjarrvarmlagen, energy acts |
| Energimyndigheten | 48 regulations | Energy efficiency, renewable energy, energy statistics, climate policy |
| Elsakerhetsverket | 28 regulations | Electrical safety, product safety, installation rules |
| Svenska kraftnat | 63 grid codes | Balancing rules, frequency regulation, grid connection, ancillary services |
| Ei (decisions) | 39 decisions | Revenue caps, tariff determinations, methodology approvals, benchmarking |
| **Total** | **301 records** | ~396 KB database |

**Language note:** All regulatory content is in Swedish. Search queries work best in Swedish (e.g., `ellag`, `natavgift`, `intaktsram`, `balansansvar`).

Full coverage details: [COVERAGE.md](COVERAGE.md)

---

## Data Sources

See [sources.yml](sources.yml) for machine-readable provenance metadata.

---

## Docker

```bash
docker build -t swedish-energy-regulation-mcp .
docker run --rm -p 3000:3000 -v /path/to/data:/app/data swedish-energy-regulation-mcp
```

Set `SE_ENERGY_DB_PATH` to use a custom database location (default: `data/se-energy.db`).

---

## Development

```bash
npm install
npm run build
npm run seed         # populate sample data
npm run dev          # HTTP server on port 3000
```

---

## Further Reading

- [TOOLS.md](TOOLS.md) -- full tool documentation with examples
- [COVERAGE.md](COVERAGE.md) -- data coverage and limitations
- [sources.yml](sources.yml) -- data provenance metadata
- [DISCLAIMER.md](DISCLAIMER.md) -- legal disclaimer
- [PRIVACY.md](PRIVACY.md) -- privacy policy
- [SECURITY.md](SECURITY.md) -- vulnerability disclosure

---

## License

Apache-2.0 -- [Ansvar Systems AB](https://ansvar.eu)

See [LICENSE](LICENSE) for the full license text.

See [DISCLAIMER.md](DISCLAIMER.md) for important legal disclaimers about the use of this regulatory data.

---

[ansvar.ai/mcp](https://ansvar.ai/mcp) -- Full MCP server catalog
