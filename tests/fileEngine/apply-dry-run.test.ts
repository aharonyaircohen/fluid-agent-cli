import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentResult } from '@digital-fluid/fluid-agent';
import { applyAgentResult } from '../../src/fileEngine/apply.js';

describe('applyAgentResult - dry-run mode', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fluid-agent-dryrun-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('does not write files in dry-run mode for create action', async () => {
    const agentResult: AgentResult = {
      files: [
        {
          path: 'new-file.txt',
          action: 'create',
          content: 'This should not be written',
        },
      ],
    };

    const summary = await applyAgentResult(agentResult, {
      rootDir: tempDir,
      dryRun: true,
    });

    expect(summary.dryRun).toBe(true);
    expect(summary.operations).toHaveLength(1);
    expect(summary.operations[0].status).toBe('created');
    expect(summary.operations[0].message).toContain('Dry-run');

    expect(summary.counts.created).toBe(1);
    expect(summary.counts.updated).toBe(0);
    expect(summary.counts.deleted).toBe(0);
    expect(summary.counts.skipped).toBe(0);

    // Verify file was NOT actually created
    const filePath = path.join(tempDir, 'new-file.txt');
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('does not write files in dry-run mode for update action', async () => {
    const agentResult: AgentResult = {
      files: [
        {
          path: 'update-file.txt',
          action: 'update',
          content: 'Updated content',
        },
      ],
    };

    const summary = await applyAgentResult(agentResult, {
      rootDir: tempDir,
      dryRun: true,
    });

    expect(summary.operations[0].status).toBe('updated');
    expect(summary.operations[0].message).toContain('Dry-run');
    expect(summary.counts.updated).toBe(1);

    // Verify file was NOT created
    const filePath = path.join(tempDir, 'update-file.txt');
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('does not delete files in dry-run mode', async () => {
    // Pre-create a file
    const filePath = path.join(tempDir, 'delete-me.txt');
    await fs.writeFile(filePath, 'Existing content');

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
      dryRun: true,
    });

    expect(summary.operations[0].status).toBe('deleted');
    expect(summary.operations[0].message).toContain('Dry-run');
    expect(summary.counts.deleted).toBe(1);

    // Verify file still exists
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toBe('Existing content');
  });

  it('handles noop actions in dry-run mode', async () => {
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
      dryRun: true,
    });

    expect(summary.operations[0].status).toBe('skipped');
    expect(summary.operations[0].message).toContain('No action');
    expect(summary.counts.skipped).toBe(1);
  });

  it('processes multiple files in dry-run mode', async () => {
    const agentResult: AgentResult = {
      files: [
        { path: 'file1.txt', action: 'create', content: 'content1' },
        { path: 'file2.txt', action: 'update', content: 'content2' },
        { path: 'file3.txt', action: 'delete' },
        { path: 'file4.txt', action: 'noop' },
      ],
    };

    const summary = await applyAgentResult(agentResult, {
      rootDir: tempDir,
      dryRun: true,
    });

    expect(summary.operations).toHaveLength(4);
    expect(summary.counts.created).toBe(1);
    expect(summary.counts.updated).toBe(1);
    expect(summary.counts.deleted).toBe(1);
    expect(summary.counts.skipped).toBe(1);

    // Verify NO files were created
    const files = await fs.readdir(tempDir);
    expect(files).toEqual([]);
  });

  it('calls logger with correct messages in dry-run mode', async () => {
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
      dryRun: true,
      logger,
    });

    expect(logger).toHaveBeenCalledTimes(4);
    expect(logger).toHaveBeenCalledWith('CREATE: create.txt');
    expect(logger).toHaveBeenCalledWith('UPDATE: update.txt');
    expect(logger).toHaveBeenCalledWith('DELETE: delete.txt');
    expect(logger).toHaveBeenCalledWith('SKIP (noop): noop.txt');
  });

  it('skips files with missing content for create action', async () => {
    const agentResult: AgentResult = {
      files: [
        {
          path: 'no-content.txt',
          action: 'create',
          // content is missing
        },
      ],
    };

    const summary = await applyAgentResult(agentResult, {
      rootDir: tempDir,
      dryRun: true,
    });

    expect(summary.operations[0].status).toBe('skipped');
    expect(summary.operations[0].message).toContain('Missing content');
    expect(summary.counts.skipped).toBe(1);
    expect(summary.counts.created).toBe(0);
  });

  it('handles empty content in dry-run mode', async () => {
    const agentResult: AgentResult = {
      files: [
        {
          path: 'empty.txt',
          action: 'create',
          content: '',
        },
      ],
    };

    const summary = await applyAgentResult(agentResult, {
      rootDir: tempDir,
      dryRun: true,
    });

    expect(summary.operations[0].status).toBe('created');
    expect(summary.counts.created).toBe(1);

    // File should still not exist
    await expect(fs.access(path.join(tempDir, 'empty.txt'))).rejects.toThrow();
  });

  it('handles nested paths in dry-run mode', async () => {
    const agentResult: AgentResult = {
      files: [
        {
          path: 'src/components/Button.tsx',
          action: 'create',
          content: 'export const Button = () => null;',
        },
      ],
    };

    const summary = await applyAgentResult(agentResult, {
      rootDir: tempDir,
      dryRun: true,
    });

    expect(summary.operations[0].status).toBe('created');

    // Verify directories were NOT created
    await expect(fs.access(path.join(tempDir, 'src'))).rejects.toThrow();
  });

  it('returns empty result for empty file list', async () => {
    const agentResult: AgentResult = {
      files: [],
    };

    const summary = await applyAgentResult(agentResult, {
      rootDir: tempDir,
      dryRun: true,
    });

    expect(summary.operations).toEqual([]);
    expect(summary.counts.created).toBe(0);
    expect(summary.counts.updated).toBe(0);
    expect(summary.counts.deleted).toBe(0);
    expect(summary.counts.skipped).toBe(0);
  });

  it('includes change details in operation results', async () => {
    const agentResult: AgentResult = {
      files: [
        {
          path: 'test.txt',
          action: 'create',
          content: 'Test content',
          note: 'This is a test file',
        },
      ],
    };

    const summary = await applyAgentResult(agentResult, {
      rootDir: tempDir,
      dryRun: true,
    });

    expect(summary.operations[0].change).toEqual({
      path: 'test.txt',
      action: 'create',
      content: 'Test content',
      note: 'This is a test file',
    });
  });
});
