import { ConfigService } from '@nestjs/config';

export const mongooseConfig = async (configService: ConfigService) => ({
  uri: configService.get<string>('mongo.uri'),
  dbName: configService.get<string>('mongo.dbName'),
  retryAttempts: 3,
  retryDelay: 1000,
});
