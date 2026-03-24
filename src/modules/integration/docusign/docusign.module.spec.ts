import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DocuSignModule } from './docusign.module';
import { DocuSignService } from './docusign.service';
import { LeasingModule } from '../../leasing/leasing.module';
import { MediaModule } from '../../media/media.module';

describe('DocuSignModule', () => {
  let module: TestingModule;
  let docuSignService: DocuSignService;
  let configService: ConfigService;

  beforeEach(async () => {
    // Set up test environment variables
    process.env.DOCUSIGN_INTEGRATION_KEY = 'test-integration-key';
    process.env.DOCUSIGN_USER_ID = 'test-user-id';
    process.env.DOCUSIGN_ACCOUNT_ID = 'test-account-id';
    process.env.DOCUSIGN_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----';
    process.env.DOCUSIGN_BASE_PATH = 'https://demo.docusign.net/restapi';
    process.env.DOCUSIGN_WEBHOOK_SECRET = 'test-webhook-secret';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        HttpModule,
        DocuSignModule,
        LeasingModule,
        MediaModule,
      ],
    }).compile();

    docuSignService = module.get<DocuSignService>(DocuSignService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Module Wiring', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should export DocuSignService', () => {
      expect(docuSignService).toBeDefined();
      expect(docuSignService).toBeInstanceOf(DocuSignService);
    });

    it('should inject ConfigService into DocuSignService', () => {
      expect(configService).toBeDefined();
      expect(configService.get('DOCUSIGN_INTEGRATION_KEY')).toBe('test-integration-key');
    });

    it('should have all required dependencies injected', () => {
      // Verify DocuSignService has access to its dependencies
      expect(docuSignService).toHaveProperty('configService');
      expect(docuSignService).toHaveProperty('httpService');
      expect(docuSignService).toHaveProperty('leaseRepository');
      expect(docuSignService).toHaveProperty('mediaService');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate all required environment variables on module init', () => {
      // This test verifies that the module initializes successfully with all required env vars
      expect(configService.get('DOCUSIGN_INTEGRATION_KEY')).toBeDefined();
      expect(configService.get('DOCUSIGN_USER_ID')).toBeDefined();
      expect(configService.get('DOCUSIGN_ACCOUNT_ID')).toBeDefined();
      expect(configService.get('DOCUSIGN_PRIVATE_KEY')).toBeDefined();
      expect(configService.get('DOCUSIGN_BASE_PATH')).toBeDefined();
      expect(configService.get('DOCUSIGN_WEBHOOK_SECRET')).toBeDefined();
    });

    it('should have correct configuration values', () => {
      expect(configService.get('DOCUSIGN_INTEGRATION_KEY')).toBe('test-integration-key');
      expect(configService.get('DOCUSIGN_USER_ID')).toBe('test-user-id');
      expect(configService.get('DOCUSIGN_ACCOUNT_ID')).toBe('test-account-id');
      expect(configService.get('DOCUSIGN_BASE_PATH')).toBe('https://demo.docusign.net/restapi');
      expect(configService.get('DOCUSIGN_WEBHOOK_SECRET')).toBe('test-webhook-secret');
    });

    it('should use demo environment for testing', () => {
      const basePath = configService.get('DOCUSIGN_BASE_PATH');
      expect(basePath).toContain('demo.docusign.net');
    });
  });

  describe('Service Methods', () => {
    it('should have createEnvelope method', () => {
      expect(docuSignService.createEnvelope).toBeDefined();
      expect(typeof docuSignService.createEnvelope).toBe('function');
    });

    it('should have getEnvelopeStatus method', () => {
      expect(docuSignService.getEnvelopeStatus).toBeDefined();
      expect(typeof docuSignService.getEnvelopeStatus).toBe('function');
    });

    it('should have downloadDocument method', () => {
      expect(docuSignService.downloadDocument).toBeDefined();
      expect(typeof docuSignService.downloadDocument).toBe('function');
    });

    it('should have validateWebhook method', () => {
      expect(docuSignService.validateWebhook).toBeDefined();
      expect(typeof docuSignService.validateWebhook).toBe('function');
    });
  });

  describe('Module Exports', () => {
    it('should export DocuSignService for use in other modules', () => {
      const exportedService = module.get<DocuSignService>(DocuSignService);
      expect(exportedService).toBe(docuSignService);
    });

    it('should be importable by other modules', () => {
      expect(module).toBeDefined();
      expect(docuSignService).toBeDefined();
    });
  });
});
