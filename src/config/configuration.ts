export const configuration = () => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
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

    cache: {
        ttl: parseInt(process.env.CACHE_TTL || '900', 10), // 15 minutes in seconds
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
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
            'http://localhost:4000',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
        ],
    },

    features: {
        enableChat: process.env.ENABLE_CHAT === 'true',
        enablePayments: process.env.ENABLE_PAYMENTS === 'true',
    },

    logging: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    },

    media: {
        maxImageSizeMb: parseInt(process.env.MEDIA_MAX_IMAGE_SIZE_MB || '5', 10),
        maxDocumentSizeMb: parseInt(process.env.MEDIA_MAX_DOCUMENT_SIZE_MB || '10', 10),
        allowedImageTypes: process.env.MEDIA_ALLOWED_IMAGE_TYPES?.split(',') || [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
        ],
        allowedDocumentTypes: process.env.MEDIA_ALLOWED_DOCUMENT_TYPES?.split(',') || [
            'application/pdf',
        ],
        downloadUrlExpire: parseInt(process.env.MEDIA_DOWNLOAD_URL_EXPIRE || '900', 10),
    },

    auth: {
        bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    },

    mri: {
        clientId: process.env.CLIENT_ID || '',
        databaseName: process.env.DATABASE_NAME || '',
        userId: process.env.WEB_SERVICE_USER_ID || '',
        password: process.env.WEB_SERVICE_USER_PASSWORD || '',
        developerKey: process.env.DEVELOPER_API_KEY || '',
        apiUrl: process.env.MRI_API_URL || 'https://pmx7api.cloud.mrisoftware.com/mriapiservices/api.asp',
    },

    docAi: {
        projectId: process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID,
        location: process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us',
        processorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,
        credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    },
});
