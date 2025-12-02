export interface CLIOptions {
  root?: string;
  write?: boolean;
  trace?: boolean;
  model?: string;
  prompt?: string | boolean;
  chat?: boolean;
  yaml?: boolean;
  yes?: boolean;
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
