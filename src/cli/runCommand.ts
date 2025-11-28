import * as path from 'path';
import { runTask, RuntimeTask, RunTaskResult, llm as agentLLM } from '@digital-fluid/fluid-agent';
import { loadTask } from '../loaders/loadTask.js';
import { CLIOptions } from '../types/cliTypes.js';

export async function runCommand(taskFile: string, options: CLIOptions): Promise<void> {
  try {
    // Load and parse task file
    console.log(`Loading task from: ${taskFile}`);
    const { task } = await loadTask(taskFile);
    
    // Set up runtime options
    const rootDir = options.root ? path.resolve(options.root) : process.cwd();
    const writeMode = options.write || false;
    const showTrace = options.trace !== false; // default true unless --no-trace
    
    console.log(`Root directory: ${rootDir}`);
    console.log(`Write mode: ${writeMode ? 'enabled' : 'disabled (dry-run)'}`);
    console.log(`Trace output: ${showTrace ? 'enabled' : 'disabled'}`);
    console.log('');
    
    // Assemble RuntimeTask
    const runtimeTask: RuntimeTask = {
      id: task.id,
      objective: task.objective,
      contextFiles: task.contextFiles,
      model: options.model || task.model,
      maxTokens: task.maxTokens,
      temperature: task.temperature,
      systemPrompt: task.systemPrompt,
      agentInstructions: task.agentInstructions
    };
    
    // Prepare logger to capture runtime messages (the runtime returns structured trace in result)
    const logger = (msg: string) => {
      if (showTrace) {
        console.log(msg);
      }
    };
    
    // Run the task
    console.log('=== STARTING TASK EXECUTION ===');
    console.log('');
    
    // Acquire default LLM client and run the task
    const llmClient = agentLLM.getDefaultLLMClient();
    const result: RunTaskResult = await runTask(llmClient, runtimeTask, { rootDir, dryRun: !writeMode, logger });
    
    console.log('');
    console.log('=== TASK EXECUTION COMPLETE ===');
    console.log('');
    
    // Print summary
    console.log('=== SUMMARY ===');
    // Summarize using the engine-provided summary
    console.log(JSON.stringify({
      summary: result.summary,
      traceCount: result.trace?.length || 0
    }, null, 2));
    console.log('');
    
    // Print raw model output if available
    if (result.rawModelOutput) {
      console.log('=== RAW MODEL OUTPUT (last) ===');
      console.log(result.rawModelOutput);
      console.log('');
    }
    
    // Exit with appropriate code
    const hasErrorTrace = result.trace?.some((t) => (t as any).phase === 'error');
    if (hasErrorTrace) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error executing task:');
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack && process.env.DEBUG) {
        console.error('Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('Unknown error:', error);
    }
    process.exit(1);
  }
}
