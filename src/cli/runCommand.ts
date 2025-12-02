import * as path from 'path';
import { runTask, RuntimeTask, RunTaskResult, llm as agentLLM, buildPromptTask } from '@digital-fluid/fluid-agent';
import { applyAgentResult } from '../fileEngine/index.js';
import { loadTask } from '../loaders/loadTask.js';
import { CLIOptions } from '../types/cliTypes.js';

export async function runCommand(taskOrPrompt: string | undefined, options: CLIOptions): Promise<void> {
  try {
    const npmPromptFlag = readNpmConfigFlag('prompt') ?? readNpmConfigFlag('p');
    const npmChatFlag = readNpmConfigFlag('chat');

    // If npm swallowed flags, rehydrate chat flag from npm config
    if (!options.chat && npmChatFlag) {
      options.chat = true;
    }
    if (options.prompt === undefined && npmPromptFlag) {
      // treat as prompt flag without text; text may come from positional
      options.prompt = true;
    }

    const promptValue = typeof options.prompt === 'string' ? options.prompt : undefined;
    const promptFlagOnly = options.prompt === true;

    let effectivePrompt = promptValue;
    let taskFile = taskOrPrompt;

    if (promptFlagOnly) {
      if (taskFile) {
        effectivePrompt = taskFile;
        taskFile = undefined;
      } else {
        throw new Error("Provide prompt text after -p/--prompt or as the first argument");
      }
    }

    if (!effectivePrompt && !taskFile) {
      throw new Error("You must provide a task file or --prompt");
    }
    if (effectivePrompt && taskFile) {
      throw new Error("Provide either a task file or --prompt, not both");
    }

    let task: RuntimeTask;

    if (effectivePrompt) {
      task = buildPromptTask(effectivePrompt, options.chat ? 'chat' : 'execution');
      console.log(`Running prompt in ${options.chat ? 'chat' : 'execution'} mode`);
    } else if (taskFile) {
      try {
        console.log(`Loading task from: ${taskFile}`);
        const loaded = await loadTask(taskFile, { forceYaml: options.yaml });
        task = loaded.task;
      } catch (error) {
        const isNotFound = error instanceof Error && error.message.includes('Task file not found');

        if (isNotFound && (npmPromptFlag || npmChatFlag)) {
          // npm ate the flags, so treat the positional as prompt
          console.log(`Task file not found. Interpreting input as prompt: "${taskFile}" (npm captured flags)`);
          task = buildPromptTask(taskFile, options.chat ? 'chat' : 'execution');
        } else if (isNotFound) {
          const guidance =
            "Task file not found. If you intended to send a prompt, rerun with -p/--prompt (npm users: use `npm start -- -p \"...\"`).";
          throw new Error(guidance);
        } else {
          throw error;
        }
      }
    } else {
      throw new Error("Unable to resolve task input");
    }
    
    // Set up runtime options
    const rootDir = options.root ? path.resolve(options.root) : process.cwd();
    const writeMode = Boolean(options.write);
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
      agentInstructions: task.agentInstructions,
      taskType: task.taskType,
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
    const result: RunTaskResult = await runTask(llmClient, runtimeTask, { rootDir, logger });

    const isChatMode = runtimeTask.taskType === 'chat' || (result as any).mode === 'chat';

    if (isChatMode) {
      const preview = (result as any)?.traceSummary?.chatResponsePreview ?? (result as any)?.traceSummary;
      if (preview) {
        console.log(typeof preview === 'string' ? preview : JSON.stringify(preview, null, 2));
      }
      return;
    }

    // Apply file changes when the task produced execution output
    if (result.mode === 'execution') {
      console.log('=== APPLYING FILE CHANGES ===');

      const applySummary = await applyAgentResult(result.result, {
        rootDir,
        dryRun: !writeMode,
        logger,
      });

      const { counts, dryRun, operations } = applySummary;
      const modeLabel = dryRun ? 'DRY-RUN (no files written)' : 'WRITE MODE (changes applied)';

      console.log(`Mode: ${modeLabel}`);
      console.log(
        `File operations — created: ${counts.created}, updated: ${counts.updated}, deleted: ${counts.deleted}, skipped: ${counts.skipped}`
      );

      if (operations.length === 0) {
        console.log('No file operations returned by the agent.');
      } else if (dryRun) {
        console.log('Re-run with --write to apply these changes.');
      }

      console.log('');
    }
    
    console.log('');
    console.log('=== TASK EXECUTION COMPLETE ===');
    console.log('');
    
    // // Print summary
    // console.log('=== SUMMARY ===');
    // // Summarize using the engine-provided summary
    // console.log(JSON.stringify({
    //   summary: result,
    //   traceCount: result.trace?.length || 0
    // }, null, 2));
    // console.log('');
    
    // Print raw model output if available
    if (result.traceSummary) {
      console.log('=== RAW MODEL OUTPUT (last) ===');
      console.log(result.traceSummary);
      console.log('');
    }
    
    // Exit with appropriate code
    const hasErrorTrace = result.trace?.some((t) => (t as any).phase === 'error');
    if (hasErrorTrace) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error executing task:\n');

    if (error instanceof Error) {
      // Check if this is an InvalidAgentJSONError with enhanced diagnostics
      const hasEnhancedDiagnostics = (error as any).diagnostic || (error as any).tokenInfo || (error as any).trace;

      if (hasEnhancedDiagnostics) {
        displayEnhancedError(error);
      } else {
        console.error(error.message);
      }

      if (error.stack && process.env.DEBUG) {
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('Unknown error:', error);
    }
    process.exit(1);
  }
}

function readNpmConfigFlag(name: string): boolean | undefined {
  const value = process.env[`npm_config_${name}`];
  if (value === undefined) return undefined;
  if (value === '') return true;
  const normalized = value.toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return true;
}

/**
 * Display enhanced error information for InvalidAgentJSONError
 */
function displayEnhancedError(error: Error): void {
  const diagnostic = (error as any).diagnostic;
  const tokenInfo = (error as any).tokenInfo;
  const trace = (error as any).trace;
  const rawOutput = (error as any).rawOutput;

  console.error(error.message);
  console.error('');

  // Display diagnostic information
  if (diagnostic) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('📊 DIAGNOSTIC DETAILS');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error Type: ${diagnostic.type || 'unknown'}`);
    console.error(`Issue: ${diagnostic.message || 'No details available'}`);
    console.error(`Severity: ${diagnostic.severityScore || 'N/A'}/10`);

    if (diagnostic.suggestion) {
      console.error('');
      console.error('💡 Suggestion:');
      console.error(diagnostic.suggestion);
    }

    if (diagnostic.context) {
      console.error('');
      console.error('📍 Context:');
      console.error(diagnostic.context);
    }
    console.error('');
  }

  // Display token information
  if (tokenInfo) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('🔢 TOKEN INFORMATION');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (tokenInfo.finishReason) {
      console.error(`Finish Reason: ${tokenInfo.finishReason}`);
    }
    if (tokenInfo.usedTokens !== undefined) {
      console.error(`Used Tokens: ${tokenInfo.usedTokens}`);
    }
    if (tokenInfo.requestedTokens !== undefined) {
      console.error(`Requested Tokens: ${tokenInfo.requestedTokens}`);
    }
    if (tokenInfo.modelLimit !== undefined) {
      console.error(`Model Limit: ${tokenInfo.modelLimit}`);
    }

    // Show token limit warning if applicable
    if (tokenInfo.finishReason === 'length' || tokenInfo.finishReason === 'max_tokens') {
      console.error('');
      console.error('⚠️  Response was truncated due to token limits!');
      console.error('   The agent tried to return more content than allowed.');

      if (tokenInfo.requestedTokens && tokenInfo.modelLimit && tokenInfo.requestedTokens >= tokenInfo.modelLimit * 0.9) {
        console.error('   You are near the model\'s maximum token limit.');
        console.error('   Consider reducing the scope of the task or splitting it into smaller operations.');
      }
    }
    console.error('');
  }

  // Display trace summary if available
  if (trace && trace.length > 0) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('📋 EXECUTION TRACE');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Show key trace events
    const keyEvents = trace.filter((t: any) =>
      ['load_context', 'llm_call', 'validate_output', 'adaptive_tokens', 'token_exhaustion', 'error'].includes(t.phase)
    );

    keyEvents.forEach((event: any, index: number) => {
      console.error(`${index + 1}. [${event.phase}] ${event.message}`);
      if (event.meta && Object.keys(event.meta).length > 0) {
        console.error(`   Meta: ${JSON.stringify(event.meta)}`);
      }
    });

    console.error('');
    console.error(`Total trace events: ${trace.length}`);
    console.error('');
  }

  // Display raw output snippet
  if (rawOutput && rawOutput.trim()) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('📄 RAW OUTPUT (first 1000 chars)');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const snippet = rawOutput.slice(0, 1000);
    console.error(snippet);
    if (rawOutput.length > 1000) {
      console.error(`\n... (${rawOutput.length - 1000} more characters)`);
    }
    console.error('');
  }
}
