import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class GetUploadUrlDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    propertyId: string;

    @IsString()
    @IsOptional()
    attachmentId?: string;

    @IsString()
    @IsNotEmpty()
    contentType: string;
}

export class CreateAttachmentDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    fileKey: string;
    @IsString()
    @IsNotEmpty()
    fileSize: string;
    @IsString()
    @IsNotEmpty()
    fileType: string;

    @IsString()
    @IsNotEmpty()
    propertyId: string;

    @IsString()
    @IsOptional()
    category?: string;

    @IsString()
    @IsNotEmpty()
    createdBy: string;
}
