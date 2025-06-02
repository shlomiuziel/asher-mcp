import { createWriteStream, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { format } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOGS_DIR = join(__dirname, '../../logs');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_LOG_FILES = 5;

// Ensure logs directory exists
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

class RollingFileLogger {
  private stream: ReturnType<typeof createWriteStream> | null = null;
  private currentDate: string;
  private fileIndex = 0;
  private filePath: string;

  constructor() {
    this.currentDate = new Date().toISOString().split('T')[0];
    this.filePath = this.getLogFilePath();
    this.ensureStream();
  }

  private getLogFilePath(): string {
    return join(LOGS_DIR, `mcp-${this.currentDate}-${this.fileIndex}.log`);
  }

  private ensureStream() {
    if (!this.stream) {
      this.stream = createWriteStream(this.filePath, { flags: 'a' });
      this.stream.on('error', (err) => {
        console.error('Logging error:', err);
        this.stream = null;
      });
    }
  }

  private rotateIfNeeded() {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we need to rotate due to date change
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.fileIndex = 0;
      this.filePath = this.getLogFilePath();
      this.closeStream();
      this.ensureStream();
      return;
    }

    // Check if we need to rotate due to file size
    try {
      const stats = statSync(this.filePath);
      if (stats.size > MAX_LOG_SIZE) {
        this.fileIndex++;
        this.filePath = this.getLogFilePath();
        this.closeStream();
        this.cleanupOldLogs();
        this.ensureStream();
      }
    } catch (err) {
      // File doesn't exist or other error, stream will be created on next write
      this.ensureStream();
    }
  }

  private cleanupOldLogs() {
    try {
      const files = require('fs').readdirSync(LOGS_DIR)
        .filter((file: string) => file.startsWith('mcp-') && file.endsWith('.log'))
        .map((file: string) => ({
          name: file,
          time: statSync(join(LOGS_DIR, file)).mtime.getTime()
        }))
        .sort((a: { time: number }, b: { time: number }) => b.time - a.time);

      // Keep only the most recent MAX_LOG_FILES files
      files.slice(MAX_LOG_FILES).forEach((file: { name: string }) => {
        try {
          require('fs').unlinkSync(join(LOGS_DIR, file.name));
        } catch (err) {
          console.error('Error deleting old log file:', err);
        }
      });
    } catch (err) {
      console.error('Error cleaning up old logs:', err);
    }
  }

  private closeStream() {
    if (this.stream) {
      try {
        this.stream.end();
      } catch (err) {
        console.error('Error closing log stream:', err);
      }
      this.stream = null;
    }
  }

  write(level: string, message: string, ...args: any[]) {
    this.rotateIfNeeded();
    
    const timestamp = new Date().toISOString();
    const formattedMessage = format(message, ...args);
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${formattedMessage}\n`;
    
    if (this.stream) {
      this.stream.write(logLine);
    } else {
      // Fallback to console if stream is not available
      process.stderr.write(logLine);
    }
  }
}

const logger = new RollingFileLogger();

// Configuration
const config = {
  enableConsoleOutput: true
};

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

// Create console methods that conditionally write to console and always to log file
const consoleMethods = {
  log: (message: string, ...args: any[]) => {
    if (config.enableConsoleOutput) {
      originalConsole.log(message, ...args);
    }
    logger.write('info', message, ...args);
  },
  info: (message: string, ...args: any[]) => {
    if (config.enableConsoleOutput) {
      originalConsole.info(message, ...args);
    }
    logger.write('info', message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    if (config.enableConsoleOutput) {
      originalConsole.warn(message, ...args);
    }
    logger.write('warn', message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    if (config.enableConsoleOutput) {
      originalConsole.error(message, ...args);
    }
    logger.write('error', message, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (config.enableConsoleOutput) {
      originalConsole.debug(message, ...args);
    }
    logger.write('debug', message, ...args);
  },
};

// Function to configure the logger
export function configureLogger(options: { enableConsoleOutput?: boolean }) {
  if (options.enableConsoleOutput !== undefined) {
    config.enableConsoleOutput = options.enableConsoleOutput;
  }
}

// Override console methods
for (const [method, impl] of Object.entries(consoleMethods)) {
  // @ts-ignore - We know these methods exist on console
  console[method] = impl;
}

export { logger, consoleMethods };
