import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentResult } from '@digital-fluid/fluid-agent';
import { applyAgentResult } from '../../src/fileEngine/apply.js';

describe('applyAgentResult - write mode', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fluid-agent-write-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('create action', () => {
    it('creates a new file', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: 'new-file.txt',
            action: 'create',
            content: 'Hello, World!',
          },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.dryRun).toBe(false);
      expect(summary.operations[0].status).toBe('created');
      expect(summary.operations[0].message).toContain('File written successfully');
      expect(summary.counts.created).toBe(1);

      // Verify file was actually created
      const filePath = path.join(tempDir, 'new-file.txt');
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Hello, World!');
    });

    it('creates files with nested directories', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: 'src/components/Button.tsx',
            action: 'create',
            content: 'export const Button = () => null;',
          },
        ],
      };

      await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      // Verify file and directories were created
      const filePath = path.join(tempDir, 'src', 'components', 'Button.tsx');
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('export const Button = () => null;');
    });

    it('creates an empty file when content is empty string', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: 'empty.txt',
            action: 'create',
            content: '',
          },
        ],
      };

      await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      const filePath = path.join(tempDir, 'empty.txt');
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('');
    });
  });

  describe('update action', () => {
    it('updates an existing file', async () => {
      // Pre-create a file
      const filePath = path.join(tempDir, 'update-me.txt');
      await fs.writeFile(filePath, 'Original content');

      const agentResult: AgentResult = {
        files: [
          {
            path: 'update-me.txt',
            action: 'update',
            content: 'Updated content',
          },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.operations[0].status).toBe('updated');
      expect(summary.counts.updated).toBe(1);

      // Verify file was updated
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Updated content');
    });

    it('creates file if it does not exist (update behaves like create)', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: 'new-via-update.txt',
            action: 'update',
            content: 'Created via update',
          },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.operations[0].status).toBe('updated');

      // Verify file was created
      const filePath = path.join(tempDir, 'new-via-update.txt');
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Created via update');
    });
  });

  describe('delete action', () => {
    it('deletes an existing file', async () => {
      // Pre-create a file
      const filePath = path.join(tempDir, 'delete-me.txt');
      await fs.writeFile(filePath, 'To be deleted');

      const agentResult: AgentResult = {
        files: [
          {
            path: 'delete-me.txt',
            action: 'delete',
          },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.operations[0].status).toBe('deleted');
      expect(summary.counts.deleted).toBe(1);

      // Verify file was deleted
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('succeeds when deleting non-existent file (idempotent)', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: 'non-existent.txt',
            action: 'delete',
          },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.operations[0].status).toBe('deleted');
      expect(summary.operations[0].message).toContain('already absent');
      expect(summary.counts.deleted).toBe(1);
    });
  });

  describe('noop action', () => {
    it('skips noop actions without modifying filesystem', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: 'noop-file.txt',
            action: 'noop',
          },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.operations[0].status).toBe('skipped');
      expect(summary.counts.skipped).toBe(1);

      // Verify no files were created
      const files = await fs.readdir(tempDir);
      expect(files).toEqual([]);
    });
  });

  describe('multiple operations', () => {
    it('processes all file operations correctly', async () => {
      // Pre-create files for update and delete
      await fs.writeFile(path.join(tempDir, 'update.txt'), 'Original');
      await fs.writeFile(path.join(tempDir, 'delete.txt'), 'To delete');

      const agentResult: AgentResult = {
        files: [
          { path: 'create.txt', action: 'create', content: 'Created' },
          { path: 'update.txt', action: 'update', content: 'Updated' },
          { path: 'delete.txt', action: 'delete' },
          { path: 'noop.txt', action: 'noop' },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.counts.created).toBe(1);
      expect(summary.counts.updated).toBe(1);
      expect(summary.counts.deleted).toBe(1);
      expect(summary.counts.skipped).toBe(1);

      // Verify filesystem state
      const createContent = await fs.readFile(path.join(tempDir, 'create.txt'), 'utf8');
      expect(createContent).toBe('Created');

      const updateContent = await fs.readFile(path.join(tempDir, 'update.txt'), 'utf8');
      expect(updateContent).toBe('Updated');

      await expect(fs.access(path.join(tempDir, 'delete.txt'))).rejects.toThrow();
      await expect(fs.access(path.join(tempDir, 'noop.txt'))).rejects.toThrow();
    });
  });

  describe('logger', () => {
    it('calls logger with appropriate messages', async () => {
      const logger = jest.fn();

      const agentResult: AgentResult = {
        files: [
          { path: 'create.txt', action: 'create', content: 'content' },
          { path: 'update.txt', action: 'update', content: 'content' },
          { path: 'delete.txt', action: 'delete' },
          { path: 'noop.txt', action: 'noop' },
        ],
      };

      await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
        logger,
      });

      expect(logger).toHaveBeenCalledTimes(4);
      expect(logger).toHaveBeenCalledWith('CREATE: create.txt');
      expect(logger).toHaveBeenCalledWith('UPDATE: update.txt');
      expect(logger).toHaveBeenCalledWith('DELETE: delete.txt');
      expect(logger).toHaveBeenCalledWith('SKIP (noop): noop.txt');
    });
  });

  describe('edge cases', () => {
    it('handles missing content for create/update by skipping', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: 'no-content-create.txt',
            action: 'create',
            // content is missing
          },
          {
            path: 'no-content-update.txt',
            action: 'update',
            // content is missing
          },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.counts.skipped).toBe(2);
      expect(summary.counts.created).toBe(0);
      expect(summary.counts.updated).toBe(0);

      // Verify no files were created
      const files = await fs.readdir(tempDir);
      expect(files).toEqual([]);
    });

    it('handles multiline content correctly', async () => {
      const multilineContent = `Line 1
Line 2
Line 3`;

      const agentResult: AgentResult = {
        files: [
          {
            path: 'multiline.txt',
            action: 'create',
            content: multilineContent,
          },
        ],
      };

      await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      const content = await fs.readFile(path.join(tempDir, 'multiline.txt'), 'utf8');
      expect(content).toBe(multilineContent);
    });

    it('handles Unicode content', async () => {
      const unicodeContent = 'Hello 世界 🌍';

      const agentResult: AgentResult = {
        files: [
          {
            path: 'unicode.txt',
            action: 'create',
            content: unicodeContent,
          },
        ],
      };

      await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      const content = await fs.readFile(path.join(tempDir, 'unicode.txt'), 'utf8');
      expect(content).toBe(unicodeContent);
    });

    it('processes empty file list without errors', async () => {
      const agentResult: AgentResult = {
        files: [],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.operations).toEqual([]);
      expect(summary.counts.created).toBe(0);
      expect(summary.counts.updated).toBe(0);
      expect(summary.counts.deleted).toBe(0);
      expect(summary.counts.skipped).toBe(0);
    });
  });

  describe('path traversal protection', () => {
    it('throws InvalidPathError for paths outside rootDir', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: '../outside/file.txt',
            action: 'create',
            content: 'Malicious content',
          },
        ],
      };

      await expect(
        applyAgentResult(agentResult, {
          rootDir: tempDir,
          dryRun: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('operation result details', () => {
    it('includes original change in operation result', async () => {
      const agentResult: AgentResult = {
        files: [
          {
            path: 'test.txt',
            action: 'create',
            content: 'Test content',
            note: 'Test note',
          },
        ],
      };

      const summary = await applyAgentResult(agentResult, {
        rootDir: tempDir,
        dryRun: false,
      });

      expect(summary.operations[0].change).toEqual({
        path: 'test.txt',
        action: 'create',
        content: 'Test content',
        note: 'Test note',
      });
      expect(summary.operations[0].status).toBe('created');
      expect(summary.operations[0].message).toBeDefined();
    });
  });
});
