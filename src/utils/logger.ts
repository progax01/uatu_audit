import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.UATU_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'uatu-audit' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    // Console transport with JSON format for logs visibility
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
        })
      )
    })
  ]
});

// Add jobId, project, branch context to logs
export function createJobLogger(jobId?: number, project?: string, branch?: string) {
  return logger.child({ 
    jobId, 
    project, 
    branch,
    pid: process.pid 
  });
}
