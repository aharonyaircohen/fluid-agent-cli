import * as fs from 'fs';
import * as path from 'path';
import { loadTask } from '../loadTask.js';
import { TaskFile } from '../../types/cliTypes.js';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('loadTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JSON loading', () => {
    it('should load valid JSON task file', async () => {
      const taskData = {
        id: 'test-task',
        objective: 'Test objective',
        contextFiles: ['src/**/*.ts'],
        model: 'gpt-4'
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
      
      const result = await loadTask('test.json');
      
      expect(result.task).toEqual(taskData);
      expect(result.filePath).toContain('test.json');
    });

    it('should throw error for invalid JSON', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json }');
      
      await expect(loadTask('test.json')).rejects.toThrow('Failed to parse .json file');
    });
  });

  describe('YAML loading', () => {
    it('should load valid YAML task file', async () => {
      const yamlContent = `
id: test-task
objective: Test objective
contextFiles:
  - src/**/*.ts
model: gpt-4
`;
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      const result = await loadTask('test.yaml');
      
      expect(result.task.id).toBe('test-task');
      expect(result.task.objective).toBe('Test objective');
      expect(result.task.contextFiles).toEqual(['src/**/*.ts']);
      expect(result.task.model).toBe('gpt-4');
    });

    it('should load .yml extension', async () => {
      const yamlContent = `
id: test-task
objective: Test objective
contextFiles:
  - src/**/*.ts
`;
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yamlContent);
      
      const result = await loadTask('test.yml');
      
      expect(result.task.id).toBe('test-task');
    });
  });

  describe('validation', () => {
    it('should throw error for missing file', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      await expect(loadTask('missing.json')).rejects.toThrow('Task file not found');
    });

    it('should throw error for unsupported file format', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      await expect(loadTask('test.txt')).rejects.toThrow('Unsupported file format: .txt');
    });

    it('should throw error for missing id field', async () => {
      const taskData = {
        objective: 'Test objective',
        contextFiles: ['src/**/*.ts']
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
      
      await expect(loadTask('test.json')).rejects.toThrow('Task file must contain an "id" field');
    });

    it('should throw error for missing objective field', async () => {
      const taskData = {
        id: 'test-task',
        contextFiles: ['src/**/*.ts']
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
      
      await expect(loadTask('test.json')).rejects.toThrow('Task file must contain an "objective" field');
    });

    it('should throw error for missing contextFiles field', async () => {
      const taskData = {
        id: 'test-task',
        objective: 'Test objective'
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
      
      await expect(loadTask('test.json')).rejects.toThrow('Task file must contain a "contextFiles" array');
    });

    it('should throw error for non-array contextFiles', async () => {
      const taskData = {
        id: 'test-task',
        objective: 'Test objective',
        contextFiles: 'not-an-array'
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
      
      await expect(loadTask('test.json')).rejects.toThrow('Task file must contain a "contextFiles" array');
    });
  });
});
