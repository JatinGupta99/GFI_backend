import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import * as crypto from 'crypto';
import { HmacValidationGuard } from './hmac-validation.guard';

describe('HmacValidationGuard', () => {
  let guard: HmacValidationGuard;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HmacValidationGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<HmacValidationGuard>(HmacValidationGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  // Feature: docusign-integration, Property 7: HMAC Signature Validation
  describe('Property 7: HMAC Signature Validation', () => {
    it('should accept webhooks with valid HMAC signatures across random payloads and secrets', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // webhook secret
          fc.jsonValue(), // random webhook payload
          (webhookSecret, payload) => {
            // Arrange: Create raw body and compute valid signature
            const rawBody = Buffer.from(JSON.stringify(payload));
            const validSignature = crypto
              .createHmac('sha256', webhookSecret)
              .update(rawBody)
              .digest('base64');

            jest.spyOn(configService, 'get').mockReturnValue(webhookSecret);

            const mockRequest = {
              headers: {
                'x-docusign-signature-1': validSignature,
              },
              rawBody,
              ip: '127.0.0.1',
            };

            const mockContext = {
              switchToHttp: () => ({
                getRequest: () => mockRequest,
              }),
            } as ExecutionContext;

            // Act & Assert: Valid signature should be accepted
            const result = guard.canActivate(mockContext);
            expect(result).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject webhooks with invalid HMAC signatures across random tampering', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // webhook secret
          fc.jsonValue(), // original payload
          fc.jsonValue(), // tampered payload (different from original)
          (webhookSecret, originalPayload, tamperedPayload) => {
            // Skip if payloads are identical
            fc.pre(JSON.stringify(originalPayload) !== JSON.stringify(tamperedPayload));

            // Arrange: Create signature for original, but send tampered body
            const originalBody = Buffer.from(JSON.stringify(originalPayload));
            const tamperedBody = Buffer.from(JSON.stringify(tamperedPayload));
            
            const signatureForOriginal = crypto
              .createHmac('sha256', webhookSecret)
              .update(originalBody)
              .digest('base64');

            jest.spyOn(configService, 'get').mockReturnValue(webhookSecret);

            const mockRequest = {
              headers: {
                'x-docusign-signature-1': signatureForOriginal,
              },
              rawBody: tamperedBody, // Send tampered body
              ip: '127.0.0.1',
            };

            const mockContext = {
              switchToHttp: () => ({
                getRequest: () => mockRequest,
              }),
            } as ExecutionContext;

            // Act & Assert: Tampered payload should be rejected
            expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject webhooks when signature is computed with wrong secret', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // correct secret
          fc.string({ minLength: 10, maxLength: 100 }), // wrong secret
          fc.jsonValue(), // payload
          (correctSecret, wrongSecret, payload) => {
            // Skip if secrets are identical
            fc.pre(correctSecret !== wrongSecret);

            // Arrange: Sign with wrong secret, validate with correct secret
            const rawBody = Buffer.from(JSON.stringify(payload));
            const signatureWithWrongSecret = crypto
              .createHmac('sha256', wrongSecret)
              .update(rawBody)
              .digest('base64');

            jest.spyOn(configService, 'get').mockReturnValue(correctSecret);

            const mockRequest = {
              headers: {
                'x-docusign-signature-1': signatureWithWrongSecret,
              },
              rawBody,
              ip: '127.0.0.1',
            };

            const mockContext = {
              switchToHttp: () => ({
                getRequest: () => mockRequest,
              }),
            } as ExecutionContext;

            // Act & Assert: Wrong secret should be rejected
            expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: docusign-integration, Property 20: Webhook Validation Logging
  describe('Property 20: Webhook Validation Logging', () => {
    it('should log all validation attempts with success or failure status', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // webhook secret
          fc.jsonValue(), // payload
          fc.boolean(), // whether to use valid or invalid signature
          (webhookSecret, payload, useValidSignature) => {
            // Arrange
            const rawBody = Buffer.from(JSON.stringify(payload));
            const validSignature = crypto
              .createHmac('sha256', webhookSecret)
              .update(rawBody)
              .digest('base64');
            
            const invalidSignature = 'invalid-signature-' + Math.random();
            const signature = useValidSignature ? validSignature : invalidSignature;

            jest.spyOn(configService, 'get').mockReturnValue(webhookSecret);

            // Spy on logger
            const logSpy = jest.spyOn(guard['logger'], 'log');
            const warnSpy = jest.spyOn(guard['logger'], 'warn');

            const mockRequest = {
              headers: {
                'x-docusign-signature-1': signature,
              },
              rawBody,
              ip: '127.0.0.1',
            };

            const mockContext = {
              switchToHttp: () => ({
                getRequest: () => mockRequest,
              }),
            } as ExecutionContext;

            // Act
            try {
              guard.canActivate(mockContext);
            } catch (error) {
              // Expected for invalid signatures
            }

            // Assert: Logging should occur for both success and failure
            if (useValidSignature) {
              expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Webhook validation successful'),
              );
            } else {
              expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Webhook validation failed'),
              );
            }

            // Cleanup
            logSpy.mockRestore();
            warnSpy.mockRestore();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Unit tests for edge cases (Requirements 3.3, 5.5)
  describe('Unit Tests: Edge Cases', () => {
    it('should reject webhook with missing signature header', () => {
      // Arrange
      const mockRequest = {
        headers: {},
        rawBody: Buffer.from('test'),
        ip: '127.0.0.1',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Missing HMAC signature header');
    });

    it('should reject webhook with missing raw body', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockReturnValue('test-secret');

      const mockRequest = {
        headers: {
          'x-docusign-signature-1': 'some-signature',
        },
        rawBody: undefined,
        ip: '127.0.0.1',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Raw body not available for signature validation',
      );
    });

    it('should reject webhook when webhook secret is not configured', () => {
      // Arrange
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      const mockRequest = {
        headers: {
          'x-docusign-signature-1': 'some-signature',
        },
        rawBody: Buffer.from('test'),
        ip: '127.0.0.1',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Webhook secret not configured');
    });

    it('should reject webhook with tampered request body', () => {
      // Arrange
      const webhookSecret = 'test-secret';
      const originalBody = Buffer.from(JSON.stringify({ event: 'envelope-completed' }));
      const tamperedBody = Buffer.from(JSON.stringify({ event: 'envelope-voided' }));

      const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(originalBody)
        .digest('base64');

      jest.spyOn(configService, 'get').mockReturnValue(webhookSecret);

      const mockRequest = {
        headers: {
          'x-docusign-signature-1': validSignature,
        },
        rawBody: tamperedBody, // Different from what was signed
        ip: '127.0.0.1',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Invalid HMAC signature');
    });

    it('should reject webhook with wrong webhook secret', () => {
      // Arrange
      const correctSecret = 'correct-secret';
      const wrongSecret = 'wrong-secret';
      const body = Buffer.from(JSON.stringify({ event: 'envelope-completed' }));

      const signatureWithWrongSecret = crypto
        .createHmac('sha256', wrongSecret)
        .update(body)
        .digest('base64');

      jest.spyOn(configService, 'get').mockReturnValue(correctSecret);

      const mockRequest = {
        headers: {
          'x-docusign-signature-1': signatureWithWrongSecret,
        },
        rawBody: body,
        ip: '127.0.0.1',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      // Act & Assert
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Invalid HMAC signature');
    });
  });
});
