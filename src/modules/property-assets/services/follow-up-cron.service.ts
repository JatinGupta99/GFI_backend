import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivitiesService } from '../activities.service';
import { MailService } from '../../mail/mail.service';
import { EmailType } from '../../../common/enums/common-enums';

@Injectable()
export class FollowUpCronService {
    private readonly logger = new Logger(FollowUpCronService.name);

    constructor(
        private readonly activitiesService: ActivitiesService,
        private readonly mailService: MailService,
        @InjectModel('Lead') private readonly leadModel: Model<any>, // Direct model injection to avoid circular dependency
    ) {}

    /**
     * Process automated follow-ups every hour
     * Runs at the top of every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async processAutomatedFollowUps() {
        this.logger.log('Starting automated follow-up processing...');

        try {
            // Get pending automated follow-ups
            const pendingFollowUps = await this.activitiesService.getPendingAutomatedFollowUps(50);
            
            if (pendingFollowUps.length === 0) {
                this.logger.log('No pending automated follow-ups found');
                return;
            }

            this.logger.log(`Found ${pendingFollowUps.length} pending automated follow-ups`);

            let processed = 0;
            let failed = 0;

            // Process each follow-up
            for (const followUp of pendingFollowUps) {
                try {
                    await this.processFollowUp(followUp);
                    processed++;
                } catch (error) {
                    this.logger.error(`Failed to process follow-up ${followUp._id}:`, error);
                    failed++;
                }
            }

            this.logger.log(`Automated follow-up processing completed: ${processed} processed, ${failed} failed`);

        } catch (error) {
            this.logger.error('Error in automated follow-up processing:', error);
        }
    }

    /**
     * Process a single follow-up activity
     */
    private async processFollowUp(followUp: any) {
        this.logger.log(`Processing follow-up ${followUp._id} for lead ${followUp.leadId}`);

        try {
            // Get lead information using direct model access
            const lead = await this.leadModel.findById(followUp.leadId).lean().exec();
            if (!lead) {
                this.logger.warn(`Lead ${followUp.leadId} not found for follow-up ${followUp._id}`);
                // Mark as completed even if lead not found to avoid reprocessing
                await this.activitiesService.markFollowUpCompleted(String(followUp._id), 'system-cleanup');
                return;
            }

            // Get recipient email
            const recipientEmail = (lead as any).general?.email;
            if (!recipientEmail) {
                this.logger.warn(`No email found for lead ${followUp.leadId}, skipping follow-up ${followUp._id}`);
                await this.activitiesService.markFollowUpCompleted(String(followUp._id), 'system-no-email');
                return;
            }

            // Generate follow-up email content
            const emailContent = this.generateFollowUpEmailContent(lead, followUp);

            // Send follow-up email
            await this.mailService.send(EmailType.GENERAL as any, {
                email: recipientEmail,
                subject: emailContent.subject,
                body: emailContent.body,
                firstName: (lead as any).general?.firstName?.split(' ')[0] || '',
            });

            // Mark follow-up as completed
            await this.activitiesService.markFollowUpCompleted(String(followUp._id), 'automated-cron');

            this.logger.log(`Successfully processed follow-up ${followUp._id} for lead ${followUp.leadId}`);

        } catch (error) {
            this.logger.error(`Error processing follow-up ${followUp._id}:`, error);
            throw error;
        }
    }

    /**
     * Generate follow-up email content based on the original email and lead data
     */
    private generateFollowUpEmailContent(lead: any, followUp: any): { subject: string; body: string } {
        const firstName = (lead as any).general?.firstName || 'there';
        const businessName = (lead as any).general?.businessName || (lead as any).business?.businessName || '';
        const propertyInfo = (lead as any).general?.property || 'the property';
        const suiteInfo = (lead as any).general?.suite || '';
        const propertyDisplay = suiteInfo ? `${propertyInfo}, Suite ${suiteInfo}` : propertyInfo;

        // Generate subject based on original email subject
        const originalSubject = followUp.originalEmailSubject || 'Your Application';
        const subject = `Follow-up: ${originalSubject}`;

        // Generate HTML email body
        const body = `
            <div style="font-family: Arial, sans-serif; color: #334155; line-height: 1.6;">
                <p>Hi ${firstName},</p>
                
                <p style="margin-top: 16px;">
                    This is a follow-up regarding your recent inquiry about ${propertyDisplay}.
                </p>
                
                ${businessName ? `<p style="margin-top: 16px;">
                    We wanted to check in with ${businessName} to see if you have any questions 
                    or need any additional information to move forward with the leasing process.
                </p>` : ''}
                
                <p style="margin-top: 16px;">
                    If you have any questions or would like to schedule a viewing, please don't hesitate to reach out.
                </p>
                
                <p style="margin-top: 16px;">
                    We look forward to hearing from you soon.
                </p>
                
                <p style="margin-top: 24px;">
                    Best regards,<br />
                    <strong style="color: #1E293B;">Property Management Team</strong><br />
                    <span style="color: #64748B;">Global Fund Investments</span>
                </p>
                
                <hr style="margin: 32px 0; border: none; border-top: 1px solid #E2E8F0;" />
                
                <p style="font-size: 12px; color: #64748B;">
                    This is an automated follow-up email. If you no longer wish to receive these emails, 
                    please contact us directly.
                </p>
            </div>
        `;

        return { subject, body };
    }

    /**
     * Manual method to process follow-ups (for testing or manual triggers)
     */
    async processFollowUpsManually(limit: number = 10): Promise<{
        processed: number;
        failed: number;
        details: Array<{ activityId: string; status: string; error?: string }>;
    }> {
        this.logger.log(`Manual follow-up processing requested (limit: ${limit})`);

        const pendingFollowUps = await this.activitiesService.getPendingAutomatedFollowUps(limit);
        const results = {
            processed: 0,
            failed: 0,
            details: [] as Array<{ activityId: string; status: string; error?: string }>
        };

        for (const followUp of pendingFollowUps) {
            try {
                await this.processFollowUp(followUp);
                results.processed++;
                results.details.push({
                    activityId: String(followUp._id),
                    status: 'success'
                });
            } catch (error) {
                results.failed++;
                results.details.push({
                    activityId: String(followUp._id),
                    status: 'failed',
                    error: error.message
                });
            }
        }

        this.logger.log(`Manual follow-up processing completed: ${results.processed} processed, ${results.failed} failed`);
        return results;
    }
}