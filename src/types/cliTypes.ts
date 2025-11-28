export interface CLIOptions {
  root?: string;
  write?: boolean;
  trace?: boolean;
  model?: string;
}

export interface TaskFile {
  id: string;
  objective: string;
  contextFiles: string[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  [key: string]: any;
}

export interface LoadedTask {
  task: TaskFile;
  filePath: string;
}
