import fs from "fs-extra";
import path from "node:path";
import { EventEmitter } from "node:events";

/**
 * Job-scoped logger that writes all job logs to {runPath}/job.log
 * This provides a single file per job that can be streamed to the UI.
 */
export class JobLogger extends EventEmitter {
  private logPath: string;
  private writeStream: fs.WriteStream | null = null;
  private buffer: string[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  constructor(runPath: string) {
    super();
    this.logPath = path.join(runPath, 'job.log');
    this.initialize();
  }

  private async initialize() {
    try {
      await fs.ensureDir(path.dirname(this.logPath));
      this.writeStream = fs.createWriteStream(this.logPath, { flags: 'a' });

      // Flush buffer every 200ms for more responsive updates
      this.flushInterval = setInterval(() => this.flush(), 200);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize job logger:', error);
    }
  }

  public log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };

    // Add to buffer
    this.buffer.push(JSON.stringify(logEntry) + '\n');

    // Emit for real-time streaming
    this.emit('log', logEntry);
  }

  public info(message: string, data?: any) {
    this.log('info', message, data);
  }

  public warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  public error(message: string, data?: any) {
    this.log('error', message, data);
  }

  public debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  private flush() {
    if (this.buffer.length === 0 || !this.writeStream) return;

    const toWrite = this.buffer.splice(0);
    for (const entry of toWrite) {
      this.writeStream.write(entry);
    }
  }

  public async close() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    this.flush();

    if (this.writeStream) {
      await new Promise<void>((resolve) => {
        this.writeStream!.end(resolve);
      });
      this.writeStream = null;
    }

    this.removeAllListeners();
  }

  public getLogPath(): string {
    return this.logPath;
  }
}

// Global registry of active job loggers
const activeJobLoggers = new Map<string, JobLogger>();

export function createJobLogger(runPath: string): JobLogger {
  // Reuse existing logger if available
  if (activeJobLoggers.has(runPath)) {
    return activeJobLoggers.get(runPath)!;
  }

  const jobLogger = new JobLogger(runPath);
  activeJobLoggers.set(runPath, jobLogger);

  // Auto-cleanup after 1 hour
  setTimeout(() => {
    if (activeJobLoggers.has(runPath)) {
      jobLogger.close();
      activeJobLoggers.delete(runPath);
    }
  }, 60 * 60 * 1000);

  return jobLogger;
}

export function getJobLogger(runPath: string): JobLogger | null {
  return activeJobLoggers.get(runPath) || null;
}

export async function readJobLogs(runPath: string, options?: { offset?: number; limit?: number }): Promise<{
  logs: any[];
  nextOffset: number;
  totalSize: number;
}> {
  const logPath = path.join(runPath, 'job.log');

  try {
    if (!await fs.pathExists(logPath)) {
      return { logs: [], nextOffset: 0, totalSize: 0 };
    }

    const stats = await fs.stat(logPath);
    const content = await fs.readFile(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    const logs = [];
    for (let i = offset; i < Math.min(lines.length, offset + limit); i++) {
      try {
        logs.push(JSON.parse(lines[i]));
      } catch {
        logs.push({ timestamp: new Date().toISOString(), level: 'info', message: lines[i] });
      }
    }

    return {
      logs,
      nextOffset: Math.min(offset + limit, lines.length),
      totalSize: stats.size
    };
  } catch (error) {
    return { logs: [], nextOffset: 0, totalSize: 0 };
  }
}

export async function closeJobLogger(runPath: string): Promise<void> {
  const logger = activeJobLoggers.get(runPath);
  if (logger) {
    await logger.close();
    activeJobLoggers.delete(runPath);
  }
}
