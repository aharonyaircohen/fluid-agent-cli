/**
 * End-to-end tests for fluid-logs CLI
 *
 * These tests execute the actual CLI binary and verify output
 * Run with: npm run test:e2e
 */

import { test, describe, before } from "node:test";
import assert from "node:assert";
import { execSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";
import { logging } from "@digital-fluid/fluid-agent";

const { createRun, markRunStarted, markRunCompleted, markRunFailed } = logging;
const { prepareArtifactsDir, writeSpecArtifact, writeExecutionArtifact, writeDiagnosticsArtifact } = logging;
const { hashSpec, hashExecution } = logging;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the compiled CLI binary
const CLI_PATH = path.join(__dirname, "../../../dist/cli/logs.js");
const TEST_TASK_ID = "e2e-test-task";

// Helper to execute CLI commands
function runCLI(args: string, verbose = false): string {
  try {
    const output = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Log output if verbose mode or VERBOSE env var is set
    if (verbose || process.env.VERBOSE === "true") {
      console.log(`\n$ fluid-logs ${args}`);
      console.log(output);
    }

    return output;
  } catch (error: any) {
    throw new Error(`CLI command failed: ${error.message}\n${error.stderr || ""}`);
  }
}

// Helper to parse JSON output
function runCLIJSON(args: string): any {
  const output = runCLI(args);
  return JSON.parse(output);
}

// Test data
const testData = {
  completedRunId: "",
  failedRunId: "",
  runningRunId: "",
  runtimeRunId: "",
};

describe("fluid-logs CLI E2E", () => {
  before(async () => {
    // Generate test data
    const agentVersion = "0.1.0-e2e-test";

    // Scenario 1: Completed spec-to-execution run
    const spec1 = { objective: "E2E test objective 1", files: ["test1.ts"] };
    const run1 = await createRun({
      taskId: TEST_TASK_ID,
      runType: "spec-to-execution",
      specHash: hashSpec(spec1),
      agentVersion,
    });

    const artifacts1 = await prepareArtifactsDir(run1.id, run1.createdAt);
    await writeSpecArtifact(run1.id, artifacts1, spec1);
    await markRunStarted(run1.id);

    const execution1 = { steps: [{ action: "create", path: "test1.ts" }] };
    await writeExecutionArtifact(run1.id, artifacts1, execution1);
    await markRunCompleted(run1.id, {
      executionHash: hashExecution(execution1),
      artifactsDir: artifacts1,
    });

    testData.completedRunId = run1.id;

    // Scenario 2: Failed spec-to-execution run
    const spec2 = { objective: "E2E test objective 2 (will fail)", files: ["test2.ts"] };
    const run2 = await createRun({
      taskId: TEST_TASK_ID,
      runType: "spec-to-execution",
      specHash: hashSpec(spec2),
      agentVersion,
    });

    const artifacts2 = await prepareArtifactsDir(run2.id, run2.createdAt);
    await writeSpecArtifact(run2.id, artifacts2, spec2);
    await markRunStarted(run2.id);
    await writeDiagnosticsArtifact(run2.id, artifacts2, "Error: E2E test failure");
    await markRunFailed(run2.id, "E2E test failure");

    testData.failedRunId = run2.id;

    // Scenario 3: Running execution-run
    const execution3 = { steps: [{ action: "update", path: "test3.ts" }] };
    const run3 = await createRun({
      taskId: TEST_TASK_ID,
      runType: "execution-run",
      specHash: hashExecution(execution3),
      agentVersion,
    });

    const artifacts3 = await prepareArtifactsDir(run3.id, run3.createdAt);
    await writeExecutionArtifact(run3.id, artifacts3, execution3);
    await markRunStarted(run3.id);

    testData.runningRunId = run3.id;

    // Scenario 4: Completed runtime-run
    const spec4 = { objective: "E2E runtime test", files: [] };
    const run4 = await createRun({
      taskId: TEST_TASK_ID,
      runType: "runtime-run",
      specHash: hashSpec(spec4),
      agentVersion,
    });

    await markRunStarted(run4.id);
    const artifacts4 = await prepareArtifactsDir(run4.id, run4.createdAt);
    await markRunCompleted(run4.id, {
      executionHash: hashExecution({ steps: [] }),
      artifactsDir: artifacts4,
    });

    testData.runtimeRunId = run4.id;
  });

  describe("list command", () => {
    test("lists all runs for task", () => {
      const output = runCLI(`list --task ${TEST_TASK_ID}`);
      assert.ok(output.includes(testData.completedRunId.substring(0, 8)));
      assert.ok(output.includes(testData.failedRunId.substring(0, 8)));
      assert.ok(output.includes(testData.runningRunId.substring(0, 8)));
    });

    test("filters by status: completed", () => {
      const output = runCLI(`list --task ${TEST_TASK_ID} --status completed`);
      assert.ok(output.includes(testData.completedRunId.substring(0, 8)));
      assert.ok(!output.includes(testData.failedRunId.substring(0, 8)));
      assert.ok(!output.includes(testData.runningRunId.substring(0, 8)));
    });

    test("filters by status: failed", () => {
      const output = runCLI(`list --task ${TEST_TASK_ID} --status failed`);
      assert.ok(!output.includes(testData.completedRunId.substring(0, 8)));
      assert.ok(output.includes(testData.failedRunId.substring(0, 8)));
      assert.ok(!output.includes(testData.runningRunId.substring(0, 8)));
    });

    test("filters by status: running", () => {
      const output = runCLI(`list --task ${TEST_TASK_ID} --status running`);
      assert.ok(!output.includes(testData.completedRunId.substring(0, 8)));
      assert.ok(!output.includes(testData.failedRunId.substring(0, 8)));
      assert.ok(output.includes(testData.runningRunId.substring(0, 8)));
    });

    test("filters by type: spec-to-execution", () => {
      const output = runCLI(`list --task ${TEST_TASK_ID} --type spec-to-execution`);
      assert.ok(output.includes(testData.completedRunId.substring(0, 8)));
      assert.ok(output.includes(testData.failedRunId.substring(0, 8)));
    });

    test("filters by type: execution-run", () => {
      const output = runCLI(`list --task ${TEST_TASK_ID} --type execution-run`);
      assert.ok(output.includes(testData.runningRunId.substring(0, 8)));
    });

    test("filters by type: runtime-run", () => {
      const output = runCLI(`list --task ${TEST_TASK_ID} --type runtime-run`);
      assert.ok(output.includes("runtime-run"));
    });

    test("outputs JSON format", () => {
      const runs = runCLIJSON(`list --task ${TEST_TASK_ID} --json`);
      assert.ok(Array.isArray(runs));
      assert.ok(runs.length >= 4);
      assert.ok(runs[0].id);
      assert.strictEqual(runs[0].taskId, TEST_TASK_ID);
    });

    test("combines type and status filters", () => {
      const output = runCLI(`list --task ${TEST_TASK_ID} --type spec-to-execution --status failed`);
      assert.ok(!output.includes(testData.completedRunId.substring(0, 8)));
      assert.ok(output.includes(testData.failedRunId.substring(0, 8)));
    });
  });

  describe("show command", () => {
    test("shows details for completed run", () => {
      const output = runCLI(`show --run ${testData.completedRunId}`);
      assert.ok(output.includes(testData.completedRunId));
      assert.ok(output.includes("spec-to-execution"));
      assert.ok(output.includes("completed"));
      assert.ok(output.includes("Run Details"));
      assert.ok(output.includes("Task ID"));
    });

    test("shows details for failed run", () => {
      const output = runCLI(`show --run ${testData.failedRunId}`);
      assert.ok(output.includes(testData.failedRunId));
      assert.ok(output.includes("failed"));
      assert.ok(output.includes("Run Details"));
    });

    test("shows details for running run", () => {
      const output = runCLI(`show --run ${testData.runningRunId}`);
      assert.ok(output.includes(testData.runningRunId));
      assert.ok(output.includes("running"));
      assert.ok(output.includes("Run Details"));
    });
  });

  describe("latest command", () => {
    test("gets latest run for task", () => {
      const output = runCLI(`latest --task ${TEST_TASK_ID}`);
      assert.ok(output.includes(TEST_TASK_ID));
    });

    test("filters latest by type: spec-to-execution", () => {
      const output = runCLI(`latest --task ${TEST_TASK_ID} --type spec-to-execution`);
      const hasCompleted = output.includes(testData.completedRunId.substring(0, 8));
      const hasFailed = output.includes(testData.failedRunId.substring(0, 8));
      assert.ok(hasCompleted || hasFailed);
    });

    test("filters latest by type: execution-run", () => {
      const output = runCLI(`latest --task ${TEST_TASK_ID} --type execution-run`);
      assert.ok(output.includes(testData.runningRunId.substring(0, 8)));
    });

    test("outputs JSON format", () => {
      const run = runCLIJSON(`latest --task ${TEST_TASK_ID} --json`);
      assert.ok(run.id);
      assert.strictEqual(run.taskId, TEST_TASK_ID);
      assert.ok(run.runType);
      assert.ok(run.status);
    });
  });

  describe("error handling", () => {
    test("shows error for invalid run ID", () => {
      assert.throws(() => {
        runCLI("show --run invalid-run-id-12345");
      });
    });

    test("handles non-existent task gracefully", () => {
      const output = runCLI("list --task non-existent-task-12345");
      assert.ok(output);
    });
  });
});
