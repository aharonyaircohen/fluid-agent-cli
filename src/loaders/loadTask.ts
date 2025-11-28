import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { TaskFile, LoadedTask } from '../types/cliTypes.js';

export async function loadTask(taskFilePath: string): Promise<LoadedTask> {
  const absolutePath = path.resolve(taskFilePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Task file not found: ${absolutePath}`);
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
  const extension = path.extname(absolutePath).toLowerCase();
  
  let taskData: any;
  
  try {
    if (extension === '.json') {
      taskData = JSON.parse(fileContent);
    } else if (extension === '.yaml' || extension === '.yml') {
      taskData = YAML.parse(fileContent);
    } else {
      throw new Error(`Unsupported file format: ${extension}. Supported formats: .json, .yaml, .yml`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse ${extension} file: ${error.message}`);
    }
    throw new Error(`Failed to parse ${extension} file: Unknown error`);
  }

  // Validate required fields
  if (!taskData.id) {
    throw new Error('Task file must contain an "id" field');
  }
  
  if (!taskData.objective) {
    throw new Error('Task file must contain an "objective" field');
  }
  
  if (!taskData.contextFiles || !Array.isArray(taskData.contextFiles)) {
    throw new Error('Task file must contain a "contextFiles" array');
  }

  const task: TaskFile = {
    id: taskData.id,
    objective: taskData.objective,
    contextFiles: taskData.contextFiles,
    ...taskData
  };

  return {
    task,
    filePath: absolutePath
  };
}
