import { ConfigService } from '@nestjs/config';

export const mongooseConfig = async (configService: ConfigService) => {
  const uri = configService.get<string>('mongo.uri');
  const dbName = configService.get<string>('mongo.dbName');

  // Mask password in log for security
  const safeUri = uri?.replace(/:([^@]+)@/, ':****@');
  console.log(`[MongoDB] Connecting to: ${safeUri} | DB: ${dbName}`);

  return {
    uri,
    dbName,
    retryAttempts: 3,
    retryDelay: 1000,
  };
};
