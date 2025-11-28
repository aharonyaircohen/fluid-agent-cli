import * as agent from "@digital-fluid/fluid-agent";

const client: agent.llm.LLMClient = agent.llm.getDefaultLLMClient();

const task: agent.runtime.RuntimeTask = {
  id: "add-log-to-index",
  objective: `add 'Hello, Fluid Agent!' text index.html`,
  contextFiles: ["index.html"],
  systemPrompt:
    "You are a strict code-editing agent. You only respond with valid JSON that matches the AgentResult schema. Your response should be only the JSON object, without any markdown wrappers.",
  agentInstructions:
    `For each file change, return the full new content. Do not use diffs. Use the AgentResult.files[] format.
You must conform to the following JSON schema:
{
  "files": [
    {
      "path": "path/to/file",
      "action": "create" | "update" | "delete",
      "content": "new file content"
    }
  ]
}`,
};

async function runDryRun() {
  console.log("Starting DRY RUN...\n");

  const dryRunResult: agent.runtime.RunTaskResult = await agent.runtime.runTask(client, task, {
    rootDir: process.cwd(),
    dryRun: true,
    logger: console.log,
  });

  console.log("\n=== DRY RUN TRACE ===");
  for (const event of dryRunResult.trace) {
    const meta = event.meta ? ` | meta: ${JSON.stringify(event.meta)}` : "";
    console.log(`[${event.timestamp}] [${event.phase}] ${event.message}${meta}`);
  }

  console.log("\n=== DRY RUN SUMMARY ===");
  console.log(JSON.stringify(dryRunResult.summary, null, 2));

  console.log("\n=== DRY RUN RAW OUTPUT ===");
  console.log(dryRunResult.rawModelOutput);

  console.log("\n--- DRY RUN COMPLETED ---\n");
}

async function runRealWrite() {
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
    // Execute dry run and wait for it to complete
    await runDryRun();

    // Only after dry run completes, execute real write
    await runRealWrite();

  } catch (err) {
    console.error("Error during test execution:", err);
    process.exit(1);
  }
})();
