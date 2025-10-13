import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string | string[],
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ statusCode, message }, statusCode);
  }
}
