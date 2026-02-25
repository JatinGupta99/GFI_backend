import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SendForSignatureDto } from './send-for-signature.dto';

describe('SendForSignatureDto', () => {
  describe('Unit Tests: DTO Validation', () => {
    it('should pass validation with valid leaseId', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all valid fields', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
        recipientEmail: 'tenant@example.com',
        signaturePosition: {
          pageNumber: 1,
          xPosition: 100,
          yPosition: 200,
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when leaseId is missing', async () => {
      const dto = plainToInstance(SendForSignatureDto, {});

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const leaseIdError = errors.find((error) => error.property === 'leaseId');
      expect(leaseIdError).toBeDefined();
      expect(leaseIdError?.constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when leaseId is empty string', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const leaseIdError = errors.find((error) => error.property === 'leaseId');
      expect(leaseIdError).toBeDefined();
      expect(leaseIdError?.constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when leaseId is not a string', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 12345,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const leaseIdError = errors.find((error) => error.property === 'leaseId');
      expect(leaseIdError).toBeDefined();
      expect(leaseIdError?.constraints).toHaveProperty('isString');
    });

    it('should fail validation when recipientEmail is invalid', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
        recipientEmail: 'invalid-email',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const emailError = errors.find((error) => error.property === 'recipientEmail');
      expect(emailError).toBeDefined();
      expect(emailError?.constraints).toHaveProperty('isEmail');
    });

    it('should fail validation when recipientEmail is not a string', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
        recipientEmail: 12345,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const emailError = errors.find((error) => error.property === 'recipientEmail');
      expect(emailError).toBeDefined();
    });

    it('should fail validation when signaturePosition is not an object', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
        signaturePosition: 'invalid',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const positionError = errors.find((error) => error.property === 'signaturePosition');
      expect(positionError).toBeDefined();
      expect(positionError?.constraints).toHaveProperty('isObject');
    });

    it('should fail validation when signaturePosition.pageNumber is missing', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
        signaturePosition: {
          xPosition: 100,
          yPosition: 200,
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const positionError = errors.find((error) => error.property === 'signaturePosition');
      expect(positionError).toBeDefined();
      expect(positionError?.children).toBeDefined();
      expect(positionError?.children?.length).toBeGreaterThan(0);
    });

    it('should fail validation when signaturePosition.pageNumber is not a number', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
        signaturePosition: {
          pageNumber: 'one',
          xPosition: 100,
          yPosition: 200,
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const positionError = errors.find((error) => error.property === 'signaturePosition');
      expect(positionError).toBeDefined();
    });

    it('should fail validation when signaturePosition.xPosition is missing', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
        signaturePosition: {
          pageNumber: 1,
          yPosition: 200,
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const positionError = errors.find((error) => error.property === 'signaturePosition');
      expect(positionError).toBeDefined();
    });

    it('should fail validation when signaturePosition.yPosition is missing', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
        signaturePosition: {
          pageNumber: 1,
          xPosition: 100,
        },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      const positionError = errors.find((error) => error.property === 'signaturePosition');
      expect(positionError).toBeDefined();
    });

    it('should fail validation with multiple invalid fields', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: '',
        recipientEmail: 'not-an-email',
        signaturePosition: 'invalid',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      // Should have errors for multiple fields
      const leaseIdError = errors.find((error) => error.property === 'leaseId');
      const emailError = errors.find((error) => error.property === 'recipientEmail');
      const positionError = errors.find((error) => error.property === 'signaturePosition');
      
      expect(leaseIdError).toBeDefined();
      expect(emailError).toBeDefined();
      expect(positionError).toBeDefined();
    });

    it('should pass validation when optional fields are omitted', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: 'lease-123',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should return validation error messages in expected format', async () => {
      const dto = plainToInstance(SendForSignatureDto, {
        leaseId: '',
        recipientEmail: 'invalid',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      
      // Verify error structure contains constraints
      errors.forEach((error) => {
        expect(error).toHaveProperty('property');
        expect(error).toHaveProperty('constraints');
        expect(typeof error.constraints).toBe('object');
      });
    });
  });
});
