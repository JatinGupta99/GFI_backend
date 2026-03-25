import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitApprovalDto {
  @IsNotEmpty()
  @IsString()
  submittedBy: string;

  @IsNotEmpty()
  @IsString()
  submittedTo: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
