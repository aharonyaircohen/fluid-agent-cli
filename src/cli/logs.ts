#!/usr/bin/env node

import { Command } from "commander";
import { logging } from "@digital-fluid/fluid-agent";
import { formatRunsTable, formatRunDetails, formatLogEvents } from "./formatting.js";

const { queryRuns, getRunById, getRunWithArtifacts, getRunLogEvents, getRunTraceSummary } = logging;
type TaskRunType = logging.TaskRunType;
type TaskRunStatus = logging.TaskStatus;
type TaskOrigin = logging.TaskOrigin;
type RunStage = logging.RunStage;
type LogEventFilter = logging.LogEventFilter;
type RunArtifactsSelection = logging.RunArtifactsSelection;

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Expected a positive integer");
  }
  return parsed;
}

function parseNonNegativeInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Expected a non-negative integer");
  }
  return parsed;
}

function parseCsv(value?: string | string[]): string[] | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value : value.split(",");
  const cleaned = raw.map((entry) => entry.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function buildLogEventFilter(opts: {
  level?: string | string[];
  source?: string | string[];
  since?: string;
  until?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): LogEventFilter | undefined {
  if (
    !opts.level &&
    !opts.source &&
    !opts.since &&
    !opts.until &&
    !opts.search &&
    opts.limit === undefined &&
    opts.offset === undefined
  ) {
    return undefined;
  }

  const level = (parseCsv(opts.level) ?? opts.level) as LogEventFilter["level"];
  const source = (parseCsv(opts.source) ?? opts.source) as LogEventFilter["source"];

  return {
    level,
    source,
    since: opts.since,
    until: opts.until,
    messageContains: opts.search,
    limit: opts.limit,
    offset: opts.offset,
  };
}

function printJson(payload: unknown, pretty = true): void {
  console.log(JSON.stringify(payload, null, pretty ? 2 : undefined));
}

export function buildLogsCommand(commandName = "logs"): Command {
  const program = new Command(commandName);
  program.description("Inspect task execution logs");

  program
    .command("list")
    .option("--task <taskId>", "Task ID to list runs for")
    .option("--type <runType>", "Filter by run type (spec-validation|spec-to-execution|execution-run|runtime-run)")
    .option("--status <status>", "Filter by status (queued|running|completed|failed|cancelled|superseded)")
    .option("--origin <origin>", "Filter by task origin (cli|api|test|internal|legacy)")
  .option(
    "--stage <runStage>",
    "Filter by run stage (spec-validation|planning|execution|tests|cleanup|post-processing|summary|unknown)"
  )
  .option("--after <timestamp>", "Filter runs created after ISO timestamp")
  .option("--before <timestamp>", "Filter runs created before ISO timestamp")
  .option("--limit <n>", "Limit number of results (default 20, max 200)", parsePositiveInt)
  .option("-d, --details", "Show full details for each run instead of a table")
  .option("--json", "Output as JSON instead of table")
  .action(async (opts) => {
    try {
      const runs = await queryRuns({
        taskId: opts.task,
          runType: opts.type as TaskRunType | undefined,
          status: opts.status as TaskRunStatus | undefined,
          taskOrigin: opts.origin as TaskOrigin | undefined,
          runStage: opts.stage as RunStage | undefined,
          createdAfter: opts.after,
          createdBefore: opts.before,
          limit: opts.limit,
        });

      if (runs.length === 0) {
        console.log("No runs found for the provided filters.");
        return;
      }

      if (opts.json) {
        printJson(runs);
      } else if (opts.details) {
        runs.forEach((run, idx) => {
          formatRunDetails(run);
          if (idx < runs.length - 1) {
            console.log("");
          }
        });
      } else {
        formatRunsTable(runs);
      }
    } catch (error) {
      console.error(`Error listing runs: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command("show")
    .requiredOption("--run <runId>", "Run ID to show details for")
    .option("--events", "Include recent log events (last 10)")
    .option("--events-limit <n>", "How many log events to include when using --events", parsePositiveInt)
    .option("--json", "Output as JSON instead of formatted details")
    .action(async (opts) => {
      try {
        const run = await getRunById(opts.run);

        if (!run) {
          throw new Error(`Run not found: ${opts.run}`);
        }

        if (opts.json) {
          const payload: Record<string, unknown> = { ...run };
          if (opts.events && run.logEventsFile) {
            payload.events = await getRunLogEvents(opts.run, { limit: opts.eventsLimit ?? 10 });
          }
          printJson(payload);
          return;
        }

        formatRunDetails(run);

        if (opts.events && run.logEventsFile) {
          const events = await getRunLogEvents(opts.run, { limit: opts.eventsLimit ?? 10 });
          if (events.length > 0) {
            console.log("\n" + "Recent Log Events:".padEnd(60, "-"));
            formatLogEvents(events);
          } else {
            console.log("\nNo log events found for this run.");
          }
        }
      } catch (error) {
        console.error(`Error showing run: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

program
  .command("latest")
  .option("--task <taskId>", "Task ID to get latest run for")
  .option("--type <runType>", "Filter by run type (spec-validation|spec-to-execution|execution-run|runtime-run)")
  .option("--status <status>", "Filter by status (queued|running|completed|failed|cancelled|superseded)")
    .option("--origin <origin>", "Filter by task origin (cli|api|test|internal|legacy)")
  .option(
    "--stage <runStage>",
    "Filter by run stage (spec-validation|planning|execution|tests|cleanup|post-processing|summary|unknown)"
  )
  .option("--after <timestamp>", "Filter runs created after ISO timestamp")
  .option("--before <timestamp>", "Filter runs created before ISO timestamp")
  .option("-d, --details", "Show full run details instead of summary table")
  .option("--table", "Force table output (default is JSON)")
  .option("--json", "Output as JSON instead of formatted details")
  .action(async (opts) => {
    try {
      const runs = await queryRuns({
        taskId: opts.task,
        runType: opts.type as TaskRunType | undefined,
          status: opts.status as TaskRunStatus | undefined,
          taskOrigin: opts.origin as TaskOrigin | undefined,
          runStage: opts.stage as RunStage | undefined,
          createdAfter: opts.after,
          createdBefore: opts.before,
          limit: 1,
        });

        if (runs.length === 0) {
          throw new Error(`No runs found${opts.task ? ` for task: ${opts.task}` : ""}`);
        }

      const latest = runs[0];

      const defaultToJson = !opts.table && !opts.details && !opts.json;
      if (opts.json || defaultToJson) {
        printJson(latest);
      } else if (opts.details) {
        formatRunDetails(latest);
      } else {
        formatRunsTable([latest]);
      }
    } catch (error) {
      console.error(`Error getting latest run: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
    });

  program
    .command("events")
    .requiredOption("--run <runId>", "Run ID to show events for")
    .option(
      "--level <level>",
      "Filter by log level(s), comma-separated or repeatable (debug|info|warn|error)",
      parseCsv
    )
    .option(
      "--source <source>",
      "Filter by source(s), comma-separated or repeatable (agent|runtime|file-engine|cli|system)",
      parseCsv
    )
    .option("--since <timestamp>", "Filter events since ISO timestamp")
    .option("--until <timestamp>", "Filter events until ISO timestamp")
    .option("--search <text>", "Search in message text")
    .option("--limit <n>", "Limit number of results", parsePositiveInt)
    .option("--offset <n>", "Skip first N results", parseNonNegativeInt)
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const filter = buildLogEventFilter({
          level: opts.level,
          source: opts.source,
          since: opts.since,
          until: opts.until,
          search: opts.search,
          limit: opts.limit,
          offset: opts.offset,
        });

        const events = await getRunLogEvents(opts.run, filter);

        if (events.length === 0) {
          console.log(`No log events found for run: ${opts.run}`);
          return;
        }

        if (opts.json) {
          printJson(events);
        } else {
          formatLogEvents(events);
        }
      } catch (error) {
        console.error(`Error reading events: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command("get")
    .description("Get a run as JSON, optionally including artifacts")
    .requiredOption("--run <runId>", "Run ID to load")
    .option("--artifacts", "Include artifacts (spec, execution, diagnostics, runtime trace)")
    .option("--no-spec", "Exclude spec artifact (only applies with --artifacts)")
    .option("--no-execution", "Exclude execution artifact (only applies with --artifacts)")
    .option("--no-diagnostics", "Exclude diagnostics artifact (only applies with --artifacts)")
    .option("--no-runtime-trace", "Exclude runtime trace artifact (only applies with --artifacts)")
    .option("--log-events", "Include log events (filterable)")
    .option("--log-level <levels>", "Log level(s) to include, comma-separated", parseCsv)
    .option("--log-source <sources>", "Log source(s) to include, comma-separated", parseCsv)
    .option("--log-search <text>", "Search text inside log messages")
    .option("--log-since <timestamp>", "Include log events since ISO timestamp")
    .option("--log-until <timestamp>", "Include log events until ISO timestamp")
    .option("--log-limit <n>", "Limit number of log events", parsePositiveInt)
    .option("--log-offset <n>", "Skip the first N log events", parseNonNegativeInt)
    .option("--trace-summary", "Include runtime trace summary when available")
    .action(async (opts) => {
      try {
        const includeArtifacts = Boolean(opts.artifacts || opts.logEvents);

        if (!includeArtifacts) {
          const run = await getRunById(opts.run);
          if (!run) {
            throw new Error(`Run not found: ${opts.run}`);
          }
          printJson(run);
          return;
        }

        const logFilter = opts.logEvents
          ? buildLogEventFilter({
              level: opts.logLevel,
              source: opts.logSource,
              search: opts.logSearch,
              since: opts.logSince,
              until: opts.logUntil,
              limit: opts.logLimit,
              offset: opts.logOffset,
            }) ?? true
          : false;

        const selection: RunArtifactsSelection = {
          spec: opts.spec,
          execution: opts.execution,
          diagnostics: opts.diagnostics,
          runtimeTrace: opts.runtimeTrace,
          logEvents: logFilter,
        };

        const result = await getRunWithArtifacts(opts.run, selection);
        if (!result) {
          throw new Error(`Run not found: ${opts.run}`);
        }

        const payload: Record<string, unknown> = { ...result };
        if (opts.traceSummary) {
          const summary = await getRunTraceSummary(opts.run);
          if (summary) {
            payload.traceSummary = summary;
          }
        }

        printJson(payload);
      } catch (error) {
        console.error(`Error getting run: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildLogsCommand("fluid-logs")
    .parseAsync(process.argv)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
