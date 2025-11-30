import type { AgentFileChange } from '@digital-fluid/fluid-agent';

export type FileOperationStatus = 'created' | 'updated' | 'deleted' | 'skipped';

export interface FileOperationResult {
  /** The original requested change from the agent. */
  change: AgentFileChange;

  /** Final status decided by the engine (created/updated/deleted/skipped). */
  status: FileOperationStatus;

  /** Optional message explaining what happened. */
  message?: string;
}

export interface ApplyAgentResultSummary {
  /** All per-file operation results. */
  operations: FileOperationResult[];

  /**
   * Whether this run was dry-run only (no changes written).
   */
  dryRun: boolean;

  /**
   * Count summary for convenience.
   */
  counts: {
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
  };
}

export interface ApplyAgentResultOptions {
  /** Project root directory where operations should be applied. */
  rootDir: string;

  /** When true, do not write to disk – only simulate operations. Default: false. */
  dryRun?: boolean;

  /**
   * Optional logger for debug info.
   * If provided, the engine may call logger with textual messages.
   */
  logger?: (message: string) => void;
}
