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

    it('should throw error when required environment variables are missing', async () => {
      // Clear environment variables
      delete process.env.DOCUSIGN_INTEGRATION_KEY;

      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({ isGlobal: true }),
            HttpModule,
            DocuSignModule,
            LeasingModule,
            MediaModule,
          ],
        }).compile(),
      ).rejects.toThrow(/Missing required DocuSign environment variables/);

      // Restore for other tests
      process.env.DOCUSIGN_INTEGRATION_KEY = 'test-integration-key';
    });
  });
});
