import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import { ConfigService } from '@nestjs/config';

export const winstonConfig = (configService: ConfigService) => {
  const logLevel = configService.get<string>('logging.level');
  const isProduction = configService.get<boolean>('isProduction');

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
  );

  return {
    level: logLevel,
    transports: [
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(
          logFormat,
          nestWinstonModuleUtilities.format.nestLike('VirtualEventPlatform', {
            colors: !isProduction,
            prettyPrint: !isProduction,
          }),
        ),
      }),

      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(logFormat, winston.format.json()),
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),

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
};
