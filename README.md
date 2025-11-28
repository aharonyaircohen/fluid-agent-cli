# @digital-fluid/fluid-agent-cli

CLI interface for the fluid-agent runtime. Execute AI-powered code modification tasks from JSON or YAML task definitions.

## Installation

```bash
npm install -g @digital-fluid/fluid-agent-cli
```

Or use with npx:

```bash
npx @digital-fluid/fluid-agent-cli run task.json
```

## Usage

### Run Command

Execute a task against a codebase:

```bash
fluid-agent run <taskFile> [options]
```

**Arguments:**
- `<taskFile>` - Path to task file (JSON or YAML format)

**Options:**
- `-r, --root <path>` - Project root directory (default: current directory)
- `-w, --write` - Apply changes to files (default: dry-run mode)
- `--no-trace` - Suppress TRACE output during execution
- `-m, --model <name>` - Override the model specified in task file

### Examples

```bash
# Dry-run mode (default)
fluid-agent run my-task.json

# Apply changes to files
fluid-agent run my-task.json --write

# Specify different root directory
fluid-agent run my-task.yaml --root /path/to/project

# Suppress trace output
fluid-agent run my-task.json --no-trace

# Override model
fluid-agent run my-task.json --model gpt-4
```

## Task File Format

Task files can be in JSON or YAML format. The CLI automatically detects the format based on file extension (`.json`, `.yaml`, `.yml`).

### Required Fields

- `id` - Unique identifier for the task
- `objective` - Description of what the task should accomplish
- `contextFiles` - Array of file paths to include as context

### Optional Fields

- `model` - AI model to use (can be overridden with `--model`)
- `maxTokens` - Maximum tokens for model response
- `temperature` - Model temperature setting

### Example JSON Task

```json
{
  "id": "add-logging",
  "objective": "Add comprehensive logging to all API endpoints",
  "contextFiles": [
    "src/api/**/*.ts",
    "src/types/api.ts"
  ],
  "model": "gpt-4",
  "maxTokens": 4000,
  "temperature": 0.1
}
```

### Example YAML Task

```yaml
id: add-logging
objective: Add comprehensive logging to all API endpoints
contextFiles:
  - src/api/**/*.ts
  - src/types/api.ts
model: gpt-4
maxTokens: 4000
temperature: 0.1
```

## Output Format

The CLI provides structured output in three sections:

### 1. TRACE Events (unless --no-trace)

Real-time execution events:
```
[2024-01-01T12:00:00.000Z] [load_context] Loading context | meta: {...}
[2024-01-01T12:00:01.000Z] [model_request] Sending request to model
```

### 2. SUMMARY

JSON summary of execution results:
```json
{
  "taskId": "add-logging",
  "success": true,
  "filesModified": 3,
  "filesCreated": 1,
  "filesDeleted": 0,
  "executionTime": 15.2
}
```

### 3. RAW MODEL OUTPUT

The final model response (if available):
```
=== RAW MODEL OUTPUT (last) ===
{
  "files": [
    {
      "path": "src/api/users.ts",
      "action": "update",
      "content": "..."
    }
  ]
}
```

## Error Handling

The CLI provides clear error messages for common issues:

- **Missing task file**: File not found errors with full path
- **Invalid JSON/YAML**: Parse errors with line/column information
- **Missing required fields**: Validation errors specifying missing fields
- **Runtime errors**: Execution errors with context

All errors result in a non-zero exit code for script integration.

## Development

### Building from Source

```bash
git clone <repository>
cd fluid-agent-cli
npm install
npm run build
```

### Development Mode

```bash
npm run dev -- run example.json
```

## License

MIT
