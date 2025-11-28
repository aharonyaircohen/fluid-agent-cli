import * as agent from "@digital-fluid/fluid-agent";
import { readFile } from "fs/promises";
import path from "path";
import process from "process";

const client: agent.llm.LLMClient = agent.llm.getDefaultLLMClient();

async function loadAgentInstructions(): Promise<string> {
  const instructionsPath = path.resolve(process.cwd(), "instructions.md");

  try {
    return await readFile(instructionsPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load agent instructions from ${instructionsPath}: ${message}`);
  }
}

async function buildTask(): Promise<agent.runtime.RuntimeTask> {
  const agentInstructionsFromFile = await loadAgentInstructions();

  const outputFormatInstruction = `For each file change, return the full new content. Do not use diffs. Use the AgentResult.files[] format.
You must conform to the following JSON schema:
{
  "files": [
    {
      "path": "path/to/file",
      "action": "create" | "update" | "delete",
      "content": "new file content"
    }
  ]
}`;

  const agentInstructions = `${agentInstructionsFromFile}\n\n${outputFormatInstruction}`;

  return {
    id: "add-log-to-index",
    objective: `Building fluid-agent-cli node.js package`,
    systemPrompt:
      "You are a node.js typescript engineer. You have access to the file system and can create, update, and delete files as needed to accomplish your objective.",
    agentInstructions,
  };
}

async function runDryRun(task: agent.runtime.RuntimeTask) {
  console.log("Starting DRY RUN...\n");

  const result: agent.runtime.RunTaskResult = await agent.runtime.runTask(client, task, {
    rootDir: process.cwd(),
    dryRun: false,
    logger: console.log,
  });

  console.log("\n=== DRY RUN TRACE ===");
  for (const event of result.trace) {
    const meta = event.meta ? ` | meta: ${JSON.stringify(event.meta)}` : "";
    console.log(`[${event.timestamp}] [${event.phase}] ${event.message}${meta}`);
  }

  console.log("\n=== DRY RUN SUMMARY ===");
  console.log(JSON.stringify(result.summary, null, 2));

  console.log("\n=== DRY RUN RAW OUTPUT ===");
  console.log(result.rawModelOutput);

  console.log("\n--- DRY RUN COMPLETED ---\n");
}

async function runRealWrite(task: agent.runtime.RuntimeTask) {
  console.log("Starting REAL WRITE...\n");

  const realRunResult: agent.runtime.RunTaskResult = await agent.runtime.runTask(client, task, {
    rootDir: process.cwd(),
    dryRun: false,
    logger: console.log,
  });

  console.log("\n=== REAL RUN TRACE ===");
  for (const event of realRunResult.trace) {
    const meta = event.meta ? ` | meta: ${JSON.stringify(event.meta)}` : "";
    console.log(`[${event.timestamp}] [${event.phase}] ${event.message}${meta}`);
  }

  console.log("\n=== REAL RUN SUMMARY ===");
  console.log(JSON.stringify(realRunResult.summary, null, 2));

  console.log("\n=== REAL RAW OUTPUT ===");
  console.log(realRunResult.rawModelOutput);

  console.log("\n--- REAL WRITE COMPLETED ---\n");
}

(async function runTests() {
  try {
    const task = await buildTask();

    // Execute dry run and wait for it to complete
    await runDryRun(task);

    // Only after dry run completes, execute real write
    await runRealWrite(task);

  } catch (err) {
    console.error("Error during test execution:", err);
    process.exit(1);
  }
})();
