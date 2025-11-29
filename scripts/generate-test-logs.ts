#!/usr/bin/env ts-node

/**
 * Generate test log data for manual CLI testing
 *
 * Usage: npx tsx scripts/generate-test-logs.ts
 */

import { logging } from "@digital-fluid/fluid-agent";

const { createRun, markRunStarted, markRunCompleted, markRunFailed } = logging;
const { prepareArtifactsDir, writeSpecArtifact, writeExecutionArtifact, writeDiagnosticsArtifact } = logging;
const { hashSpec, hashExecution } = logging;

async function generateTestLogs() {
  console.log("Generating test log data...\n");

  const agentVersion = "0.1.0-test";
  const taskIds = ["test-task-1", "test-task-2", "test-task-3"];

  // Generate various test scenarios
  for (const taskId of taskIds) {
    console.log(`Creating runs for ${taskId}...`);

    // Scenario 1: Completed spec-to-execution run
    const spec1 = { objective: "Test objective 1", files: ["file1.ts"] };
    const specHash1 = hashSpec(spec1);

    const run1 = await createRun({
      taskId,
      runType: "spec-to-execution",
      specHash: specHash1,
      agentVersion,
    });

    const artifacts1 = await prepareArtifactsDir(run1.id, run1.createdAt);
    await writeSpecArtifact(run1.id, artifacts1, spec1);
    await markRunStarted(run1.id);

    const execution1 = { steps: [{ action: "create", path: "test.ts" }] };
    const execHash1 = hashExecution(execution1);
    await writeExecutionArtifact(run1.id, artifacts1, execution1);

    await markRunCompleted(run1.id, {
      executionHash: execHash1,
      artifactsDir: artifacts1,
    });

    console.log(`  ✓ Created completed spec-to-execution run: ${run1.id.substring(0, 8)}...`);

    // Scenario 2: Failed spec-to-execution run
    const spec2 = { objective: "Test objective 2 (will fail)", files: ["file2.ts"] };
    const specHash2 = hashSpec(spec2);

    const run2 = await createRun({
      taskId,
      runType: "spec-to-execution",
      specHash: specHash2,
      agentVersion,
    });

    const artifacts2 = await prepareArtifactsDir(run2.id, run2.createdAt);
    await writeSpecArtifact(run2.id, artifacts2, spec2);
    await markRunStarted(run2.id);

    await writeDiagnosticsArtifact(
      run2.id,
      artifacts2,
      "Error: Failed to convert spec to execution\nCaused by: Invalid spec format"
    );

    await markRunFailed(run2.id, "Failed to convert spec to execution");

    console.log(`  ✓ Created failed spec-to-execution run: ${run2.id.substring(0, 8)}...`);

    // Scenario 3: Completed execution-run with parent
    const execution3 = { steps: [{ action: "update", path: "test.ts", content: "updated" }] };
    const execHash3 = hashExecution(execution3);

    const run3 = await createRun({
      taskId,
      runType: "execution-run",
      specHash: execHash3,
      agentVersion,
      parentRunId: run1.id,
    });

    const artifacts3 = await prepareArtifactsDir(run3.id, run3.createdAt);
    await writeExecutionArtifact(run3.id, artifacts3, execution3);
    await markRunStarted(run3.id);

    await writeDiagnosticsArtifact(
      run3.id,
      artifacts3,
      "Execution completed successfully\nFiles updated: 1"
    );

    await markRunCompleted(run3.id, {
      executionHash: execHash3,
      artifactsDir: artifacts3,
    });

    console.log(`  ✓ Created completed execution-run: ${run3.id.substring(0, 8)}...`);

    // Scenario 4: Running spec-validation (not finished)
    const spec4 = { objective: "Test validation", files: [] };
    const specHash4 = hashSpec(spec4);

    const run4 = await createRun({
      taskId,
      runType: "spec-validation",
      specHash: specHash4,
      agentVersion,
    });

    await markRunStarted(run4.id);
    // Don't complete this one - leave it as "running"

    console.log(`  ✓ Created running spec-validation run: ${run4.id.substring(0, 8)}...`);
  }

  console.log("\n✓ Test log data generation complete!");
  console.log("\nYou can now test the CLI with:");
  console.log("  fluid-logs list --task test-task-1");
  console.log("  fluid-logs list --task test-task-1 --status failed");
  console.log("  fluid-logs list --task test-task-1 --type spec-to-execution");
  console.log("  fluid-logs list --task test-task-1 --json");
  console.log("  fluid-logs latest --task test-task-1");
  console.log("  fluid-logs show --run <runId>");
}

// Run the generator
generateTestLogs().catch((err) => {
  console.error("Error generating test logs:", err);
  process.exit(1);
});
