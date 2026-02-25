import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { DocuSignService } from './docusign.service';
import { LeaseRepository } from '../../leasing/repository/lease.repository';
import { MediaService } from '../../media/media.service';
import * as fc from 'fast-check';
import * as crypto from 'crypto';
import { of } from 'rxjs';

describe('DocuSignService', () => {
  let service: DocuSignService;
  let configService: ConfigService;
  let httpService: HttpService;
  let leaseRepository: LeaseRepository;
  let mediaService: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocuSignService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: LeaseRepository,
          useValue: {
            findByEnvelopeId: jest.fn(),
            updateSignedDocument: jest.fn(),
          },
        },
        {
          provide: MediaService,
          useValue: {
            uploadFile: jest.fn(),
            getFileBuffer: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocuSignService>(DocuSignService);
    configService = module.get<ConfigService>(ConfigService);
    httpService = module.get<HttpService>(HttpService);
    leaseRepository = module.get<LeaseRepository>(LeaseRepository);
    mediaService = module.get<MediaService>(MediaService);
  });

  describe('Property 1: JWT Token Generation', () => {
    // Feature: docusign-integration, Property 1: JWT Token Generation
    it('should generate properly formatted JWT assertion with correct header, payload, and valid RSA signature for any valid configuration', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }), // integrationKey
          fc.string({ minLength: 10, maxLength: 50 }), // userId
          fc.constantFrom('https://demo.docusign.net/restapi', 'https://na1.docusign.net/restapi'), // basePath
          (integrationKey, userId, basePath) => {
            // Generate a valid RSA key pair for testing
            const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
              modulusLength: 2048,
              publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
              },
              privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
              },
            });

            // Mock configuration
            jest.spyOn(configService, 'get').mockImplementation((key: string) => {
              const config: Record<string, string> = {
                DOCUSIGN_INTEGRATION_KEY: integrationKey,
                DOCUSIGN_USER_ID: userId,
                DOCUSIGN_PRIVATE_KEY: privateKey,
                DOCUSIGN_BASE_PATH: basePath,
              };
              return config[key];
            });

            // Access private method via reflection
            const jwtAssertion = (service as any).generateJwtAssertion();

            // Verify JWT structure (3 parts separated by dots)
            const parts = jwtAssertion.split('.');
            expect(parts).toHaveLength(3);

            // Decode and verify header
            const header = JSON.parse(
              Buffer.from(parts[0], 'base64url').toString(),
            );
            expect(header.alg).toBe('RS256');
            expect(header.typ).toBe('JWT');

            // Decode and verify payload
            const payload = JSON.parse(
              Buffer.from(parts[1], 'base64url').toString(),
            );
            expect(payload.iss).toBe(integrationKey);
            expect(payload.sub).toBe(userId);
            expect(payload.aud).toBe(
              basePath.includes('demo')
                ? 'account-d.docusign.com'
                : 'account.docusign.com',
            );
            expect(payload.scope).toBe('signature impersonation');
            expect(payload.iat).toBeDefined();
            expect(payload.exp).toBeDefined();
            expect(payload.exp - payload.iat).toBe(3600);

            // Verify signature is valid
            const signatureInput = `${parts[0]}.${parts[1]}`;
            const signature = Buffer.from(parts[2], 'base64url').toString('base64');
            
            const verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(signatureInput);
            const isValid = verifier.verify(publicKey, signature, 'base64');
            
            expect(isValid).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 2: Token Caching and Reuse', () => {
    // Feature: docusign-integration, Property 2: Token Caching and Reuse
    it('should cache and reuse access token until expiration minus 5 minutes without making additional authentication requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 20, maxLength: 100 }), // accessToken
          fc.integer({ min: 600, max: 7200 }), // expiresIn (10 minutes to 2 hours)
          async (accessToken, expiresIn) => {
            // Create a fresh service instance for each test iteration
            const testModule = await Test.createTestingModule({
              providers: [
                DocuSignService,
                {
                  provide: ConfigService,
                  useValue: {
                    get: jest.fn(),
                  },
                },
                {
                  provide: HttpService,
                  useValue: {
                    post: jest.fn(),
                  },
                },
                {
                  provide: LeaseRepository,
                  useValue: {
                    findByEnvelopeId: jest.fn(),
                    updateSignedDocument: jest.fn(),
                  },
                },
                {
                  provide: MediaService,
                  useValue: {
                    uploadFile: jest.fn(),
                    getFileBuffer: jest.fn(),
                  },
                },
              ],
            }).compile();

            const testService = testModule.get<DocuSignService>(DocuSignService);
            const testConfigService = testModule.get<ConfigService>(ConfigService);
            const testHttpService = testModule.get<HttpService>(HttpService);

            // Generate a valid RSA key pair for testing
            const { privateKey } = crypto.generateKeyPairSync('rsa', {
              modulusLength: 2048,
              privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
              },
            });

            // Mock configuration
            jest.spyOn(testConfigService, 'get').mockImplementation((key: string) => {
              const config: Record<string, string> = {
                DOCUSIGN_INTEGRATION_KEY: 'test-key',
                DOCUSIGN_USER_ID: 'test-user',
                DOCUSIGN_PRIVATE_KEY: privateKey,
                DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
              };
              return config[key];
            });

            // Mock HTTP response
            const mockPost = jest.fn().mockReturnValue(
              of({
                data: {
                  access_token: accessToken,
                  expires_in: expiresIn,
                },
              }),
            );
            jest.spyOn(testHttpService, 'post').mockImplementation(mockPost as any);

            // First call should make HTTP request
            const token1 = await testService.getAccessToken();
            expect(token1).toBe(accessToken);
            expect(mockPost).toHaveBeenCalledTimes(1);

            // Second call should reuse cached token (no new HTTP request)
            const token2 = await testService.getAccessToken();
            expect(token2).toBe(accessToken);
            expect(mockPost).toHaveBeenCalledTimes(1); // Still 1, not 2

            // Third call should also reuse cached token
            const token3 = await testService.getAccessToken();
            expect(token3).toBe(accessToken);
            expect(mockPost).toHaveBeenCalledTimes(1); // Still 1, not 3

            // All tokens should be the same
            expect(token1).toBe(token2);
            expect(token2).toBe(token3);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 3: Authentication Error Handling', () => {
    // Feature: docusign-integration, Property 3: Authentication Error Handling
    it('should log error with details and throw authentication exception for any authentication failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { error: 'invalid_grant', error_description: 'Invalid credentials' },
            { error: 'unauthorized_client', error_description: 'Client not authorized' },
            { error: 'invalid_request', error_description: 'Missing required parameter' },
          ),
          fc.string({ minLength: 10, maxLength: 100 }), // error message
          async (errorData, errorMessage) => {
            // Create a fresh service instance for each test iteration
            const testModule = await Test.createTestingModule({
              providers: [
                DocuSignService,
                {
                  provide: ConfigService,
                  useValue: {
                    get: jest.fn(),
                  },
                },
                {
                  provide: HttpService,
                  useValue: {
                    post: jest.fn(),
                  },
                },
                {
                  provide: LeaseRepository,
                  useValue: {
                    findByEnvelopeId: jest.fn(),
                    updateSignedDocument: jest.fn(),
                  },
                },
                {
                  provide: MediaService,
                  useValue: {
                    uploadFile: jest.fn(),
                    getFileBuffer: jest.fn(),
                  },
                },
              ],
            }).compile();

            const testService = testModule.get<DocuSignService>(DocuSignService);
            const testConfigService = testModule.get<ConfigService>(ConfigService);
            const testHttpService = testModule.get<HttpService>(HttpService);

            // Generate a valid RSA key pair for testing
            const { privateKey } = crypto.generateKeyPairSync('rsa', {
              modulusLength: 2048,
              privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
              },
            });

            // Mock configuration
            jest.spyOn(testConfigService, 'get').mockImplementation((key: string) => {
              const config: Record<string, string> = {
                DOCUSIGN_INTEGRATION_KEY: 'test-key',
                DOCUSIGN_USER_ID: 'test-user',
                DOCUSIGN_PRIVATE_KEY: privateKey,
                DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
              };
              return config[key];
            });

            // Mock HTTP error response
            const mockError = {
              response: {
                data: errorData,
              },
              message: errorMessage,
            };

            jest.spyOn(testHttpService, 'post').mockImplementation(() => {
              throw mockError;
            });

            // Spy on logger to verify error logging
            const loggerErrorSpy = jest.spyOn(testService['logger'], 'error');

            // Should throw an error
            await expect(testService.getAccessToken()).rejects.toThrow(
              /DocuSign authentication failed/,
            );

            // Should log the error with details
            expect(loggerErrorSpy).toHaveBeenCalledWith(
              'Authentication failed',
              errorData,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Unit Tests: Authentication Edge Cases', () => {
    it('should handle invalid private key format', async () => {
      const invalidPrivateKey = 'invalid-key-format';

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DOCUSIGN_INTEGRATION_KEY: 'test-key',
          DOCUSIGN_USER_ID: 'test-user',
          DOCUSIGN_PRIVATE_KEY: invalidPrivateKey,
          DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
        };
        return config[key];
      });

      // Should throw an error when trying to sign with invalid key
      await expect(service.getAccessToken()).rejects.toThrow();
    });

    it('should handle network timeout', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DOCUSIGN_INTEGRATION_KEY: 'test-key',
          DOCUSIGN_USER_ID: 'test-user',
          DOCUSIGN_PRIVATE_KEY: privateKey,
          DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
        };
        return config[key];
      });

      // Mock network timeout error
      jest.spyOn(httpService, 'post').mockImplementation(() => {
        throw new Error('Network timeout');
      });

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.getAccessToken()).rejects.toThrow(
        /DocuSign authentication failed/,
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Authentication failed',
        'Network timeout',
      );
    });

    it('should refresh token before expiration', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DOCUSIGN_INTEGRATION_KEY: 'test-key',
          DOCUSIGN_USER_ID: 'test-user',
          DOCUSIGN_PRIVATE_KEY: privateKey,
          DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
        };
        return config[key];
      });

      const mockPost = jest.fn()
        .mockReturnValueOnce(
          of({
            data: {
              access_token: 'first-token',
              expires_in: 300, // 5 minutes - should trigger refresh on next call
            },
          }),
        )
        .mockReturnValueOnce(
          of({
            data: {
              access_token: 'second-token',
              expires_in: 3600,
            },
          }),
        );

      jest.spyOn(httpService, 'post').mockImplementation(mockPost as any);

      // First call
      const token1 = await service.getAccessToken();
      expect(token1).toBe('first-token');
      expect(mockPost).toHaveBeenCalledTimes(1);

      // Second call should trigger refresh because token expires in 5 minutes (within buffer)
      const token2 = await service.getAccessToken();
      expect(token2).toBe('second-token');
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('Property 4: Envelope Structure Completeness', () => {
    // Feature: docusign-integration, Property 4: Envelope Structure Completeness
    it('should create envelope definition with all required fields for any valid lease with PDF and tenant email', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }), // leaseId
          fc.string({ minLength: 100, maxLength: 1000 }), // pdfBase64
          fc.emailAddress(), // tenantEmail
          fc.string({ minLength: 3, maxLength: 50 }), // tenantName
          fc.option(
            fc.record({
              pageNumber: fc.integer({ min: 1, max: 100 }),
              xPosition: fc.integer({ min: 0, max: 1000 }),
              yPosition: fc.integer({ min: 0, max: 1000 }),
            }),
            { nil: undefined },
          ), // signaturePosition (optional)
          (leaseId, pdfBase64, tenantEmail, tenantName, signaturePosition) => {
            // Call private method via reflection
            const envelopeDefinition = (service as any).buildEnvelopeDefinition(
              leaseId,
              pdfBase64,
              tenantEmail,
              tenantName,
              signaturePosition,
            );

            // Verify envelope has all required fields
            expect(envelopeDefinition).toBeDefined();
            expect(envelopeDefinition.emailSubject).toBeDefined();
            expect(envelopeDefinition.emailSubject).toContain(leaseId);

            // Verify document structure
            expect(envelopeDefinition.documents).toBeDefined();
            expect(envelopeDefinition.documents).toHaveLength(1);
            expect(envelopeDefinition.documents[0].documentBase64).toBe(pdfBase64);
            expect(envelopeDefinition.documents[0].name).toContain(leaseId);
            expect(envelopeDefinition.documents[0].fileExtension).toBe('pdf');
            expect(envelopeDefinition.documents[0].documentId).toBe('1');

            // Verify recipient structure
            expect(envelopeDefinition.recipients).toBeDefined();
            expect(envelopeDefinition.recipients.signers).toBeDefined();
            expect(envelopeDefinition.recipients.signers).toHaveLength(1);
            
            const signer = envelopeDefinition.recipients.signers[0];
            expect(signer.email).toBe(tenantEmail);
            expect(signer.name).toBe(tenantName);
            expect(signer.recipientId).toBe('1');
            expect(signer.routingOrder).toBe('1');

            // Verify signHere tab structure
            expect(signer.tabs).toBeDefined();
            expect(signer.tabs.signHereTabs).toBeDefined();
            expect(signer.tabs.signHereTabs).toHaveLength(1);
            
            const signHereTab = signer.tabs.signHereTabs[0];
            expect(signHereTab.documentId).toBe('1');
            expect(signHereTab.pageNumber).toBeDefined();
            expect(signHereTab.xPosition).toBeDefined();
            expect(signHereTab.yPosition).toBeDefined();

            // Verify signature position (default or custom)
            if (signaturePosition) {
              expect(signHereTab.pageNumber).toBe(signaturePosition.pageNumber.toString());
              expect(signHereTab.xPosition).toBe(signaturePosition.xPosition.toString());
              expect(signHereTab.yPosition).toBe(signaturePosition.yPosition.toString());
            } else {
              // Default position
              expect(signHereTab.pageNumber).toBe('1');
              expect(signHereTab.xPosition).toBe('100');
              expect(signHereTab.yPosition).toBe('200');
            }

            // Verify status is set to "sent"
            expect(envelopeDefinition.status).toBe('sent');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 5: Envelope ID Persistence', () => {
    // Feature: docusign-integration, Property 5: Envelope ID Persistence
    it('should return envelope ID and status in response for any successfully created envelope', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 50 }), // leaseId
          fc.string({ minLength: 20, maxLength: 100 }), // envelopeId
          fc.constantFrom('sent', 'delivered'), // status
          fc.emailAddress(), // tenantEmail
          fc.string({ minLength: 3, maxLength: 50 }), // tenantName
          async (leaseId, envelopeId, status, tenantEmail, tenantName) => {
            // Create a fresh service instance for each test iteration
            const testModule = await Test.createTestingModule({
              providers: [
                DocuSignService,
                {
                  provide: ConfigService,
                  useValue: {
                    get: jest.fn(),
                  },
                },
                {
                  provide: HttpService,
                  useValue: {
                    post: jest.fn(),
                  },
                },
                {
                  provide: LeaseRepository,
                  useValue: {
                    findByEnvelopeId: jest.fn(),
                    updateSignedDocument: jest.fn(),
                  },
                },
                {
                  provide: MediaService,
                  useValue: {
                    uploadFile: jest.fn(),
                    getFileBuffer: jest.fn(),
                  },
                },
              ],
            }).compile();

            const testService = testModule.get<DocuSignService>(DocuSignService);
            const testConfigService = testModule.get<ConfigService>(ConfigService);
            const testHttpService = testModule.get<HttpService>(HttpService);

            // Generate a valid RSA key pair for testing
            const { privateKey } = crypto.generateKeyPairSync('rsa', {
              modulusLength: 2048,
              privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
              },
            });

            // Mock configuration
            jest.spyOn(testConfigService, 'get').mockImplementation((key: string) => {
              const config: Record<string, string> = {
                DOCUSIGN_INTEGRATION_KEY: 'test-key',
                DOCUSIGN_USER_ID: 'test-user',
                DOCUSIGN_PRIVATE_KEY: privateKey,
                DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
                DOCUSIGN_ACCOUNT_ID: 'test-account',
              };
              return config[key];
            });

            const statusDateTime = new Date().toISOString();
            const uri = `/envelopes/${envelopeId}`;

            // Mock authentication response
            jest.spyOn(testHttpService, 'post')
              .mockReturnValueOnce(
                of({
                  data: {
                    access_token: 'test-token',
                    expires_in: 3600,
                  },
                }),
              )
              // Mock envelope creation response
              .mockReturnValueOnce(
                of({
                  data: {
                    envelopeId,
                    status,
                    statusDateTime,
                    uri,
                  },
                }),
              );

            // Create a test PDF buffer
            const pdfBuffer = Buffer.from('test-pdf-content');

            // Call sendLeaseForSignature
            const response = await testService.sendLeaseForSignature(
              leaseId,
              pdfBuffer,
              tenantEmail,
              tenantName,
            );

            // Verify response contains envelope ID and status
            expect(response).toBeDefined();
            expect(response.envelopeId).toBe(envelopeId);
            expect(response.status).toBe(status);
            expect(response.statusDateTime).toBe(statusDateTime);
            expect(response.uri).toBe(uri);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 6: Envelope Creation Error Handling', () => {
    // Feature: docusign-integration, Property 6: Envelope Creation Error Handling
    it('should log error with lease ID and failure details, and return descriptive error for any envelope creation failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 50 }), // leaseId
          fc.constantFrom(
            { message: 'Invalid document format', errorCode: 'INVALID_DOCUMENT' },
            { message: 'Invalid recipient email', errorCode: 'INVALID_EMAIL' },
            { message: 'Account not authorized', errorCode: 'UNAUTHORIZED' },
          ),
          fc.emailAddress(), // tenantEmail
          fc.string({ minLength: 3, maxLength: 50 }), // tenantName
          async (leaseId, errorData, tenantEmail, tenantName) => {
            // Create a fresh service instance for each test iteration
            const testModule = await Test.createTestingModule({
              providers: [
                DocuSignService,
                {
                  provide: ConfigService,
                  useValue: {
                    get: jest.fn(),
                  },
                },
                {
                  provide: HttpService,
                  useValue: {
                    post: jest.fn(),
                  },
                },
                {
                  provide: LeaseRepository,
                  useValue: {
                    findByEnvelopeId: jest.fn(),
                    updateSignedDocument: jest.fn(),
                  },
                },
                {
                  provide: MediaService,
                  useValue: {
                    uploadFile: jest.fn(),
                    getFileBuffer: jest.fn(),
                  },
                },
              ],
            }).compile();

            const testService = testModule.get<DocuSignService>(DocuSignService);
            const testConfigService = testModule.get<ConfigService>(ConfigService);
            const testHttpService = testModule.get<HttpService>(HttpService);

            // Generate a valid RSA key pair for testing
            const { privateKey } = crypto.generateKeyPairSync('rsa', {
              modulusLength: 2048,
              privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
              },
            });

            // Mock configuration
            jest.spyOn(testConfigService, 'get').mockImplementation((key: string) => {
              const config: Record<string, string> = {
                DOCUSIGN_INTEGRATION_KEY: 'test-key',
                DOCUSIGN_USER_ID: 'test-user',
                DOCUSIGN_PRIVATE_KEY: privateKey,
                DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
                DOCUSIGN_ACCOUNT_ID: 'test-account',
              };
              return config[key];
            });

            // Mock authentication success
            const mockPost = jest.spyOn(testHttpService, 'post')
              .mockReturnValueOnce(
                of({
                  data: {
                    access_token: 'test-token',
                    expires_in: 3600,
                  },
                }),
              );

            // Mock envelope creation failure
            mockPost.mockImplementationOnce(() => {
              throw {
                response: {
                  data: errorData,
                },
                message: errorData.message,
              };
            });

            // Spy on logger to verify error logging
            const loggerErrorSpy = jest.spyOn(testService['logger'], 'error');

            // Create a test PDF buffer
            const pdfBuffer = Buffer.from('test-pdf-content');

            // Should throw an error
            await expect(
              testService.sendLeaseForSignature(
                leaseId,
                pdfBuffer,
                tenantEmail,
                tenantName,
              ),
            ).rejects.toThrow(/Failed to send lease for signature/);

            // Verify error was logged with lease ID and details
            expect(loggerErrorSpy).toHaveBeenCalledWith(
              expect.stringContaining(`Envelope creation failed for lease ${leaseId}`),
              errorData,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Unit Tests: Envelope Creation Scenarios', () => {
    it('should throw error when lease PDF buffer is invalid', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DOCUSIGN_INTEGRATION_KEY: 'test-key',
          DOCUSIGN_USER_ID: 'test-user',
          DOCUSIGN_PRIVATE_KEY: privateKey,
          DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
          DOCUSIGN_ACCOUNT_ID: 'test-account',
        };
        return config[key];
      });

      // Mock authentication success
      jest.spyOn(httpService, 'post')
        .mockReturnValueOnce(
          of({
            data: {
              access_token: 'test-token',
              expires_in: 3600,
            },
          }),
        )
        // Mock envelope creation failure due to invalid PDF
        .mockImplementationOnce(() => {
          throw {
            response: {
              data: {
                message: 'Invalid document format',
                errorCode: 'INVALID_DOCUMENT',
              },
            },
            message: 'Invalid document format',
          };
        });

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

      // Empty buffer simulates missing/invalid PDF
      const emptyBuffer = Buffer.from('');

      await expect(
        service.sendLeaseForSignature(
          'lease-123',
          emptyBuffer,
          'tenant@example.com',
          'John Doe',
        ),
      ).rejects.toThrow(/Failed to send lease for signature/);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Envelope creation failed for lease lease-123'),
        expect.objectContaining({
          message: 'Invalid document format',
          errorCode: 'INVALID_DOCUMENT',
        }),
      );
    });

    it('should throw error when tenant email is invalid', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DOCUSIGN_INTEGRATION_KEY: 'test-key',
          DOCUSIGN_USER_ID: 'test-user',
          DOCUSIGN_PRIVATE_KEY: privateKey,
          DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
          DOCUSIGN_ACCOUNT_ID: 'test-account',
        };
        return config[key];
      });

      // Mock authentication success
      jest.spyOn(httpService, 'post')
        .mockReturnValueOnce(
          of({
            data: {
              access_token: 'test-token',
              expires_in: 3600,
            },
          }),
        )
        // Mock envelope creation failure due to invalid email
        .mockImplementationOnce(() => {
          throw {
            response: {
              data: {
                message: 'Invalid recipient email',
                errorCode: 'INVALID_EMAIL',
              },
            },
            message: 'Invalid recipient email',
          };
        });

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      const pdfBuffer = Buffer.from('test-pdf-content');

      await expect(
        service.sendLeaseForSignature(
          'lease-456',
          pdfBuffer,
          'invalid-email',
          'Jane Doe',
        ),
      ).rejects.toThrow(/Failed to send lease for signature/);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Envelope creation failed for lease lease-456'),
        expect.objectContaining({
          message: 'Invalid recipient email',
          errorCode: 'INVALID_EMAIL',
        }),
      );
    });

    it('should handle DocuSign API errors gracefully', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DOCUSIGN_INTEGRATION_KEY: 'test-key',
          DOCUSIGN_USER_ID: 'test-user',
          DOCUSIGN_PRIVATE_KEY: privateKey,
          DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
          DOCUSIGN_ACCOUNT_ID: 'test-account',
        };
        return config[key];
      });

      // Mock authentication success
      jest.spyOn(httpService, 'post')
        .mockReturnValueOnce(
          of({
            data: {
              access_token: 'test-token',
              expires_in: 3600,
            },
          }),
        )
        // Mock envelope creation failure due to API error
        .mockImplementationOnce(() => {
          throw {
            response: {
              data: {
                message: 'Account not authorized',
                errorCode: 'UNAUTHORIZED',
              },
            },
            message: 'Account not authorized',
          };
        });

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      const pdfBuffer = Buffer.from('test-pdf-content');

      await expect(
        service.sendLeaseForSignature(
          'lease-789',
          pdfBuffer,
          'tenant@example.com',
          'Bob Smith',
        ),
      ).rejects.toThrow(/Failed to send lease for signature/);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Envelope creation failed for lease lease-789'),
        expect.objectContaining({
          message: 'Account not authorized',
          errorCode: 'UNAUTHORIZED',
        }),
      );
    });

    it('should successfully create envelope with valid inputs', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DOCUSIGN_INTEGRATION_KEY: 'test-key',
          DOCUSIGN_USER_ID: 'test-user',
          DOCUSIGN_PRIVATE_KEY: privateKey,
          DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
          DOCUSIGN_ACCOUNT_ID: 'test-account',
        };
        return config[key];
      });

      const envelopeId = 'envelope-success-123';
      const statusDateTime = new Date().toISOString();

      // Mock authentication success
      jest.spyOn(httpService, 'post')
        .mockReturnValueOnce(
          of({
            data: {
              access_token: 'test-token',
              expires_in: 3600,
            },
          }),
        )
        // Mock successful envelope creation
        .mockReturnValueOnce(
          of({
            data: {
              envelopeId,
              status: 'sent',
              statusDateTime,
              uri: `/envelopes/${envelopeId}`,
            },
          }),
        );

      const loggerLogSpy = jest.spyOn(service['logger'], 'log');
      const pdfBuffer = Buffer.from('test-pdf-content');

      const response = await service.sendLeaseForSignature(
        'lease-success',
        pdfBuffer,
        'tenant@example.com',
        'Alice Johnson',
      );

      expect(response).toBeDefined();
      expect(response.envelopeId).toBe(envelopeId);
      expect(response.status).toBe('sent');
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully created envelope'),
      );
    });

    it('should use custom signature position when provided', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DOCUSIGN_INTEGRATION_KEY: 'test-key',
          DOCUSIGN_USER_ID: 'test-user',
          DOCUSIGN_PRIVATE_KEY: privateKey,
          DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi',
          DOCUSIGN_ACCOUNT_ID: 'test-account',
        };
        return config[key];
      });

      const customPosition = {
        pageNumber: 2,
        xPosition: 300,
        yPosition: 400,
      };

      // Mock authentication and envelope creation
      const mockPost = jest.spyOn(httpService, 'post')
        .mockReturnValueOnce(
          of({
            data: {
              access_token: 'test-token',
              expires_in: 3600,
            },
          }),
        )
        .mockReturnValueOnce(
          of({
            data: {
              envelopeId: 'envelope-custom-pos',
              status: 'sent',
              statusDateTime: new Date().toISOString(),
              uri: '/envelopes/envelope-custom-pos',
            },
          }),
        );

      const pdfBuffer = Buffer.from('test-pdf-content');

      await service.sendLeaseForSignature(
        'lease-custom',
        pdfBuffer,
        'tenant@example.com',
        'Custom User',
        customPosition,
      );

      // Verify the envelope creation call included custom position
      const envelopeCreationCall = mockPost.mock.calls[1];
      const envelopeDefinition = envelopeCreationCall[1];
      
      expect(envelopeDefinition.recipients.signers[0].tabs.signHereTabs[0]).toEqual({
        documentId: '1',
        pageNumber: '2',
        xPosition: '300',
        yPosition: '400',
      });
    });
  });

  describe('Unit Tests: Webhook Processing Logic', () => {
    it('should parse envelope status and filter for completed events', async () => {
      const mockPayload = {
        event: 'envelope-completed',
        apiVersion: 'v2.1',
        uri: '/envelopes/test-envelope-id',
        retryCount: 0,
        generatedDateTime: '2024-01-01T00:00:00Z',
        data: {
          accountId: 'test-account',
          userId: 'test-user',
          envelopeId: 'test-envelope-id',
          envelopeSummary: {
            status: 'completed',
            emailSubject: 'Test Lease',
            envelopeId: 'test-envelope-id',
            recipients: {},
          },
        },
      };

      const mockLease = {
        _id: 'lease-123',
        docusignEnvelopeId: 'test-envelope-id',
      };

      jest.spyOn(leaseRepository, 'findByEnvelopeId').mockResolvedValue(mockLease as any);
      jest.spyOn(service, 'getSignedDocument').mockResolvedValue(Buffer.from('pdf-content'));
      jest.spyOn(service as any, 'storeSignedDocument').mockResolvedValue('storage-ref');
      jest.spyOn(leaseRepository, 'updateSignedDocument').mockResolvedValue(mockLease as any);

      await service.handleWebhookEvent(mockPayload as any);

      expect(leaseRepository.findByEnvelopeId).toHaveBeenCalledWith('test-envelope-id');
      expect(service.getSignedDocument).toHaveBeenCalledWith('test-envelope-id');
      expect(leaseRepository.updateSignedDocument).toHaveBeenCalledWith('lease-123', 'storage-ref');
    });

    it('should ignore non-completed envelope status', async () => {
      const mockPayload = {
        event: 'envelope-sent',
        apiVersion: 'v2.1',
        uri: '/envelopes/test-envelope-id',
        retryCount: 0,
        generatedDateTime: '2024-01-01T00:00:00Z',
        data: {
          accountId: 'test-account',
          userId: 'test-user',
          envelopeId: 'test-envelope-id',
          envelopeSummary: {
            status: 'sent',
            emailSubject: 'Test Lease',
            envelopeId: 'test-envelope-id',
            recipients: {},
          },
        },
      };

      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service.handleWebhookEvent(mockPayload as any);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring webhook'),
      );
      expect(leaseRepository.findByEnvelopeId).not.toHaveBeenCalled();
    });

    it('should handle missing lease gracefully with warning log', async () => {
      const mockPayload = {
        event: 'envelope-completed',
        apiVersion: 'v2.1',
        uri: '/envelopes/test-envelope-id',
        retryCount: 0,
        generatedDateTime: '2024-01-01T00:00:00Z',
        data: {
          accountId: 'test-account',
          userId: 'test-user',
          envelopeId: 'test-envelope-id',
          envelopeSummary: {
            status: 'completed',
            emailSubject: 'Test Lease',
            envelopeId: 'test-envelope-id',
            recipients: {},
          },
        },
      };

      jest.spyOn(leaseRepository, 'findByEnvelopeId').mockResolvedValue(null);
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');
      const getSignedDocumentSpy = jest.spyOn(service, 'getSignedDocument');

      await service.handleWebhookEvent(mockPayload as any);

      expect(leaseRepository.findByEnvelopeId).toHaveBeenCalledWith('test-envelope-id');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No lease found'),
      );
      expect(getSignedDocumentSpy).not.toHaveBeenCalled();
    });
  });
});
