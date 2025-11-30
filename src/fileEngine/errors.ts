export class FileEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileEngineError';
  }
}

export class InvalidPathError extends FileEngineError {
  constructor(message = 'File path is invalid or out of project root') {
    super(message);
    this.name = 'InvalidPathError';
  }
}

export class FileSystemOperationError extends FileEngineError {
  constructor(message: string) {
    super(message);
    this.name = 'FileSystemOperationError';
  }
}
