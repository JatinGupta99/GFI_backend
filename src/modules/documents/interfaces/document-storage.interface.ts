export interface IDocumentStorage {
  upload(file: Buffer, metadata: DocumentMetadata): Promise<DocumentUploadResult>;
  download(key: string): Promise<DocumentDownloadResult>;
  generateUploadUrl(metadata: DocumentMetadata): Promise<DocumentUploadUrlResult>;
  generateDownloadUrl(key: string, options?: DownloadUrlOptions): Promise<string>;
  delete(key: string): Promise<void>;
  move(oldKey: string, newKey: string): Promise<void>;
}

export interface DocumentMetadata {
  fileName: string;
  contentType: string;
  size?: number;
  folder?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface DocumentUploadResult {
  key: string;
  url?: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

export interface DocumentDownloadResult {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  size: number;
}

export interface DocumentUploadUrlResult {
  key: string;
  uploadUrl: string;
  expiresIn: number;
  fields?: Record<string, string>;
}

export interface DownloadUrlOptions {
  expiresIn?: number;
  responseContentDisposition?: string;
  responseContentType?: string;
}