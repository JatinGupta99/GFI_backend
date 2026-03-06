import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SignatureUploadDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Content type must be image/jpeg, image/png, or image/webp',
  })
  contentType: string;
}
