#!/usr/bin/env node

import { Command } from "commander";
import { logging } from "@digital-fluid/fluid-agent";
import { formatRunsTable, formatRunDetails, formatLogEvents } from "./formatting.js";

const { queryRuns, getRunEntry, getRunLogEvents } = logging;
type TaskRunType = logging.TaskRunType;
type LogEventFilter = logging.LogEventFilter;

const program = new Command();

program
  .name("fluid-logs")
  .description("Inspect task execution logs");

program
  .command("list")
  .requiredOption("--task <taskId>", "Task ID to list runs for")
  .option("--type <runType>", "Filter by run type (spec-validation|spec-to-execution|execution-run|runtime-run)")
  .option("--status <status>", "Filter by status (queued|running|completed|failed|cancelled|superseded)")
  .option("--json", "Output as JSON instead of table")
  .action(async (opts) => {
    try {
      // Use queryRuns API for better filtering
      const runs = await queryRuns({
        taskId: opts.task,
        runType: opts.type as TaskRunType | undefined,
        status: opts.status,
      });

      if (runs.length === 0) {
        console.log(`No runs found for task: ${opts.task}`);
        return;
      }

      if (opts.json) {
        // Output as JSON
        console.log(JSON.stringify(runs, null, 2));
      } else {
        // Output as formatted table
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
  .action(async (opts) => {
    try {
      const run = await getRunEntry(opts.run);

      if (!run) {
        throw new Error(`Run not found: ${opts.run}`);
      }

      // Always show formatted details for 'show' command
      formatRunDetails(run);

      // Show log event summary if requested
      if (opts.events && run.logEventsFile) {
        const events = await getRunLogEvents(opts.run, { limit: 10 });
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
  .requiredOption("--task <taskId>", "Task ID to get latest run for")
  .option("--type <runType>", "Filter by run type (spec-validation|spec-to-execution|execution-run|runtime-run)")
  .option("--json", "Output as JSON instead of formatted details")
  .action(async (opts) => {
    try {
      const runs = await queryRuns({
        taskId: opts.task,
        runType: opts.type as TaskRunType | undefined,
        limit: 1,
      });

      if (runs.length === 0) {
        throw new Error(`No runs found for task: ${opts.task}${opts.type ? ` with type: ${opts.type}` : ''}`);
      }

      const latest = runs[0];

      if (opts.json) {
        console.log(JSON.stringify(latest, null, 2));
      } else {
        formatRunDetails(latest);
      }
    } catch (error) {
      console.error(`Error getting latest run: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

program
  .command("events")
  .requiredOption("--run <runId>", "Run ID to show events for")
  .option("--level <level>", "Filter by log level (debug|info|warn|error)")
  .option("--source <source>", "Filter by source (agent|runtime|file-engine|cli|system)")
  .option("--since <timestamp>", "Filter events since ISO timestamp")
  .option("--until <timestamp>", "Filter events until ISO timestamp")
  .option("--search <text>", "Search in message text")
  .option("--limit <n>", "Limit number of results", parseInt)
  .option("--offset <n>", "Skip first N results", parseInt)
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    try {
      const filter: LogEventFilter = {
        level: opts.level,
        source: opts.source,
        since: opts.since,
        until: opts.until,
        messageContains: opts.search,
        limit: opts.limit,
        offset: opts.offset,
      };

      const events = await getRunLogEvents(opts.run, filter);

      if (events.length === 0) {
        console.log(`No log events found for run: ${opts.run}`);
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(events, null, 2));
      } else {
        formatLogEvents(events);
      }
    } catch (error) {
      console.error(`Error reading events: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

program.parse();
