import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';

export class AttachmentUpdateDto {
    @ApiProperty({ example: 'tasks/123/file.pdf' })
    @IsString()
    @IsNotEmpty()
    key: string;

    @ApiProperty({ example: 'document.pdf' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'application/pdf' })
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiProperty({ example: 1024000 })
    @IsNumber()
    size: number;
}

export class UpdateAttachmentsDto {
    @ApiProperty({ type: [AttachmentUpdateDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentUpdateDto)
    attachments: AttachmentUpdateDto[];
}
