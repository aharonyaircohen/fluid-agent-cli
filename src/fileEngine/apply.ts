import type { AgentResult, AgentFileChange } from '@digital-fluid/fluid-agent';
import type {
  ApplyAgentResultOptions,
  ApplyAgentResultSummary,
  FileOperationResult,
} from './types.js';
import { resolveProjectPath, writeFileSafe, deleteFileSafe } from './fileSystem.js';

export async function applyAgentResult(
  result: AgentResult,
  options: ApplyAgentResultOptions
): Promise<ApplyAgentResultSummary> {
  const { rootDir, dryRun = false, logger } = options;

  const operations: FileOperationResult[] = [];

  for (const change of result.files) {
    const op = await applySingleChange(change, { rootDir, dryRun, logger });
    operations.push(op);
  }

  const counts = operations.reduce(
    (acc, op) => {
      acc[op.status] += 1;
      return acc;
    },
    {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
    } as ApplyAgentResultSummary['counts']
  );

  return {
    operations,
    dryRun,
    counts,
  };
}

interface ApplySingleChangeOptions {
  rootDir: string;
  dryRun: boolean;
  logger?: (message: string) => void;
}

async function applySingleChange(
  change: AgentFileChange,
  options: ApplySingleChangeOptions
): Promise<FileOperationResult> {
  const { rootDir, dryRun, logger } = options;

  const targetPath = resolveProjectPath(rootDir, change.path);

  switch (change.action) {
    case 'create':
    case 'update': {
      if (typeof change.content !== 'string') {
        return {
          change,
          status: 'skipped',
          message: 'Missing content for create/update action.',
        };
      }

      if (!dryRun) {
        await writeFileSafe(targetPath, change.content);
      }

      logger?.(`${change.action.toUpperCase()}: ${change.path}`);

      return {
        change,
        status: change.action === 'create' ? 'created' : 'updated',
        message: dryRun ? 'Dry-run: file would be written.' : 'File written successfully.',
      };
    }

    case 'delete': {
      if (!dryRun) {
        await deleteFileSafe(targetPath);
      }

      logger?.(`DELETE: ${change.path}`);

      return {
        change,
        status: 'deleted',
        message: dryRun ? 'Dry-run: file would be deleted.' : 'File deleted (or already absent).',
      };
    }

    case 'noop':
    default:
      logger?.(`SKIP (noop): ${change.path}`);
      return {
        change,
        status: 'skipped',
        message: 'No action (noop).',
      };
  }
}
