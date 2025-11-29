import pc from "picocolors";
import type { logging } from "@digital-fluid/fluid-agent";

type TaskLogEntry = logging.TaskLogEntry;
type TaskStatus = logging.TaskStatus;
type LogEventEntry = logging.LogEventEntry;
type LogLevel = logging.LogLevel;

/**
 * Colorize status text based on status value
 */
export function colorizeStatus(status: TaskStatus): string {
  switch (status) {
    case "completed":
      return pc.green(status);
    case "failed":
      return pc.red(status);
    case "running":
      return pc.yellow(status);
    case "queued":
      return pc.cyan(status);
    case "cancelled":
    case "superseded":
      return pc.gray(status);
    default:
      return status;
  }
}

/**
 * Format ISO timestamp to human-readable format
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Return relative time for recent timestamps
  if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    // Return formatted date for older timestamps
    return date.toLocaleString();
  }
}

/**
 * Calculate duration between start and end timestamps
 */
export function calculateDuration(start: string, end?: string): string {
  if (!end) {
    return "running";
  }

  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const durationMs = endTime - startTime;
  const durationSecs = durationMs / 1000;

  if (durationSecs < 1) {
    return `${durationMs}ms`;
  } else if (durationSecs < 60) {
    return `${durationSecs.toFixed(1)}s`;
  } else {
    const mins = Math.floor(durationSecs / 60);
    const secs = Math.floor(durationSecs % 60);
    return `${mins}m ${secs}s`;
  }
}

/**
 * Truncate hash to show first N characters
 */
function truncateHash(hash: string | undefined, length: number = 8): string {
  if (!hash) return "N/A";
  return hash.substring(0, length);
}

/**
 * Format runs as a table for console display
 */
export function formatRunsTable(runs: TaskLogEntry[]): void {
  if (runs.length === 0) {
    console.log("No runs found.");
    return;
  }

  const tableData = runs.map((r) => ({
    id: truncateHash(r.id, 8),
    runType: r.runType,
    status: colorizeStatus(r.status),
    attempt: r.attemptNumber,
    created: formatTimestamp(r.createdAt),
    duration: calculateDuration(r.createdAt, r.finishedAt),
    specHash: truncateHash(r.specHash, 8),
    execHash: truncateHash(r.executionHash, 8),
    parentRun: truncateHash(r.parentRunId, 8),
  }));

  console.table(tableData);
}

/**
 * Format a single run with full details
 */
export function formatRunDetails(run: TaskLogEntry): void {
  console.log(pc.bold("\nRun Details:"));
  console.log(pc.dim("━".repeat(60)));

  console.log(`${pc.bold("ID:")}              ${run.id}`);
  console.log(`${pc.bold("Task ID:")}         ${run.taskId}`);
  console.log(`${pc.bold("Run Type:")}        ${run.runType}`);
  console.log(`${pc.bold("Status:")}          ${colorizeStatus(run.status)}`);
  console.log(`${pc.bold("Attempt:")}         ${run.attemptNumber}`);
  console.log(`${pc.bold("Agent Version:")}   ${run.agentVersion}`);

  console.log(pc.dim("\nTimestamps:"));
  console.log(`${pc.bold("Created:")}         ${run.createdAt} (${formatTimestamp(run.createdAt)})`);
  if (run.startedAt) {
    console.log(`${pc.bold("Started:")}         ${run.startedAt}`);
  }
  if (run.finishedAt) {
    console.log(`${pc.bold("Finished:")}        ${run.finishedAt}`);
    console.log(`${pc.bold("Duration:")}        ${calculateDuration(run.createdAt, run.finishedAt)}`);
  }

  console.log(pc.dim("\nHashes:"));
  console.log(`${pc.bold("Spec Hash:")}       ${run.specHash || "N/A"}`);
  if (run.executionHash) {
    console.log(`${pc.bold("Execution Hash:")}  ${run.executionHash}`);
  }

  if (run.parentRunId || run.previousRunId || run.replacedByRunId || run.cancelledByRunId) {
    console.log(pc.dim("\nRelationships:"));
    if (run.parentRunId) {
      console.log(`${pc.bold("Parent Run:")}      ${run.parentRunId}`);
    }
    if (run.previousRunId) {
      console.log(`${pc.bold("Previous Run:")}    ${run.previousRunId}`);
    }
    if (run.replacedByRunId) {
      console.log(`${pc.bold("Replaced By:")}     ${run.replacedByRunId}`);
    }
    if (run.cancelledByRunId) {
      console.log(`${pc.bold("Cancelled By:")}    ${run.cancelledByRunId}`);
    }
  }

  if (run.artifactsDir || run.specPath || run.executionPath) {
    console.log(pc.dim("\nArtifacts:"));
    if (run.artifactsDir) {
      console.log(`${pc.bold("Directory:")}       ${run.artifactsDir}`);
    }
    if (run.specPath) {
      console.log(`${pc.bold("Spec:")}            ${run.specPath}`);
    }
    if (run.executionPath) {
      console.log(`${pc.bold("Execution:")}       ${run.executionPath}`);
    }
  }

  if (run.error) {
    console.log(pc.dim("\nError:"));
    console.log(pc.red(run.error));
  }

  if (run.logEventsFile) {
    console.log(pc.dim("\nLog Events:"));
    console.log(`${pc.bold("File:")}            ${run.logEventsFile}`);
    console.log(pc.dim("  Use --events flag to view recent log events"));
  }

  if (run.metadata && Object.keys(run.metadata).length > 0) {
    console.log(pc.dim("\nMetadata:"));
    console.log(JSON.stringify(run.metadata, null, 2));
  }

  console.log(pc.dim("━".repeat(60)));
}

/**
 * Colorize log level
 */
function colorizeLevel(level: LogLevel): string {
  switch (level) {
    case "debug":
      return pc.gray("DEBUG");
    case "info":
      return pc.cyan("INFO ");
    case "warn":
      return pc.yellow("WARN ");
    case "error":
      return pc.red("ERROR");
  }
}

/**
 * Format log events as a stream (similar to log output)
 */
export function formatLogEvents(events: LogEventEntry[]): void {
  if (events.length === 0) {
    console.log("No log events found.");
    return;
  }

  console.log(pc.dim(`Showing ${events.length} log event(s):\n`));

  for (const event of events) {
    const timestamp = formatTimestamp(event.timestamp);
    const level = colorizeLevel(event.level);
    const source = pc.dim(`[${event.source}]`);

    let message = event.message;
    if (event.level === "error") {
      message = pc.red(message);
    } else if (event.level === "warn") {
      message = pc.yellow(message);
    }

    console.log(`${timestamp.padEnd(12)} ${level} ${source.padEnd(18)} ${message}`);

    // Show context if present
    if (event.context && Object.keys(event.context).length > 0) {
      console.log(pc.dim("  Context: ") + JSON.stringify(event.context));
    }
  }
}
