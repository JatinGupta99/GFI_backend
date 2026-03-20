import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class GetRenewalsQueryDto extends PaginationQueryDto {
    @IsString()
    @IsNotEmpty()
    propertyId: string;

    @IsOptional()
    minimal:string;
}
