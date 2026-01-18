import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class FileInfo {
    @Prop({ default: '' })
    id: string;

    @Prop({ default: '' })
    fileName: string;

    @Prop({ default: '' })
    uploadedBy: string;

    @Prop({ default: null })
    uploadedDate: Date;

    @Prop({ default: 0 })
    fileSize: number;

    @Prop({ default: '' })
    fileType: string;

    @Prop({ default: 'other' })
    category: string;
}

export const FileInfoSchema = SchemaFactory.createForClass(FileInfo);
