import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { DocumentAiService } from '../document-ai/document-ai.service';
import { MediaService } from '../media/media.service';
import { JOBNAME, LeadStatus } from '../../common/enums/common-enums';

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
                const buffer = await this.mediaService.getFileBuffer(fileKey);

                this.logger.debug(`Sending to Document AI`);
                const extractionResult = await this.documentAiService.processDocument(buffer, mimeType);

                this.logger.debug(`Extraction complete, updating lead`);
                
                // Route to appropriate update method based on document type
                if (documentType === 'loi') {
                    console.log(extractionResult,'casnlkcnsa')
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
