import fs from "fs-extra";
import path from "node:path";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: 'logManager' });

export class LogManager {
  static readonly MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
  static readonly TRUNCATION_MARKER = "\n\n--- [LOG TRUNCATED] ---\n\n";
  
  static async truncateLog(logPath: string): Promise<void> {
    try {
      const stats = await fs.stat(logPath);
      
      if (stats.size <= this.MAX_LOG_SIZE) {
        return; // No truncation needed
      }
      
      log.info('Truncating large log file', { 
        logPath, 
        currentSize: stats.size, 
        maxSize: this.MAX_LOG_SIZE 
      });
      
      // Read the last portion of the file
      const fd = await fs.open(logPath, 'r');
      const keepSize = this.MAX_LOG_SIZE - this.TRUNCATION_MARKER.length;
      const buffer = Buffer.alloc(keepSize);
      
      // Read from the end of the file
      await fs.read(fd, buffer, 0, keepSize, stats.size - keepSize);
      await fs.close(fd);
      
      // Find the first complete line to avoid cutting mid-line
      const content = buffer.toString('utf8');
      const firstNewline = content.indexOf('\n');
      const truncatedContent = firstNewline !== -1 ? content.substring(firstNewline + 1) : content;
      
      // Write truncated log with marker
      const newContent = this.TRUNCATION_MARKER + truncatedContent;
      await fs.writeFile(logPath, newContent, 'utf8');
      
      log.info('Log truncation completed', { 
        logPath, 
        newSize: newContent.length,
        linesTruncated: content.substring(0, firstNewline).split('\n').length
      });
      
    } catch (error) {
      log.error('Failed to truncate log', { logPath, error: String(error) });
    }
  }
  
  static async getTailLines(logPath: string, lineCount: number = 100): Promise<string[]> {
    try {
      if (!(await fs.pathExists(logPath))) {
        return [];
      }
      
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.split('\n');
      
      // Return last N lines, filtering empty lines
      return lines
        .slice(-lineCount)
        .filter(line => line.trim().length > 0);
        
    } catch (error) {
      log.error('Failed to read log tail', { logPath, error: String(error) });
      return [];
    }
  }
  
  static async appendToLog(logPath: string, content: string): Promise<void> {
    try {
      await fs.ensureFile(logPath);
      await fs.appendFile(logPath, content + '\n', 'utf8');
      
      // Check if truncation is needed after append
      await this.truncateLog(logPath);
      
    } catch (error) {
      log.error('Failed to append to log', { logPath, error: String(error) });
    }
  }
  
  static async cleanupOldRuns(runsDir: string, keepDays: number = 30): Promise<void> {
    try {
      const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
      
      const entries = await fs.readdir(runsDir, { withFileTypes: true });
      let removed = 0;
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const runPath = path.join(runsDir, entry.name);
          const stats = await fs.stat(runPath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.remove(runPath);
            removed++;
            log.info('Removed old run directory', { runPath, age: keepDays });
          }
        }
      }
      
      if (removed > 0) {
        log.info('Cleanup completed', { runsDir, removedCount: removed, keepDays });
      }
      
    } catch (error) {
      log.error('Failed to cleanup old runs', { runsDir, error: String(error) });
    }
  }
  
  static async getLogSummary(runPath: string): Promise<{
    files: Array<{ name: string; size: number; lines: number; }>;
    totalSize: number;
    hasErrors: boolean;
  }> {
    const summary = {
      files: [] as Array<{ name: string; size: number; lines: number; }>,
      totalSize: 0,
      hasErrors: false
    };
    
    try {
      const logFiles = ['execute.log', 'cli.log', 'error.log'];
      
      for (const fileName of logFiles) {
        const logPath = path.join(runPath, fileName);
        
        if (await fs.pathExists(logPath)) {
          const stats = await fs.stat(logPath);
          const content = await fs.readFile(logPath, 'utf8');
          const lines = content.split('\n').length;
          
          summary.files.push({
            name: fileName,
            size: stats.size,
            lines
          });
          
          summary.totalSize += stats.size;
          
          // Check for errors in log content
          if (content.toLowerCase().includes('error') || content.toLowerCase().includes('failed')) {
            summary.hasErrors = true;
          }
        }
      }
      
    } catch (error) {
      log.error('Failed to generate log summary', { runPath, error: String(error) });
    }
    
    return summary;
  }
}
