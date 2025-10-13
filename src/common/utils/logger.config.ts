import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

// Determine log level dynamically based on environment
const logLevel =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Common log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
);

export const winstonConfig = {
  level: logLevel,
  transports: [
    // 🧭 Console Transport (for local + debugging)
    new winston.transports.Console({
      level: logLevel,
      format: winston.format.combine(
        logFormat,
        nestWinstonModuleUtilities.format.nestLike('VirtualEventPlatform', {
          colors: process.env.NODE_ENV !== 'production',
          prettyPrint: process.env.NODE_ENV !== 'production',
        }),
      ),
    }),

    // 📄 File transport for errors (always enabled)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(logFormat, winston.format.json()),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),

    // 📘 File transport for all logs (production safe)
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(logFormat, winston.format.json()),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      format: winston.format.combine(logFormat, winston.format.json()),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      format: winston.format.combine(logFormat, winston.format.json()),
    }),
  ],
};
