import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddRenewalNoteDto {
    @IsString()
    @IsNotEmpty()
    noteText: string;

    @IsString()
    @IsOptional()
    noteReference1?: string;

    @IsString()
    @IsOptional()
    noteReference2?: string;
}
