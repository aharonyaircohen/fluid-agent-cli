import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadTask } from './loadTask.js';

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  
  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }
  
  async run() {
    console.log(`Running ${this.tests.length} tests...\n`);
    
    let passed = 0;
    let failed = 0;
    
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✓ ${test.name}`);
        passed++;
      } catch (error) {
        console.log(`✗ ${test.name}`);
        console.log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
      }
    }
    
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    return failed === 0;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn: () => any, expectedMessage?: string) {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (expectedMessage && error instanceof Error && !error.message.includes(expectedMessage)) {
      throw new Error(`Expected error message to contain "${expectedMessage}", got "${error.message}"`);
    }
  }
}

const runner = new TestRunner();

// Test JSON loading
runner.test('loads valid JSON task file', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const taskFile = path.join(tempDir, 'task.json');
  
  const taskData = {
    id: 'test-task',
    objective: 'Test objective',
    contextFiles: ['file1.ts', 'file2.ts'],
    model: 'gpt-4'
  };
  
  fs.writeFileSync(taskFile, JSON.stringify(taskData, null, 2));
  
  const result = await loadTask(taskFile);
  
  assertEquals(result.data.id, 'test-task');
  assertEquals(result.data.objective, 'Test objective');
  assert(Array.isArray(result.data.contextFiles), 'contextFiles should be array');
  assertEquals(result.data.contextFiles.length, 2);
  assertEquals(result.data.model, 'gpt-4');
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

// Test YAML loading
runner.test('loads valid YAML task file', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const taskFile = path.join(tempDir, 'task.yaml');
  
  const yamlContent = `
id: test-task
objective: Test objective
contextFiles:
  - file1.ts
  - file2.ts
model: gpt-4
`;
  
  fs.writeFileSync(taskFile, yamlContent);
  
  const result = await loadTask(taskFile);
  
  assertEquals(result.data.id, 'test-task');
  assertEquals(result.data.objective, 'Test objective');
  assert(Array.isArray(result.data.contextFiles), 'contextFiles should be array');
  assertEquals(result.data.contextFiles.length, 2);
  assertEquals(result.data.model, 'gpt-4');
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

// Test .yml extension
runner.test('loads .yml extension', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const taskFile = path.join(tempDir, 'task.yml');
  
  const yamlContent = `
id: test-task
objective: Test objective
contextFiles:
  - file1.ts
`;
  
  fs.writeFileSync(taskFile, yamlContent);
  
  const result = await loadTask(taskFile);
  
  assertEquals(result.data.id, 'test-task');
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

// Test missing file
runner.test('throws error for missing file', async () => {
  try {
    await loadTask('/nonexistent/file.json');
    throw new Error('Should have thrown');
  } catch (error) {
    assert(error instanceof Error, 'Should throw Error');
    assert(error.message.includes('not found'), 'Should mention file not found');
  }
});

// Test invalid JSON
runner.test('throws error for invalid JSON', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const taskFile = path.join(tempDir, 'task.json');
  
  fs.writeFileSync(taskFile, '{ invalid json }');
  
  try {
    await loadTask(taskFile);
    throw new Error('Should have thrown');
  } catch (error) {
    assert(error instanceof Error, 'Should throw Error');
    assert(error.message.includes('Failed to parse'), 'Should mention parse failure');
  }
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

// Test missing required fields
runner.test('throws error for missing required fields', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const taskFile = path.join(tempDir, 'task.json');
  
  // Missing 'objective' field
  const taskData = {
    id: 'test-task',
    contextFiles: ['file1.ts']
  };
  
  fs.writeFileSync(taskFile, JSON.stringify(taskData));
  
  try {
    await loadTask(taskFile);
    throw new Error('Should have thrown');
  } catch (error) {
    assert(error instanceof Error, 'Should throw Error');
    assert(error.message.includes('Missing required field: objective'), 'Should mention missing objective');
  }
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

// Test unsupported file format
runner.test('throws error for unsupported file format', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const taskFile = path.join(tempDir, 'task.txt');
  
  fs.writeFileSync(taskFile, 'some content');
  
  try {
    await loadTask(taskFile);
    throw new Error('Should have thrown');
  } catch (error) {
    assert(error instanceof Error, 'Should throw Error');
    assert(error.message.includes('Unsupported file format'), 'Should mention unsupported format');
  }
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

// Run tests if this file is executed directly
if (require.main === module) {
  runner.run().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

export { runner };
