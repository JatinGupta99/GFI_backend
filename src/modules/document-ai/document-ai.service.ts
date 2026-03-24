import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import * as path from 'path';
import * as fs from 'fs';

interface ExtractedField {
    value: string | null;
    confidence: number;
}

interface ExtractionResult {
    data: Record<string, ExtractedField>;
    text: string;
    overallConfidence: number;
}

@Injectable()
export class DocumentAiService implements OnModuleInit {
    private client?: DocumentProcessorServiceClient;
    private readonly logger = new Logger(DocumentAiService.name);
    private projectId!: string;
    private location!: string;
    private processorId!: string;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {

        this.projectId = this.configService.get<string>('docAi.projectId') ||
            this.configService.get<string>('GOOGLE_DOCUMENT_AI_PROJECT_ID') ||
            process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID || '';

        this.location = this.configService.get<string>('docAi.location') ||
            this.configService.get<string>('GOOGLE_DOCUMENT_AI_LOCATION') ||
            process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us';

        this.processorId = this.configService.get<string>('docAi.processorId') ||
            this.configService.get<string>('GOOGLE_DOCUMENT_AI_PROCESSOR_ID') ||
            process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || '';

        const credentials = this.configService.get<string>('docAi.credentials') ||
            this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS') ||
            process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (!this.projectId || !this.processorId) {
            return;
        }

        try {
            const options: any = {};
            if (credentials) {
                const credPath = path.isAbsolute(credentials)
                    ? credentials
                    : path.resolve(process.cwd(), credentials);
                if (fs.existsSync(credPath)) {
                    options.keyFilename = credPath;
                } else {
                }
            }

            this.client = new DocumentProcessorServiceClient(options);
        } catch (error) {
        }
    }

    async processDocument(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
        if (!this.client) {
            throw new InternalServerErrorException('Document AI client is not initialized');
        }

        const SUPPORTED_TYPES = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/tiff',
            'image/gif',
            'image/bmp',
            'image/webp',
        ];

        if (!SUPPORTED_TYPES.includes(mimeType)) {
            throw new InternalServerErrorException(
                `Unsupported file format: "${mimeType}". Document AI supports PDF, Word (.docx), and images. Excel files are not supported.`,
            );
        }

        const name = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`;

        try {
            const [result] = await this.client.processDocument({
                name,
                rawDocument: {
                    content: buffer.toString('base64'),
                    mimeType,
                },
            });

            return this.mapEntities(result.document);
        } catch (error) {
            this.logger.error('Failed to process document with Document AI', error);
            throw new InternalServerErrorException('Document processing failed');
        }
    }

    private mapEntities(document: any): ExtractionResult {
        if (!document?.entities?.length) {
            this.logger.warn('Document AI returned no entities');
            return { data: {}, text: document?.text || '', overallConfidence: 0 };
        }

        const extractedData: Record<string, ExtractedField> = {};
        let confidenceSum = 0;

        this.logger.log(`=== Document AI Raw Entities (${document.entities.length} total) ===`);

        for (const entity of document.entities) {
            const rawType = entity.type;
            const key = this.mapEntityKey(rawType);
            const value = entity.mentionText || entity.normalizedValue?.text || null;
            const confidence = entity.confidence ?? 0;

            this.logger.log(`  [RAW] type="${rawType}" -> key="${key}" | value="${value}" | confidence=${confidence.toFixed(3)}`);

            // Keep highest confidence if duplicate fields appear
            if (!extractedData[key] || confidence > extractedData[key].confidence) {
                extractedData[key] = { value, confidence };
            }

            confidenceSum += confidence;
        }

        this.logger.log(`=== End Raw Entities ===`);
        this.logger.log(`=== Mapped Fields (${Object.keys(extractedData).length} unique) ===`);
        for (const [key, field] of Object.entries(extractedData)) {
            this.logger.log(`  ${key}: "${field.value}" (confidence: ${field.confidence.toFixed(3)})`);
        }
        this.logger.log(`=== End Mapped Fields | Overall Confidence: ${(confidenceSum / document.entities.length).toFixed(3)} ===`);

        return {
            data: extractedData,
            text: document.text || '',
            overallConfidence: confidenceSum / document.entities.length,
        };
    }

    /**
     * Explicit mapping prevents processor changes from breaking your system
     */
    private mapEntityKey(type: string): string {
        const MAP: Record<string, string> = {
            // Generic person fields
            first_name: 'firstName',
            given_name: 'firstName',
            last_name: 'lastName',
            family_name: 'lastName',
            email: 'email',
            email_address: 'email',
            phone: 'phone',
            phone_number: 'phone',
            organization: 'company',
            company: 'company',

            // LOI / Lease fields (exact names from Document AI processor)
            annual_increase: 'annual_increase',
            base_rent: 'base_rent',
            contingencies: 'contingencies',
            exclusive_use: 'exclusive_use',
            free_rent_months: 'free_rent_months',
            guarantor: 'guarantor',
            landlord: 'landlord',
            landlord_name: 'landlord_name',
            lease_commencement_date: 'lease_commencement_date',
            lease_term: 'lease_term',
            leased_premises_description: 'leased_premises_description',
            negotiation_period: 'negotiation_period',
            nnn_fees: 'nnn_fees',
            permitted_use: 'permitted_use',
            possession_date: 'possession_date',
            pre_paid_rent: 'pre_paid_rent',
            property_name: 'property_name',
            proposal_date: 'proposal_date',
            renewal_options: 'renewal_options',
            rent_commencement_date: 'rent_commencement_date',
            rent_escalation: 'rent_escalation',
            rent_psf: 'rent_psf',
            security_deposit: 'security_deposit',
            sf: 'sf',
            square_footage: 'square_footage',
            suite: 'suite',
            tenant_improvement_allowance: 'tenant_improvement_allowance',
            tenant_improvement_psf: 'tenant_improvement_psf',
            tenant_name: 'tenant_name',
            tenant_trade_name: 'tenant_trade_name',
            tenantname: 'tenantName',
            use: 'use',
        };

        return MAP[type?.toLowerCase()] || type;
    }
}