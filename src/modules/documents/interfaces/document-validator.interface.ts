export interface IDocumentValidator {
  validate(file: DocumentValidationInput): Promise<DocumentValidationResult>;
  isValidContentType(contentType: string): boolean;
  isValidSize(size: number, contentType: string): boolean;
}

export interface DocumentValidationInput {
  fileName: string;
  contentType: string;
  size: number;
  buffer?: Buffer;
}

export interface DocumentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedFileName?: string;
}

export interface DocumentValidationConfig {
  allowedContentTypes: string[];
  maxFileSize: number;
  minFileSize?: number;
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  scanForMalware?: boolean;
}