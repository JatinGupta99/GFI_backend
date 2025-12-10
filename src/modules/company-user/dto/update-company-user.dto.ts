import { PartialType } from '@nestjs/swagger';
import { CreateCompanyUserDto } from './create-company-user.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/isStrongPassword';

export class UpdateCompanyUserDto extends PartialType(CreateCompanyUserDto) {
    @IsOptional()
    @IsString({ message: 'Password must be a string' })
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @IsStrongPassword()
    password?: string;
}
