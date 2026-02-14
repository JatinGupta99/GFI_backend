import { IsString, IsNotEmpty } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class GetRenewalsQueryDto extends PaginationQueryDto {
    @IsString()
    @IsNotEmpty()
    propertyId: string;
}
