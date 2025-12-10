export const configuration = () => ({
  port: parseInt(process.env.PORT || '4000', 10),

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGO_DB_NAME || 'default-db',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '3600s',
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!,
    bucket: process.env.AWS_S3_BUCKET!,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  mail: {
    host: process.env.MAIL_HOST!,
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    user: process.env.MAIL_USER!,
    pass: process.env.MAIL_PASS!,
    defaultFrom: process.env.MAIL_FROM || 'no-reply@example.com',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || 'aws',
    localPath: process.env.LOCAL_STORAGE_PATH || 'uploads/',
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  features: {
    enableChat: process.env.ENABLE_CHAT === 'true',
    enablePayments: process.env.ENABLE_PAYMENTS === 'true',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  media: {
    maxFileSizeMb: parseInt(process.env.MEDIA_MAX_FILE_SIZE_MB || '5', 10),
    allowedTypes: process.env.MEDIA_ALLOWED_IMAGE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
  },
});
