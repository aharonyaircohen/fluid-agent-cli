# Fluid-Agent-CLI Build Specification

This document is a complete execution prompt for the Engineer Agent.
Its purpose: **build the `fluid-agent-cli` package from scratch**, including:

* CLI interface
* JSON + YAML task loading
* Integration with the existing `fluid-agents` runtime
* Build system
* Executable binary

Follow all requirements exactly.

---

## 1. Project Identity

**Package name:** `@digital-fluid/fluid-agent-cli`
**Binary command:** `fluid-agent`
**Language:** TypeScript
**Runtime:** Node.js (ESM or CommonJS acceptable, but must be consistent)
**Build:** `tsc`

The CLI depends on the existing package:

* `@digital-fluid/fluid-agents`

---

## 2. Required Features

The CLI must implement:

### 2.1 Load task definitions from JSON or YAML

* Supported formats: `.json`, `.yaml`, `.yml`
* YAML parser: `yaml`
* Automatically detect format by extension
* Validate structure against `RuntimeTask` minimal fields

### 2.2 Commands

Build only **one command in V1**:

#### `fluid-agent run <taskFile>`

Runs a task against a codebase.

**Options:**

* `--root <path>`: project root directory (default: `process.cwd()`)
* `--write`: apply changes (default: dry-run mode)
* `--no-trace`: suppress TRACE output
* `--model <name>`: override model (optional)

**Responsibilities:**

1. Load & parse task file
2. Assemble `RuntimeTask`
3. Instantiate default LLM client from `fluid-agents`
4. Call `runTask()`
5. Print:

   * TRACE events (unless `--no-trace`)
   * SUMMARY
   * RAW model output

### 2.3 Logging

Use simple console logging (no external logger).

### 2.4 Error Handling

* Missing file → readable error
* Invalid YAML/JSON → readable error
* Invalid task → readable error
* Runtime errors → printed clearly, non-zero exit code

---

## 3. File Structure

Create the following structure:

```
src/
  cli/
    index.ts
    runCommand.ts
  loaders/
    loadTask.ts
  types/
    cliTypes.ts
package.json
tsconfig.json
README.md
```

---

## 4. Implementation Details

### 4.1 `src/cli/index.ts`

* Use Commander
* Register command(s)
* Export `main()`
* Add Node shebang

### 4.2 `src/cli/runCommand.ts`

Implements `run` command with:

* task loading
* runtime invocation
* trace printing
* summary printing

### 4.3 `src/loaders/loadTask.ts`

* Detect extension
* Load with `fs.readFile`
* Parse JSON or YAML accordingly
* Return raw object
* Validate required fields (`id`, `objective`, `contextFiles` at minimum)

---

## 5. Bin Configuration

In `package.json`:

```json
"bin": {
  "fluid-agent": "./dist/cli/index.js"
}
```

---

## 6. Build Configuration

`tsconfig.json` requirements:

* outDir: `dist`
* include CLI folder
* declarations enabled

---

## 7. Dependencies

Install:

* commander
* yaml
* @digital-fluid/fluid-agents

Dev Dependencies:

* typescript
* tsx (optional for dev)

---

## 8. CLI Output Format

### TRACE Section

Print each event exactly:

```
[2024-01-01T12:00:00.000Z] [load_context] Loading context | meta: {...}
```

### SUMMARY Section

```
=== SUMMARY ===
{ ...JSON... }
```

### RAW MODEL OUTPUT

If exists:

```
=== RAW MODEL OUTPUT (last) ===
<text>
```

---

## 9. Acceptance Criteria

The CLI must:

* Build successfully with `npm run build`
* Execute with `npx fluid-agent run example.json`
* Load JSON and YAML correctly
* Produce TRACE output unless suppressed
* Work in dry-run and write modes
* Apply changes to project when `--write` used

---

## 10. Engineer Agent Instructions

Perform the following:

1. Create the entire folder structure
2. Implement **all** files defined above
3. Implement JSON + YAML task loading
4. Implement CLI command
5. Connect to `fluid-agents` runtime
6. Add bin entry in `package.json`
7. Add build scripts
8. Generate README.md explaining installation and usage
9. Ensure TypeScript builds cleanly
10. Provide tests for the task loader (JSON + YAML)

When done, run:

* `npm install`
* `npm run build`
* Provide final diff and summary

---

## 11. End of Spec

Engineer Agent must execute the entire spec deterministically.
