import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SendExecutionEmailDto } from '../dto/send-execution-email.dto';
import { EmailTemplateService } from './email-template.service';
import { LeadsRepository } from '../../leads/repository/lead.repository';
import { MailService } from '../../mail/mail.service';
import { MediaService } from '../../media/media.service';
import { EmailType } from '../../../common/enums/common-enums';
import { readFile } from 'fs/promises';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

@Injectable()
export class LeaseEmailService {
  private readonly logger = new Logger(LeaseEmailService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly leadsRepository: LeadsRepository,
    private readonly mediaService: MediaService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Helper method to download PDF from S3 presigned URL, S3 key, or local file
   * @param pdfUrl - Presigned S3 URL, S3 URI (s3://), S3 key, or local file path
   * @returns Buffer containing the PDF data
   */
  private async downloadPdf(pdfUrl: string): Promise<Buffer> {
    try {
      // Check if it's an S3 URI (s3://bucket/key)
      if (pdfUrl.startsWith('s3://')) {
        this.logger.log(`Parsing S3 URI: ${pdfUrl}`);
        
        // Extract S3 key from s3://bucket/key format
        const s3Key = pdfUrl.replace(/^s3:\/\/[^\/]+\//, '');
        this.logger.log(`Extracted S3 key: ${s3Key}`);
        
        // Generate presigned URL for S3 download (15 minutes expiry)
        const presignedUrl = await this.mediaService.generateDownloadUrl(s3Key, 900);
        
        // Download the file from S3 using the presigned URL
        const response = await firstValueFrom(
          this.httpService.get(presignedUrl, {
            responseType: 'arraybuffer',
          })
        );
        
        this.logger.log(`Successfully downloaded PDF from S3 URI: ${pdfUrl}`);
        return Buffer.from(response.data);
      }
      
      // Check if it's already a presigned URL (contains amazonaws.com)
      if (pdfUrl.includes('amazonaws.com') || pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
        this.logger.log(`Downloading PDF from URL: ${pdfUrl.substring(0, 100)}...`);
        
        // Download directly from the presigned URL
        const response = await firstValueFrom(
          this.httpService.get(pdfUrl, {
            responseType: 'arraybuffer',
          })
        );
        
        this.logger.log(`Successfully downloaded PDF from URL`);
        return Buffer.from(response.data);
      }
      
      // Check if it's an S3 key (doesn't start with / or C:\ etc.)
      const isS3Key = !pdfUrl.startsWith('/') && !pdfUrl.match(/^[A-Za-z]:\\/);

      if (isS3Key) {
        this.logger.log(`Generating presigned URL for S3 key: ${pdfUrl}`);
        
        // Generate presigned URL for S3 download (15 minutes expiry)
        const presignedUrl = await this.mediaService.generateDownloadUrl(pdfUrl, 900);
        
        // Download the file from S3 using the presigned URL
        const response = await firstValueFrom(
          this.httpService.get(presignedUrl, {
            responseType: 'arraybuffer',
          })
        );
        
        this.logger.log(`Successfully downloaded PDF from S3: ${pdfUrl}`);
        return Buffer.from(response.data);
      } else {
        // Local file path
        this.logger.log(`Reading PDF from local file: ${pdfUrl}`);
        return await readFile(pdfUrl);
      }
    } catch (error) {
      this.logger.error(`Failed to download PDF from ${pdfUrl.substring(0, 100)}`, error);
      throw error;
    }
  }

  /**
   * Send lease execution email
   */
  async sendExecutionEmail(
    leaseId: string,
    dto: SendExecutionEmailDto,
    user: User,
  ): Promise<{
    emailId?: string;
    taskId?: string;
    followUpEmailId?: string;
  }> {
    // 1. Get lead details from database (lead = lease)
    const lease = await this.leadsRepository.findById(leaseId);

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    // 2. Validate required lead fields
    if (!lease.general?.firstName || !lease.general?.lastName) {
      throw new NotFoundException('Lead tenant information not found');
    }

    // Extract tenant information from lead
    const tenantName = `${lease.general?.firstName || ''} ${lease.general?.lastName || ''}`.trim();
    const tenantEmail = lease.general?.email;

    // 3. Generate email HTML from template
    const emailHtml = await this.emailTemplateService.generateExecutionEmail({
      firstName: lease.general?.firstName || 'Tenant',
      businessName: tenantName,
      property: lease.general?.property || 'Property',
      suite: lease.general?.suite || 'N/A',
      docusignUri: dto.docusignUri,
      userName: user.name,
      userRole: user.role,
    });

    // 4. Prepare email attachments
    const attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }> = [];
    
    // Only attach PDF if it exists (supports presigned URL, S3 key, or local file path)
    if (lease.pdfDocumentUrl) {
      try {
        // Download the PDF (handles both S3 and local files)
        const documentBuffer = await this.downloadPdf(lease.pdfDocumentUrl);
        
        attachments.push({
          filename: `${tenantName} Lease - Execution Copy.pdf`,
          content: documentBuffer,
          contentType: 'application/pdf',
        });
        
        this.logger.log(`PDF attachment added for lease ${leaseId}`);
      } catch (error) {
        this.logger.warn(
          `Failed to download lease document: ${lease.pdfDocumentUrl}, continuing without attachment`,
          error,
        );
        // Continue without attachment - it's optional
      }
    } else {
      this.logger.warn(`No PDF document URL found for lease ${leaseId}, email will be sent without attachment`);
    }

    // 5. Send email using existing MailService
    await this.mailService.send(EmailType.GENERAL, {
      email: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      body: emailHtml,
      attachments,
    });

    // Generate a message ID for tracking
    const emailResult = {
      messageId: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };

    // 6. Create follow-up task (if requested)
    let taskId: string | undefined;
    if (dto.taskFollowUpDays) {
      taskId = await this.createFollowUpTask(
        leaseId,
        dto.taskFollowUpDays,
        tenantName,
        user.id,
      );
    }

    // 7. Schedule follow-up email (if requested)
    let followUpEmailId: string | undefined;
    if (dto.emailFollowUpDays) {
      followUpEmailId = await this.scheduleFollowUpEmail(
        leaseId,
        dto,
        lease,
        user,
        dto.emailFollowUpDays,
      );
    }

    // 8. Log activity
    await this.logEmailActivity(leaseId, dto, user.id, emailResult.messageId);

    return {
      emailId: emailResult.messageId,
      taskId,
      followUpEmailId,
    };
  }

  /**
   * Create follow-up task
   */
  private async createFollowUpTask(
    leaseId: string,
    daysFromNow: number,
    tenantName: string,
    userId: string,
  ): Promise<string> {
    // TODO: Implement task creation when Task entity is available
    // For now, just log and return a placeholder ID
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysFromNow);

    this.logger.log(
      `Follow-up task would be created for lease ${leaseId} due on ${dueDate.toISOString()}`,
    );

    // Placeholder implementation
    const taskId = `task-${Date.now()}`;
    
    // When Task entity is available, implement:
    // const task = await this.taskRepository.create({
    //   leaseId,
    //   title: `Follow up on lease execution - ${tenantName}`,
    //   description: `Check if tenant has signed the lease via DocuSign`,
    //   dueDate,
    //   assignedTo: userId,
    //   priority: 'HIGH',
    //   status: 'PENDING',
    //   type: 'FOLLOW_UP',
    // });
    // return task.id;

    return taskId;
  }

  /**
   * Schedule follow-up email
   */
  private async scheduleFollowUpEmail(
    leaseId: string,
    dto: SendExecutionEmailDto,
    lease: any,
    user: User,
    daysFromNow: number,
  ): Promise<string> {
    // TODO: Implement scheduled email when ScheduledEmail entity is available
    // For now, just log and return a placeholder ID
    
    const sendDate = new Date();
    sendDate.setDate(sendDate.getDate() + daysFromNow);

    this.logger.log(
      `Follow-up email would be scheduled for lease ${leaseId} to send on ${sendDate.toISOString()}`,
    );

    // Placeholder implementation
    const followUpEmailId = `followup-${Date.now()}`;

    // When ScheduledEmail entity is available, implement:
    // const followUpEmail = await this.scheduledEmailRepository.create({
    //   leaseId,
    //   to: dto.to,
    //   cc: dto.cc,
    //   subject: `Follow-up: ${dto.subject}`,
    //   template: 'lease-execution-followup',
    //   sendAt: sendDate,
    //   data: {
    //     firstName: this.extractFirstName(lease.tenantName),
    //     property: lease.propertyId,
    //     docusignUri: dto.docusignUri,
    //     userName: user.name,
    //     userRole: user.role,
    //     daysAgo: daysFromNow,
    //   },
    //   status: 'SCHEDULED',
    // });
    // return followUpEmail.id;

    return followUpEmailId;
  }

  /**
   * Log email activity
   */
  private async logEmailActivity(
    leaseId: string,
    dto: SendExecutionEmailDto,
    userId: string,
    emailId: string,
  ): Promise<void> {
    // TODO: Implement activity logging when Activity entity is available
    // For now, just log to console
    
    this.logger.log(
      `Email activity logged for lease ${leaseId}: sent to ${dto.to} by user ${userId}`,
    );

    // When Activity entity is available, implement:
    // await this.activityRepository.create({
    //   leaseId,
    //   type: 'EMAIL_SENT',
    //   action: 'EXECUTION_COPY_SENT',
    //   description: `Execution copy sent to ${dto.to}`,
    //   userId,
    //   metadata: {
    //     emailId,
    //     to: dto.to,
    //     cc: dto.cc,
    //     subject: dto.subject,
    //     docusignUri: dto.docusignUri,
    //     taskCreated: !!dto.taskFollowUpDays,
    //     followUpScheduled: !!dto.emailFollowUpDays,
    //   },
    //   timestamp: new Date(),
    // });
  }

  /**
   * Extract first name from full name
   */
  private extractFirstName(fullName: string): string {
    return fullName.split(' ')[0];
  }
}
