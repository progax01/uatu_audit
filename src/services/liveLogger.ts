import fs from "fs-extra";
import path from "node:path";
import { EventEmitter } from "node:events";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: 'liveLogger' });

export class LiveLogger extends EventEmitter {
  private logPath: string;
  private writeStream: fs.WriteStream | null = null;
  private buffer: string[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(logPath: string) {
    super();
    this.logPath = logPath;
    this.initialize();
  }

  private async initialize() {
    try {
      await fs.ensureDir(path.dirname(this.logPath));
      this.writeStream = fs.createWriteStream(this.logPath, { flags: 'a' });
      
      // Flush buffer every 500ms
      this.flushInterval = setInterval(() => this.flush(), 500);
      
      log.info('Live logger initialized', { logPath: this.logPath });
    } catch (error) {
      log.error('Failed to initialize live logger', { error: String(error) });
    }
  }

  public log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    // Add to buffer
    this.buffer.push(JSON.stringify(logEntry) + '\n');
    
    // Emit for real-time streaming
    this.emit('log', logEntry);
    
    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
    }
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
}

// Global live logger registry
const activeLiveLoggers = new Map<string, LiveLogger>();

export function createLiveLogger(runPath: string, logType: 'execute' | 'cli' | 'analysis' = 'execute'): LiveLogger {
  const logPath = path.join(runPath, `${logType}.log`);
  const key = `${runPath}:${logType}`;
  
  // Reuse existing logger if available
  if (activeLiveLoggers.has(key)) {
    return activeLiveLoggers.get(key)!;
  }
  
  const liveLogger = new LiveLogger(logPath);
  activeLiveLoggers.set(key, liveLogger);
  
  // Auto-cleanup after 1 hour of inactivity
  setTimeout(() => {
    if (activeLiveLoggers.has(key)) {
      liveLogger.close();
      activeLiveLoggers.delete(key);
    }
  }, 60 * 60 * 1000);
  
  return liveLogger;
}

export function getLiveLogger(runPath: string, logType: 'execute' | 'cli' | 'analysis' = 'execute'): LiveLogger | null {
  const key = `${runPath}:${logType}`;
  return activeLiveLoggers.get(key) || null;
}

export async function streamLogs(runPath: string, logType: 'execute' | 'cli' | 'analysis', callback: (entry: any) => void) {
  const logPath = path.join(runPath, `${logType}.log`);
  
  try {
    // Read existing logs first
    if (await fs.pathExists(logPath)) {
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          callback(entry);
        } catch {
          // Skip malformed lines
          callback({ timestamp: new Date().toISOString(), level: 'info', message: line });
        }
      }
    }
    
    // Set up live streaming
    const liveLogger = getLiveLogger(runPath, logType);
    if (liveLogger) {
      liveLogger.on('log', callback);
      
      return () => {
        liveLogger.off('log', callback);
      };
    }
  } catch (error) {
    log.error('Failed to stream logs', { logPath, error: String(error) });
  }
  
  return () => {}; // No-op cleanup
}
