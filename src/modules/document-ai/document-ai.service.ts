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
        console.log('DocumentAiService: onModuleInit started');

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

        console.log(`DocumentAiService: project: ${this.projectId}, location: ${this.location}, processor: ${this.processorId}`);

        if (!this.projectId || !this.processorId) {
            console.error('DocumentAiService: Google Document AI configuration is incomplete');
            return;
        }

        try {
            const options: any = {};
            if (credentials) {
                const credPath = path.isAbsolute(credentials)
                    ? credentials
                    : path.resolve(process.cwd(), credentials);

                console.log(`DocumentAiService: Loading credentials from ${credPath}`);
                if (fs.existsSync(credPath)) {
                    options.keyFilename = credPath;
                } else {
                    console.error(`DocumentAiService: Credentials file NOT FOUND at: ${credPath}`);
                }
            }

            this.client = new DocumentProcessorServiceClient(options);
            console.log('DocumentAiService: client successfully initialized');
        } catch (error) {
            console.error('DocumentAiService: Failed to initialize client', error);
        }
    }

    async processDocument(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
        if (!this.client) {
            throw new InternalServerErrorException('Document AI client is not initialized');
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
            return { data: {}, text: document?.text || '', overallConfidence: 0 };
        }

        const extractedData: Record<string, ExtractedField> = {};
        let confidenceSum = 0;

        for (const entity of document.entities) {
            const key = this.mapEntityKey(entity.type);
            const value = entity.mentionText || entity.normalizedValue?.text || null;
            const confidence = entity.confidence ?? 0;

            // Keep highest confidence if duplicate fields appear
            if (!extractedData[key] || confidence > extractedData[key].confidence) {
                extractedData[key] = { value, confidence };
            }

            confidenceSum += confidence;
        }

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
        };

        return MAP[type?.toLowerCase()] || type;
    }
}