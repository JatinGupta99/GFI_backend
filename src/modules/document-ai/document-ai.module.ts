import { Module } from '@nestjs/common';
import { DocumentAiService } from './document-ai.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [DocumentAiService],
    exports: [DocumentAiService],
})
export class DocumentAiModule { }
