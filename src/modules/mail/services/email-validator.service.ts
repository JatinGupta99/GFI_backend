import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EmailRequest } from '../interfaces/email-request.interface';

/**
 * Service responsible for email validation
 * Follows Single Responsibility Principle - only handles email validation
 */
@Injectable()
export class EmailValidatorService {
  private readonly logger = new Logger(EmailValidatorService.name);
  
  // Configuration constants
  private readonly MAX_RECIPIENTS = 50;
  private readonly MAX_SUBJECT_LENGTH = 200;
  private readonly MAX_BODY_LENGTH = 1000000; // 1MB
  private readonly MAX_ATTACHMENTS = 10;

  /**
   * Validate complete email request
   * @param emailRequest Email request to validate
   */
  validateEmailRequest(emailRequest: EmailRequest): void {
    this.validateRecipients(emailRequest);
    this.validateSubject(emailRequest.subject);
    this.validateBody(emailRequest.body);
    this.validateAttachments(emailRequest.attachments);
    this.validatePriority(emailRequest.priority);
  }

  /**
   * Validate email recipients
   * @param emailRequest Email request containing recipients
   */
  private validateRecipients(emailRequest: EmailRequest): void {
    const { to, cc = [], bcc = [] } = emailRequest;

    // Validate primary recipient
    if (!to || !this.isValidEmail(to)) {
      throw new BadRequestException('Valid primary recipient email is required');
    }

    // Count total recipients
    const totalRecipients = 1 + cc.length + bcc.length;
    if (totalRecipients > this.MAX_RECIPIENTS) {
      throw new BadRequestException(`Total recipients cannot exceed ${this.MAX_RECIPIENTS}`);
    }

    // Validate CC recipients
    cc.forEach((email, index) => {
      if (!this.isValidEmail(email)) {
        throw new BadRequestException(`Invalid CC email at index ${index}: ${email}`);
      }
    });

    // Validate BCC recipients
    bcc.forEach((email, index) => {
      if (!this.isValidEmail(email)) {
        throw new BadRequestException(`Invalid BCC email at index ${index}: ${email}`);
      }
    });

    // Check for duplicate recipients
    this.checkDuplicateRecipients([to, ...cc, ...bcc]);
  }

  /**
   * Validate email address format
   * @param email Email address to validate
   * @returns True if valid, false otherwise
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Check for duplicate recipients
   * @param recipients Array of all recipients
   */
  private checkDuplicateRecipients(recipients: string[]): void {
    const normalizedEmails = recipients.map(email => email.toLowerCase().trim());
    const uniqueEmails = new Set(normalizedEmails);

    if (uniqueEmails.size !== normalizedEmails.length) {
      throw new BadRequestException('Duplicate recipients are not allowed');
    }
  }

  /**
   * Validate email subject
   * @param subject Email subject to validate
   */
  private validateSubject(subject: string): void {
    if (!subject || typeof subject !== 'string') {
      throw new BadRequestException('Email subject is required');
    }

    const trimmedSubject = subject.trim();
    if (trimmedSubject.length === 0) {
      throw new BadRequestException('Email subject cannot be empty');
    }

    if (trimmedSubject.length > this.MAX_SUBJECT_LENGTH) {
      throw new BadRequestException(`Subject cannot exceed ${this.MAX_SUBJECT_LENGTH} characters`);
    }
  }

  /**
   * Validate email body
   * @param body Email body to validate
   */
  private validateBody(body: string): void {
    if (!body || typeof body !== 'string') {
      throw new BadRequestException('Email body is required');
    }

    const trimmedBody = body.trim();
    if (trimmedBody.length === 0) {
      throw new BadRequestException('Email body cannot be empty');
    }

    if (trimmedBody.length > this.MAX_BODY_LENGTH) {
      throw new BadRequestException(`Body cannot exceed ${this.MAX_BODY_LENGTH} characters`);
    }

    // Basic HTML validation
    if (this.containsUnsafeContent(trimmedBody)) {
      throw new BadRequestException('Email body contains potentially unsafe content');
    }
  }

  /**
   * Validate attachments array
   * @param attachments Attachments array to validate
   */
  private validateAttachments(attachments?: string[]): void {
    if (!attachments) {
      return;
    }

    if (!Array.isArray(attachments)) {
      throw new BadRequestException('Attachments must be an array');
    }

    if (attachments.length > this.MAX_ATTACHMENTS) {
      throw new BadRequestException(`Cannot exceed ${this.MAX_ATTACHMENTS} attachments`);
    }

    attachments.forEach((attachment, index) => {
      if (!attachment || typeof attachment !== 'string' || attachment.trim().length === 0) {
        throw new BadRequestException(`Invalid attachment at index ${index}`);
      }
    });
  }

  /**
   * Validate email priority
   * @param priority Email priority to validate
   */
  private validatePriority(priority?: string): void {
    if (priority && !['low', 'normal', 'high'].includes(priority)) {
      throw new BadRequestException('Priority must be one of: low, normal, high');
    }
  }

  /**
   * Check for potentially unsafe content in email body
   * @param body Email body to check
   * @returns True if unsafe content found
   */
  private containsUnsafeContent(body: string): boolean {
    // Basic checks for potentially dangerous content
    const unsafePatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi // Event handlers like onclick, onload, etc.
    ];

    return unsafePatterns.some(pattern => pattern.test(body));
  }
}