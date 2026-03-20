export interface EmailRequest {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: string[];
  Key?: string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
}

export interface ProcessedEmailRequest {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments: EmailAttachment[];
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}