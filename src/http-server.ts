#!/usr/bin/env node

/**
 * HTTP Server Entry Point for Docker Deployment
 *
 * Provides Streamable HTTP transport for remote MCP clients.
 * Use src/index.ts for local stdio-based usage.
 *
 * Endpoints:
 *   GET  /health  -- liveness probe
 *   POST /mcp     -- MCP Streamable HTTP (session-aware)
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  listRegulators,
  searchRegulations,
  getRegulationByReference,
  searchGridCodes,
  getGridCode,
  searchDecisions,
  getMetadataValue,
  getRecordCounts,
  getRegulationCountByRegulator,
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const SERVER_NAME = "swedish-energy-regulation-mcp";

let pkgVersion = "0.1.0";
try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8"),
  ) as { version: string };
  pkgVersion = pkg.version;
} catch {
  // fallback
}

// --- Tool definitions ---

const TOOLS = [
  {
    name: "se_energy_search_regulations",
    description:
      "Search across Swedish energy regulations from Ei, Energimyndigheten, and Elsakerhetsverket.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query in Swedish or English" },
        regulator: {
          type: "string",
          enum: ["ei", "energimyndigheten", "elsakerhetsverket"],
          description: "Filter by regulator. Optional.",
        },
        type: {
          type: "string",
          enum: ["forordning", "foreskrift", "allmanna_rad", "vagledning"],
          description: "Filter by type. Optional.",
        },
        status: {
          type: "string",
          enum: ["in_force", "repealed", "draft"],
          description: "Filter by status. Optional.",
        },
        limit: { type: "number", description: "Max results (default 20)." },
      },
      required: ["query"],
    },
  },
  {
    name: "se_energy_get_regulation",
    description: "Get a specific regulation by reference string.",
    inputSchema: {
      type: "object" as const,
      properties: {
        reference: { type: "string", description: "Regulation reference" },
      },
      required: ["reference"],
    },
  },
  {
    name: "se_energy_search_grid_codes",
    description: "Search Svenska kraftnat grid codes, technical regulations, and balancing rules.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        code_type: {
          type: "string",
          enum: ["technical_regulation", "market_regulation", "grid_connection", "balancing", "ancillary_services"],
          description: "Filter by code type. Optional.",
        },
        limit: { type: "number", description: "Max results (default 20)." },
      },
      required: ["query"],
    },
  },
  {
    name: "se_energy_get_grid_code",
    description: "Get a specific grid code document by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: { type: "number", description: "Grid code document ID" },
      },
      required: ["document_id"],
    },
  },
  {
    name: "se_energy_search_decisions",
    description: "Search Ei tariff decisions, revenue determinations, and market supervision rulings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        decision_type: {
          type: "string",
          enum: ["tariff", "revenue_cap", "methodology", "benchmark", "complaint", "market_monitoring"],
          description: "Filter by decision type. Optional.",
        },
        limit: { type: "number", description: "Max results (default 20)." },
      },
      required: ["query"],
    },
  },
  {
    name: "se_energy_about",
    description: "Return server metadata, regulators covered, tool list.",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "se_energy_list_sources",
    description:
      "List data sources with record counts, provenance URLs, and last refresh dates.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "se_energy_check_data_freshness",
    description:
      "Check data freshness for each source. Reports staleness and provides update instructions.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// --- Zod schemas ---

const SearchRegulationsArgs = z.object({
  query: z.string().min(1),
  regulator: z.enum(["ei", "energimyndigheten", "elsakerhetsverket"]).optional(),
  type: z.enum(["forordning", "foreskrift", "allmanna_rad", "vagledning"]).optional(),
  status: z.enum(["in_force", "repealed", "draft"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const GetRegulationArgs = z.object({ reference: z.string().min(1) });

const SearchGridCodesArgs = z.object({
  query: z.string().min(1),
  code_type: z.enum(["technical_regulation", "market_regulation", "grid_connection", "balancing", "ancillary_services"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const GetGridCodeArgs = z.object({ document_id: z.number().int().positive() });

const SearchDecisionsArgs = z.object({
  query: z.string().min(1),
  decision_type: z.enum(["tariff", "revenue_cap", "methodology", "benchmark", "complaint", "market_monitoring"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

// --- Helpers ---

let _cachedBuildDate: string | null = null;

function dbBuildDate(): string {
  if (_cachedBuildDate) return _cachedBuildDate;
  try {
    _cachedBuildDate = getMetadataValue("build_date") ?? "unknown";
  } catch {
    _cachedBuildDate = "unknown";
  }
  return _cachedBuildDate;
}

function makeMeta() {
  return {
    _meta: {
      disclaimer:
        "Reference data only — not legal or regulatory advice. Verify against official sources.",
      data_source:
        "Swedish energy regulators (ei.se, svk.se, energimyndigheten.se, elsakerhetsverket.se)",
      database_built: dbBuildDate(),
    },
  };
}

// --- MCP server factory ---

function createMcpServer(): Server {
  const mcpServer = new Server(
    { name: SERVER_NAME, version: pkgVersion },
    { capabilities: { tools: {} } },
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    function textContent(data: unknown) {
      const payload =
        data !== null && typeof data === "object" && !Array.isArray(data)
          ? { ...(data as Record<string, unknown>), ...makeMeta() }
          : { data, ...makeMeta() };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      };
    }

    function errorContent(message: string) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: message, ...makeMeta() }, null, 2),
          },
        ],
        isError: true as const,
      };
    }

    try {
      switch (name) {
        case "se_energy_search_regulations": {
          const parsed = SearchRegulationsArgs.parse(args);
          const results = searchRegulations({
            query: parsed.query,
            regulator: parsed.regulator,
            type: parsed.type,
            status: parsed.status,
            limit: parsed.limit,
          });
          return textContent({ results, count: results.length });
        }

        case "se_energy_get_regulation": {
          const parsed = GetRegulationArgs.parse(args);
          const regulation = getRegulationByReference(parsed.reference);
          if (!regulation) {
            return errorContent(`Regulation not found: ${parsed.reference}`);
          }
          return textContent(regulation);
        }

        case "se_energy_search_grid_codes": {
          const parsed = SearchGridCodesArgs.parse(args);
          const results = searchGridCodes({
            query: parsed.query,
            code_type: parsed.code_type,
            limit: parsed.limit,
          });
          return textContent({ results, count: results.length });
        }

        case "se_energy_get_grid_code": {
          const parsed = GetGridCodeArgs.parse(args);
          const code = getGridCode(parsed.document_id);
          if (!code) {
            return errorContent(`Grid code not found: ID ${parsed.document_id}`);
          }
          return textContent(code);
        }

        case "se_energy_search_decisions": {
          const parsed = SearchDecisionsArgs.parse(args);
          const results = searchDecisions({
            query: parsed.query,
            decision_type: parsed.decision_type,
            limit: parsed.limit,
          });
          return textContent({ results, count: results.length });
        }

        case "se_energy_about": {
          const regulators = listRegulators();
          return textContent({
            name: SERVER_NAME,
            version: pkgVersion,
            description:
              "Swedish energy regulation MCP. Covers Energimarknadsinspektionen, Svenska kraftnat, Energimyndigheten, Elsakerhetsverket.",
            regulators: regulators.map((r) => ({ id: r.id, name: r.name, url: r.url })),
            tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
          });
        }

        case "se_energy_list_sources": {
          const counts = getRecordCounts();
          const sources = [
            {
              id: "ei",
              name: "Energimarknadsinspektionen (Ei)",
              url: "https://ei.se",
              record_count: getRegulationCountByRegulator("ei"),
              data_type: "regulations",
              last_refresh: dbBuildDate(),
              refresh_frequency: "quarterly",
            },
            {
              id: "energimyndigheten",
              name: "Energimyndigheten (Swedish Energy Agency)",
              url: "https://energimyndigheten.se",
              record_count:
                getRegulationCountByRegulator("energimyndigheten") + counts.decisions,
              data_type: "regulations + decisions",
              last_refresh: dbBuildDate(),
              refresh_frequency: "quarterly",
            },
            {
              id: "svenska_kraftnat",
              name: "Svenska kraftnat (Swedish TSO)",
              url: "https://svk.se",
              record_count: counts.grid_codes,
              data_type: "grid_codes",
              last_refresh: dbBuildDate(),
              refresh_frequency: "quarterly",
            },
            {
              id: "elsakerhetsverket",
              name: "Elsakerhetsverket (Electrical Safety Authority)",
              url: "https://elsakerhetsverket.se",
              record_count: getRegulationCountByRegulator("elsakerhetsverket"),
              data_type: "regulations",
              last_refresh: dbBuildDate(),
              refresh_frequency: "quarterly",
            },
          ];
          return textContent({
            sources,
            total_records: counts.regulations + counts.grid_codes + counts.decisions,
          });
        }

        case "se_energy_check_data_freshness": {
          const buildDate = dbBuildDate();
          const buildMs = buildDate !== "unknown" ? Date.parse(buildDate) : NaN;
          const nowMs = Date.now();

          const frequencyDays: Record<string, number> = {
            quarterly: 90,
          };

          const sourceEntries = [
            { source: "Energimarknadsinspektionen (ei.se)", frequency: "quarterly" },
            { source: "Energimyndigheten (energimyndigheten.se)", frequency: "quarterly" },
            { source: "Svenska kraftnat (svk.se)", frequency: "quarterly" },
            { source: "Elsakerhetsverket (elsakerhetsverket.se)", frequency: "quarterly" },
          ];

          const rows = sourceEntries.map((s) => {
            let status = "Unknown";
            if (!isNaN(buildMs)) {
              const thresholdMs = (frequencyDays[s.frequency] ?? 90) * 86_400_000;
              const ageMs = nowMs - buildMs;
              if (ageMs <= thresholdMs) {
                status = "Current";
              } else if (ageMs <= thresholdMs * 1.5) {
                status = "Due";
              } else {
                status = "OVERDUE";
              }
            }
            return { source: s.source, last_refresh: buildDate, frequency: s.frequency, status };
          });

          const header = "| Source | Last Refresh | Frequency | Status |";
          const sep = "|---|---|---|---|";
          const tableRows = rows.map(
            (r) => `| ${r.source} | ${r.last_refresh} | ${r.frequency} | ${r.status} |`,
          );
          const table = [header, sep, ...tableRows].join("\n");

          const updateInstructions =
            "To refresh data, run: npx tsx scripts/ingest-all.ts --force";

          return textContent({
            freshness_table: table,
            build_date: buildDate,
            update_instructions: updateInstructions,
            entries: rows,
          });
        }

        default:
          return errorContent(`Unknown tool: ${name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorContent(`Error in ${name}: ${message}`);
    }
  });

  return mcpServer;
}

// --- HTTP server ---

async function main(): Promise<void> {
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: Server }
  >();

  const httpServer = createServer((req, res) => {
    handleRequest(req, res, sessions).catch((err) => {
      console.error(`[${SERVER_NAME}] Unhandled error:`, err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  });

  async function handleRequest(
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
    activeSessions: Map<
      string,
      { transport: StreamableHTTPServerTransport; server: Server }
    >,
  ): Promise<void> {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: SERVER_NAME, version: pkgVersion }));
      return;
    }

    if (url.pathname === "/mcp") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && activeSessions.has(sessionId)) {
        const session = activeSessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        return;
      }

      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK type mismatch
      await mcpServer.connect(transport as any);

      transport.onclose = () => {
        if (transport.sessionId) {
          activeSessions.delete(transport.sessionId);
        }
        mcpServer.close().catch(() => {});
      };

      await transport.handleRequest(req, res);

      if (transport.sessionId) {
        activeSessions.set(transport.sessionId, { transport, server: mcpServer });
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  httpServer.listen(PORT, () => {
    console.error(`${SERVER_NAME} v${pkgVersion} (HTTP) listening on port ${PORT}`);
    console.error(`MCP endpoint:  http://localhost:${PORT}/mcp`);
    console.error(`Health check:  http://localhost:${PORT}/health`);
  });

  process.on("SIGTERM", () => {
    console.error("Received SIGTERM, shutting down...");
    httpServer.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
