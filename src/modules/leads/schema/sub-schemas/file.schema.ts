import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LeadStatus } from '../../../../common/enums/common-enums';

@Schema({ _id: false })
export class FileInfo {
    @Prop({ default: '' })
    id: string;

    @Prop({ default: '' })
    fileName: string;
    
    @Prop({ default: '' })
    key: string;

    @Prop({ default: '' })
    uploadedBy: string;

    @Prop({ default: null })
    uploadedDate: Date;

    @Prop({ default: '' })
    updatedBy: string;

    @Prop({ default: null })
    updatedAt: Date;

    @Prop({ default: 0 })
    fileSize: number;

    @Prop({ default: '' })
    fileType: string;

    @Prop({ default: 'other' })
    category: string;

    @Prop({ default: LeadStatus.PENDING })
    processingStatus: LeadStatus; // PENDING, PROCESSED, FAILED

    @Prop({ default: 0 })
    confidence: number;

    @Prop({ type: Object, default: {} })
    extractedData: any;
}

export const FileInfoSchema = SchemaFactory.createForClass(FileInfo);
