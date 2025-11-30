import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  resolveProjectPath,
  writeFileSafe,
  deleteFileSafe,
} from '../../src/fileEngine/fileSystem.js';
import { InvalidPathError, FileSystemOperationError } from '../../src/fileEngine/errors.js';

describe('fileSystem module', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fluid-agent-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('resolveProjectPath', () => {
    it('resolves relative paths correctly under rootDir', () => {
      const resolved = resolveProjectPath(tempDir, 'src/file.ts');
      expect(resolved).toBe(path.join(tempDir, 'src', 'file.ts'));
    });

    it('resolves nested paths', () => {
      const resolved = resolveProjectPath(tempDir, 'src/components/Button.tsx');
      expect(resolved).toBe(path.join(tempDir, 'src', 'components', 'Button.tsx'));
    });

    it('handles paths with Windows-style separators', () => {
      const resolved = resolveProjectPath(tempDir, 'src\\components\\Button.tsx');
      expect(resolved).toBe(path.join(tempDir, 'src', 'components', 'Button.tsx'));
    });

    it('handles dot-slash prefix', () => {
      const resolved = resolveProjectPath(tempDir, './src/file.ts');
      expect(resolved).toBe(path.join(tempDir, 'src', 'file.ts'));
    });

    it('throws InvalidPathError for parent directory traversal', () => {
      expect(() => resolveProjectPath(tempDir, '../outside')).toThrow(InvalidPathError);
    });

    it('throws InvalidPathError for absolute paths outside rootDir', () => {
      expect(() => resolveProjectPath(tempDir, '/etc/passwd')).toThrow(InvalidPathError);
    });

    it('throws InvalidPathError for sneaky traversal attempts', () => {
      expect(() => resolveProjectPath(tempDir, 'src/../../outside')).toThrow(InvalidPathError);
    });

    it('allows paths that start with similar names but are not traversals', () => {
      // This should work fine - it's a file named "..file" not a traversal
      const resolved = resolveProjectPath(tempDir, '..file.txt');
      expect(resolved).toBe(path.join(tempDir, '..file.txt'));
    });
  });

  describe('writeFileSafe', () => {
    it('writes a new file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await writeFileSafe(filePath, 'Hello, World!');

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Hello, World!');
    });

    it('overwrites an existing file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Original content');

      await writeFileSafe(filePath, 'Updated content');

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Updated content');
    });

    it('creates intermediate directories', async () => {
      const filePath = path.join(tempDir, 'nested', 'deep', 'file.txt');
      await writeFileSafe(filePath, 'Nested content');

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Nested content');

      // Verify directories were created
      const stat = await fs.stat(path.join(tempDir, 'nested', 'deep'));
      expect(stat.isDirectory()).toBe(true);
    });

    it('writes empty content', async () => {
      const filePath = path.join(tempDir, 'empty.txt');
      await writeFileSafe(filePath, '');

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('');
    });

    it('writes multiline content', async () => {
      const filePath = path.join(tempDir, 'multiline.txt');
      const content = 'Line 1\nLine 2\nLine 3';
      await writeFileSafe(filePath, content);

      const readContent = await fs.readFile(filePath, 'utf8');
      expect(readContent).toBe(content);
    });
  });

  describe('deleteFileSafe', () => {
    it('deletes an existing file', async () => {
      const filePath = path.join(tempDir, 'delete-me.txt');
      await fs.writeFile(filePath, 'Content to delete');

      await deleteFileSafe(filePath);

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('succeeds silently when file does not exist (idempotent)', async () => {
      const filePath = path.join(tempDir, 'non-existent.txt');

      // Should not throw
      await expect(deleteFileSafe(filePath)).resolves.toBeUndefined();
    });

    it('throws FileSystemOperationError for permission errors', async () => {
      // This test might be platform-specific and could be skipped on some systems
      // We'll create a simple test that verifies error wrapping
      const filePath = path.join(tempDir, 'protected.txt');
      await fs.writeFile(filePath, 'content');

      // Make the parent directory read-only on Unix-like systems
      if (process.platform !== 'win32') {
        await fs.chmod(tempDir, 0o444);

        await expect(deleteFileSafe(filePath)).rejects.toThrow(FileSystemOperationError);

        // Restore permissions for cleanup
        await fs.chmod(tempDir, 0o755);
      }
    });
  });

  describe('Integration: write and delete cycle', () => {
    it('can write and then delete a file', async () => {
      const filePath = path.join(tempDir, 'cycle.txt');

      // Write
      await writeFileSafe(filePath, 'Test content');
      let exists = await fs.access(filePath).then(() => true, () => false);
      expect(exists).toBe(true);

      // Delete
      await deleteFileSafe(filePath);
      exists = await fs.access(filePath).then(() => true, () => false);
      expect(exists).toBe(false);

      // Delete again (idempotent)
      await deleteFileSafe(filePath);
      exists = await fs.access(filePath).then(() => true, () => false);
      expect(exists).toBe(false);
    });
  });
});
