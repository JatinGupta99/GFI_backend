import { InternalServerErrorException } from '@nestjs/common';
import { PdfParserUtil } from './pdf-parser.util';

// Mock the pdf-parse module
jest.mock('pdf-parse', () => jest.fn());

describe('PdfParserUtil', () => {
  let mockPdfParse: jest.Mock;

  beforeEach(() => {
    mockPdfParse = require('pdf-parse');
    jest.clearAllMocks();
  });

  describe('parsePdf', () => {
    it('should successfully parse a valid PDF buffer and return text content', async () => {
      // Arrange
      const mockBuffer = Buffer.from('mock pdf content');
      const mockText = 'Extracted text from PDF';
      mockPdfParse.mockResolvedValue({ text: mockText });

      // Act
      const result = await PdfParserUtil.parsePdf(mockBuffer);

      // Assert
      expect(result).toBe(mockText);
      expect(mockPdfParse).toHaveBeenCalledWith(mockBuffer);
      expect(mockPdfParse).toHaveBeenCalledTimes(1);
    });

    it('should throw InternalServerErrorException when PDF parsing fails', async () => {
      // Arrange
      const mockBuffer = Buffer.from('invalid pdf content');
      const mockError = new Error('Invalid PDF structure');
      mockPdfParse.mockRejectedValue(mockError);

      // Act & Assert
      await expect(PdfParserUtil.parsePdf(mockBuffer)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(PdfParserUtil.parsePdf(mockBuffer)).rejects.toThrow(
        'Failed to parse PDF: Invalid PDF structure',
      );
    });

    it('should handle non-Error exceptions with descriptive message', async () => {
      // Arrange
      const mockBuffer = Buffer.from('invalid pdf content');
      mockPdfParse.mockRejectedValue('String error');

      // Act & Assert
      await expect(PdfParserUtil.parsePdf(mockBuffer)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(PdfParserUtil.parsePdf(mockBuffer)).rejects.toThrow(
        'Failed to parse PDF: Unknown error',
      );
    });

    it('should preserve text structure from parsed PDF', async () => {
      // Arrange
      const mockBuffer = Buffer.from('mock pdf content');
      const mockTextWithStructure = `Property Name: Test Property
Region: CA
Suite: 123456-001
Base Rent: $1,234.56`;
      mockPdfParse.mockResolvedValue({ text: mockTextWithStructure });

      // Act
      const result = await PdfParserUtil.parsePdf(mockBuffer);

      // Assert
      expect(result).toBe(mockTextWithStructure);
      expect(result).toContain('Property Name: Test Property');
      expect(result).toContain('Region: CA');
    });

    it('should handle empty PDF content', async () => {
      // Arrange
      const mockBuffer = Buffer.from('empty pdf');
      mockPdfParse.mockResolvedValue({ text: '' });

      // Act
      const result = await PdfParserUtil.parsePdf(mockBuffer);

      // Assert
      expect(result).toBe('');
    });
  });
});
