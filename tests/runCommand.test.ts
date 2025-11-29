import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runCommand } from '../runCommand.js';
import { CLIOptions } from '../../types/cliTypes.js';

// Mock the fluid-agent module
const mockRunTask = jest.fn();
const mockGetDefaultLLMClient = jest.fn();

jest.mock('@digital-fluid/fluid-agent', () => ({
  runTask: (...args: any[]) => mockRunTask(...args),
  llm: {
    getDefaultLLMClient: () => mockGetDefaultLLMClient()
  }
}));

describe('runCommand', () => {
  let tempDir: string;
  let mockClient: any;
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let originalProcessExit: any;
  let consoleOutput: string[];
  let consoleErrors: string[];
  let exitCode: number | null;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-command-test-'));

    // Mock console methods to capture output
    consoleOutput = [];
    consoleErrors = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn((...args) => consoleOutput.push(args.join(' ')));
    console.error = jest.fn((...args) => consoleErrors.push(args.join(' ')));

    // Mock process.exit
    exitCode = null;
    originalProcessExit = process.exit;
    (process.exit as any) = jest.fn((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`Process exited with code ${code}`);
    });

    // Setup mock LLM client
    mockClient = { call: jest.fn() };
    mockGetDefaultLLMClient.mockReturnValue(mockClient);

    // Reset mock
    mockRunTask.mockReset();
  });

  afterEach(() => {
    // Restore original functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;

    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }

    jest.clearAllMocks();
  });

  describe('successful execution', () => {
    test('runs task with valid JSON file in dry-run mode', async () => {
      // Create task file
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test objective',
        contextFiles: ['file1.ts', 'file2.ts'],
        model: 'gpt-4'
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData, null, 2));

      // Mock successful task execution
      mockRunTask.mockResolvedValue({
        summary: {
          filesCreated: 0,
          filesUpdated: 1,
          filesDeleted: 0,
          success: true
        },
        trace: [
          { phase: 'load_context', message: 'Loading context', timestamp: new Date().toISOString() },
          { phase: 'done', message: 'Task completed', timestamp: new Date().toISOString() }
        ],
        rawModelOutput: '{"files": []}'
      });

      const options: CLIOptions = {
        root: tempDir,
        write: false,
        trace: true
      };

      await runCommand(taskFile, options);

      // Verify runTask was called correctly
      expect(mockRunTask).toHaveBeenCalledTimes(1);
      const [client, task, config] = mockRunTask.mock.calls[0];

      expect(client).toBe(mockClient);
      expect(task.id).toBe('test-task');
      expect(task.objective).toBe('Test objective');
      expect(config.rootDir).toBe(tempDir);
      expect(config.dryRun).toBe(true);

      // Verify output
      expect(consoleOutput.join('\n')).toContain('Loading task from:');
      expect(consoleOutput.join('\n')).toContain('Write mode: disabled (dry-run)');
      expect(consoleOutput.join('\n')).toContain('=== SUMMARY ===');
    });

    test('runs task with valid YAML file in write mode', async () => {
      // Create task file
      const taskFile = path.join(tempDir, 'task.yaml');
      const yamlContent = `
id: test-task
objective: Test objective
contextFiles:
  - file1.ts
  - file2.ts
model: gpt-4
`;
      fs.writeFileSync(taskFile, yamlContent);

      // Mock successful task execution
      mockRunTask.mockResolvedValue({
        summary: {
          filesCreated: 1,
          filesUpdated: 0,
          filesDeleted: 0,
          success: true
        },
        trace: [],
        rawModelOutput: '{"files": [{"path": "new.ts", "content": "..."}]}'
      });

      const options: CLIOptions = {
        root: tempDir,
        write: true,
        trace: false
      };

      await runCommand(taskFile, options);

      // Verify runTask was called with write mode
      expect(mockRunTask).toHaveBeenCalledTimes(1);
      const [, , config] = mockRunTask.mock.calls[0];
      expect(config.dryRun).toBe(false);

      // Verify output
      expect(consoleOutput.join('\n')).toContain('Write mode: enabled');
      expect(consoleOutput.join('\n')).toContain('Trace output: disabled');
    });

    test('overrides model when provided in options', async () => {
      // Create task file with default model
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test objective',
        contextFiles: ['file1.ts'],
        model: 'gpt-4'
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      mockRunTask.mockResolvedValue({
        summary: { success: true },
        trace: [],
        rawModelOutput: '{}'
      });

      const options: CLIOptions = {
        model: 'gpt-4-turbo'
      };

      await runCommand(taskFile, options);

      // Verify model was overridden
      const [, task] = mockRunTask.mock.calls[0];
      expect(task.model).toBe('gpt-4-turbo');
    });

    test('displays raw model output when available', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test',
        contextFiles: []
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      const rawOutput = '{"files": [{"path": "test.ts", "content": "console.log()"}]}';
      mockRunTask.mockResolvedValue({
        summary: { success: true },
        trace: [],
        rawModelOutput: rawOutput
      });

      await runCommand(taskFile, { trace: false });

      expect(consoleOutput.join('\n')).toContain('=== RAW MODEL OUTPUT (last) ===');
      expect(consoleOutput.join('\n')).toContain(rawOutput);
    });
  });

  describe('error handling', () => {
    test('handles task file not found', async () => {
      const taskFile = path.join(tempDir, 'nonexistent.json');
      const options: CLIOptions = {};

      try {
        await runCommand(taskFile, options);
      } catch (error) {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrors.join('\n')).toContain('Error executing task:');
      expect(exitCode).toBe(1);
    });

    test('handles invalid JSON in task file', async () => {
      const taskFile = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(taskFile, '{ invalid json }');
      const options: CLIOptions = {};

      try {
        await runCommand(taskFile, options);
      } catch (error) {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrors.join('\n')).toContain('Error executing task:');
      expect(exitCode).toBe(1);
    });

    test('handles missing required fields in task', async () => {
      const taskFile = path.join(tempDir, 'incomplete.json');
      const taskData = {
        id: 'test-task'
        // Missing objective and contextFiles
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));
      const options: CLIOptions = {};

      try {
        await runCommand(taskFile, options);
      } catch (error) {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrors.join('\n')).toContain('Error executing task:');
      expect(exitCode).toBe(1);
    });

    test('handles runtime errors from runTask', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test',
        contextFiles: []
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      // Mock runTask to throw an error
      mockRunTask.mockRejectedValue(new Error('Runtime execution failed'));

      const options: CLIOptions = {};

      try {
        await runCommand(taskFile, options);
      } catch (error) {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrors.join('\n')).toContain('Error executing task:');
      expect(consoleErrors.join('\n')).toContain('Runtime execution failed');
      expect(exitCode).toBe(1);
    });

    test('exits with code 1 when trace contains error phase', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test',
        contextFiles: []
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      mockRunTask.mockResolvedValue({
        summary: { success: false },
        trace: [
          { phase: 'load_context', message: 'Loading context', timestamp: new Date().toISOString() },
          { phase: 'error', message: 'Task failed', timestamp: new Date().toISOString() }
        ],
        rawModelOutput: '{}'
      });

      try {
        await runCommand(taskFile, {});
      } catch (error) {
        // Expected to throw due to process.exit mock
      }

      expect(exitCode).toBe(1);
    });

    test('shows stack trace when DEBUG env var is set', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test',
        contextFiles: []
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.ts:1:1';
      mockRunTask.mockRejectedValue(error);

      // Set DEBUG env var
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = '1';

      try {
        await runCommand(taskFile, {});
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrors.join('\n')).toContain('Stack trace:');
      expect(consoleErrors.join('\n')).toContain('at test.ts:1:1');

      // Restore DEBUG env var
      if (originalDebug === undefined) {
        delete process.env.DEBUG;
      } else {
        process.env.DEBUG = originalDebug;
      }
    });
  });

  describe('trace output control', () => {
    test('shows trace by default', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test',
        contextFiles: []
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      let loggerCalled = false;
      mockRunTask.mockImplementation((client, task, config) => {
        config.logger('Test trace message');
        loggerCalled = true;
        return Promise.resolve({
          summary: { success: true },
          trace: [],
          rawModelOutput: '{}'
        });
      });

      await runCommand(taskFile, {});

      expect(loggerCalled).toBe(true);
      expect(consoleOutput.join('\n')).toContain('Trace output: enabled');
    });

    test('suppresses trace with --no-trace option', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test',
        contextFiles: []
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      const traceMessages: string[] = [];
      mockRunTask.mockImplementation((client, task, config) => {
        config.logger('Test trace message');
        return Promise.resolve({
          summary: { success: true },
          trace: [],
          rawModelOutput: '{}'
        });
      });

      await runCommand(taskFile, { trace: false });

      expect(consoleOutput.join('\n')).toContain('Trace output: disabled');
      // Trace message should not appear in output
      expect(consoleOutput.join('\n')).not.toContain('Test trace message');
    });
  });

  describe('task configuration mapping', () => {
    test('maps all task fields to RuntimeTask', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test objective',
        contextFiles: ['file1.ts', 'file2.ts'],
        model: 'gpt-4',
        maxTokens: 4000,
        temperature: 0.7,
        systemPrompt: 'You are a helpful assistant',
        agentInstructions: 'Follow these instructions'
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      mockRunTask.mockResolvedValue({
        summary: { success: true },
        trace: [],
        rawModelOutput: '{}'
      });

      await runCommand(taskFile, {});

      const [, task] = mockRunTask.mock.calls[0];
      expect(task.id).toBe('test-task');
      expect(task.objective).toBe('Test objective');
      expect(task.contextFiles).toEqual(['file1.ts', 'file2.ts']);
      expect(task.model).toBe('gpt-4');
      expect(task.maxTokens).toBe(4000);
      expect(task.temperature).toBe(0.7);
      expect(task.systemPrompt).toBe('You are a helpful assistant');
      expect(task.agentInstructions).toBe('Follow these instructions');
    });

    test('uses process.cwd() as default root directory', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test',
        contextFiles: []
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      mockRunTask.mockResolvedValue({
        summary: { success: true },
        trace: [],
        rawModelOutput: '{}'
      });

      await runCommand(taskFile, {});

      const [, , config] = mockRunTask.mock.calls[0];
      expect(config.rootDir).toBe(process.cwd());
    });

    test('resolves relative root path', async () => {
      const taskFile = path.join(tempDir, 'task.json');
      const taskData = {
        id: 'test-task',
        objective: 'Test',
        contextFiles: []
      };
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      mockRunTask.mockResolvedValue({
        summary: { success: true },
        trace: [],
        rawModelOutput: '{}'
      });

      await runCommand(taskFile, { root: './relative/path' });

      const [, , config] = mockRunTask.mock.calls[0];
      expect(path.isAbsolute(config.rootDir)).toBe(true);
    });
  });
});
