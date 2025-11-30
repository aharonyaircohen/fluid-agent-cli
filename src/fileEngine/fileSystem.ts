import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { InvalidPathError, FileSystemOperationError } from './errors.js';

/**
 * Convert Windows-style paths to POSIX-style paths.
 * Duplicated from fluid-agent to keep CLI independent.
 */
function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function resolveProjectPath(rootDir: string, relativePath: string): string {
  const normalized = toPosixPath(relativePath);
  const resolved = path.resolve(rootDir, normalized);

  const normalizedRoot = path.resolve(rootDir);
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw new InvalidPathError();
  }

  return resolved;
}

export async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFileSafe(filePath: string, content: string): Promise<void> {
  try {
    await ensureDirectoryExists(filePath);
    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    throw new FileSystemOperationError(`Failed to write file: ${filePath}`);
  }
}

export async function deleteFileSafe(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: unknown) {
    // If file does not exist, treat as success (idempotent delete)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw new FileSystemOperationError(`Failed to delete file: ${filePath}`);
  }
}
