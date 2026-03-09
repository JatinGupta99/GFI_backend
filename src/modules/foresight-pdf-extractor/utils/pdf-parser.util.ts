import { InternalServerErrorException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

/**
 * Utility class for parsing PDF documents into text content.
 * Uses the pdf-parse library to extract text from PDF buffers.
 */
export class PdfParserUtil {
  /**
   * Parses a PDF buffer and extracts the text content.
   *
   * @param buffer - The PDF file buffer to parse
   * @returns The extracted text content from the PDF
   * @throws InternalServerErrorException if the PDF cannot be parsed
   *
   * @example
   * const pdfBuffer = fs.readFileSync('document.pdf');
   * const text = await PdfParserUtil.parsePdf(pdfBuffer);
   */
  static async parsePdf(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `Failed to parse PDF: ${errorMessage}`,
      );
    }
  }
}