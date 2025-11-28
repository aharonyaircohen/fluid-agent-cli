import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { loadTask } from '../loaders/loadTask.js';

const testDir = 'test-temp';

test('loadTask - JSON format', async () => {
  await mkdir(testDir, { recursive: true });
  const testFile = join(testDir, 'test.json');
  const taskData = {
    id: 'test-task',
    objective: 'Test objective',
    contextFiles: ['src/**/*.ts']
  };
  
  await writeFile(testFile, JSON.stringify(taskData, null, 2));
  
  try {
    const result = await loadTask(testFile);
    assert.equal(result.task.id, 'test-task');
    assert.equal(result.task.objective, 'Test objective');
    assert.deepEqual(result.task.contextFiles, ['src/**/*.ts']);
    assert.equal(result.filePath, testFile);
  } finally {
    await unlink(testFile);
  }
});

test('loadTask - YAML format', async () => {
  await mkdir(testDir, { recursive: true });
  const testFile = join(testDir, 'test.yaml');
  const yamlContent = `
id: test-task
objective: Test objective
contextFiles:
  - "src/**/*.ts"
  - "package.json"
`;
  
  await writeFile(testFile, yamlContent);
  
  try {
    const result = await loadTask(testFile);
    assert.equal(result.task.id, 'test-task');
    assert.equal(result.task.objective, 'Test objective');
    assert.deepEqual(result.task.contextFiles, ['src/**/*.ts', 'package.json']);
  } finally {
    await unlink(testFile);
  }
});

test('loadTask - missing required fields', async () => {
  await mkdir(testDir, { recursive: true });
  const testFile = join(testDir, 'invalid.json');
  const invalidData = {
    id: 'test-task'
    // missing objective and contextFiles
  };
  
  await writeFile(testFile, JSON.stringify(invalidData));
  
  try {
    await assert.rejects(
      () => loadTask(testFile),
      /Missing required field 'objective'/
    );
  } finally {
    await unlink(testFile);
  }
});

test('loadTask - file not found', async () => {
  await assert.rejects(
    () => loadTask('nonexistent.json'),
    /Task file not found/
  );
});

test('loadTask - invalid JSON', async () => {
  await mkdir(testDir, { recursive: true });
  const testFile = join(testDir, 'invalid.json');
  
  await writeFile(testFile, '{ invalid json }');
  
  try {
    await assert.rejects(
      () => loadTask(testFile),
      /Invalid JSON/
    );
  } finally {
    await unlink(testFile);
  }
});

test('loadTask - unsupported format', async () => {
  await mkdir(testDir, { recursive: true });
  const testFile = join(testDir, 'test.txt');
  
  await writeFile(testFile, 'some content');
  
  try {
    await assert.rejects(
      () => loadTask(testFile),
      /Unsupported file format/
    );
  } finally {
    await unlink(testFile);
  }
});
