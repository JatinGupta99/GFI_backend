import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { DocumentAiService } from '../document-ai/document-ai.service';
import { MediaService } from '../media/media.service';
import { JOBNAME, LeadStatus } from '../../common/enums/common-enums';
import mammoth from 'mammoth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

/** Detect actual file type from magic bytes */
function detectMimeFromBuffer(buf: Buffer): string | null {
  // Some PDFs have a BOM or whitespace before %PDF — scan first 1024 bytes
  const head = buf.subarray(0, Math.min(1024, buf.length)).toString('binary');
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'; // %PDF
  if (head.includes('%PDF')) return 'application/pdf';
  // OLE2 Compound Document — legacy .doc / .xls (Word 97-2003, Excel 97-2003)
  if (buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0) return 'application/msword';
  // ZIP-based — .docx / .xlsx
  if (buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04) {
    const str = buf.subarray(0, Math.min(2000, buf.length)).toString('binary');
    if (str.includes('word/')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (str.includes('xl/')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return 'application/zip';
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if ((buf[0] === 0x49 && buf[1] === 0x49) || (buf[0] === 0x4D && buf[1] === 0x4D)) return 'image/tiff';
  return null;
}

/** Convert docx buffer → PDF buffer using mammoth (text extraction) + pdfkit */
async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  try {
    const { value: text } = await mammoth.extractRawText({ buffer: docxBuffer });
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content extracted from Word document');
    }
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      // Write text in chunks to avoid single-line overflow
      const lines = text.split('\n');
      for (const line of lines) {
        doc.fontSize(11).text(line || ' ', { lineBreak: true });
      }
      doc.end();
    });
  } catch (error) {
    throw new Error(`Failed to convert Word document to PDF: ${error.message}`);
  }
}

const DOC_AI_SUPPORTED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/gif',
  'image/bmp',
  'image/webp',
]);

@Processor(JOBNAME.LEADS_PROCESSING)
export class LeadsProcessor extends WorkerHost {
    private readonly logger = new Logger(LeadsProcessor.name);

    constructor(
        private readonly leadsService: LeadsService,
        private readonly documentAiService: DocumentAiService,
        private readonly mediaService: MediaService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.debug(`Processing job ${job.id} of type ${job.name}`);

        if (job.name === JOBNAME.PROCESS_DOCUMENT) {
            const { leadId, fileId, fileKey, mimeType, documentType } = job.data;
            try {
                // Update status based on document type
                if (documentType === 'loi') {
                    this.logger.log(`Processing LOI document for lead ${leadId}`);
                } else {
                    await this.leadsService.updateFileStatus(leadId, fileId, LeadStatus.PROCESSING);
                }

                this.logger.debug(`Fetching file buffer for ${fileKey}`);
                let buffer = await this.mediaService.getFileBuffer(fileKey);

                const firstHex = Buffer.from(buffer.subarray(0, 16)).toString('hex');
                const firstAscii = Buffer.from(buffer.subarray(0, 16)).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
                this.logger.debug(`File first bytes: hex=${firstHex} ascii="${firstAscii}" size=${buffer.length}`);

                if (buffer.length < 100) {
                  throw new Error(`File appears to be empty or corrupted (${buffer.length} bytes). Key: ${fileKey}`);
                }

                // Always detect from actual bytes — never trust the queued mimeType alone
                let resolvedMime = detectMimeFromBuffer(buffer);
                this.logger.debug(`mimeType queued: ${mimeType} | detected from bytes: ${resolvedMime || 'unknown'}`);

                if (!resolvedMime) {
                  // Unknown format — attempt Word conversion as last resort (mammoth is tolerant)
                  this.logger.warn(`Could not detect file format from bytes, attempting Word→PDF conversion as fallback`);
                  try {
                    buffer = await convertDocxToPdf(buffer);
                    resolvedMime = 'application/pdf';
                    this.logger.log(`Fallback conversion succeeded (${buffer.length} bytes)`);
                  } catch (fallbackError) {
                    this.logger.error(`Fallback conversion failed: ${fallbackError.message}`);
                    throw new Error(`Unrecognized file format. Supported formats: PDF (.pdf), Word (.doc, .docx), Images (.jpg, .png, .tiff, .gif, .bmp, .webp). Please ensure your file is not corrupted and try again.`);
                  }
                }

                // Convert any Word format to PDF — Document AI only accepts PDF + images
                if (resolvedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    resolvedMime === 'application/msword') {
                  this.logger.log(`Converting Word document (${resolvedMime}) to PDF for Document AI`);
                  try {
                    buffer = await convertDocxToPdf(buffer);
                    resolvedMime = 'application/pdf';
                    this.logger.log(`Word → PDF conversion complete (${buffer.length} bytes)`);
                  } catch (conversionError) {
                    this.logger.error(`Word to PDF conversion failed: ${conversionError.message}`);
                    throw new Error(`Unable to process Word document. The file may be corrupted or in an unsupported format. Please try: 1) Re-saving the document in Word, 2) Converting to PDF manually, or 3) Uploading a different file.`);
                  }
                }

                if (!DOC_AI_SUPPORTED.has(resolvedMime)) {
                  throw new Error(`Unsupported file format: ${resolvedMime}. Please upload a PDF, Word (.doc/.docx), or image.`);
                }

                this.logger.debug(`Sending to Document AI (size: ${buffer.length} bytes, mime: ${resolvedMime})`);
                const extractionResult = await this.documentAiService.processDocument(buffer, resolvedMime);

                this.logger.debug(`Extraction complete, updating lead`);
                
                // Route to appropriate update method based on document type
                if (documentType === 'loi') {
                    this.logger.log(`LOI extraction result for lead ${leadId}: confidence=${extractionResult.overallConfidence?.toFixed(3)}, fields=${Object.keys(extractionResult.data || {}).length}`);
                    await this.leadsService.updateWithLoiExtraction(leadId, fileKey, extractionResult);
                } else {
                    await this.leadsService.updateWithExtraction(leadId, fileId, extractionResult);
                }

                return { success: true, leadId, fileId, documentType };
            } catch (error) {
                this.logger.error(`Failed to process document for lead ${leadId}`, error);
                
                if (documentType !== 'loi') {
                    await this.leadsService.updateFileStatus(leadId, fileId, LeadStatus.FAILED);
                }
                
                throw error;
            }
        }
    }
}
