import { IsString } from 'class-validator';

export class EnvelopeResponseDto {
  @IsString()
  envelopeId: string;

  @IsString()
  status: string;

  @IsString()
  statusDateTime: string;

  @IsString()
  uri: string;
}
