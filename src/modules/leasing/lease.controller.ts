import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { LeaseEmailService } from './services/lease-email.service';
import { SendExecutionEmailDto } from './dto/send-execution-email.dto';

@Controller('leases')
export class LeaseController {
  private readonly logger = new Logger(LeaseController.name);

  constructor(private readonly leaseEmailService: LeaseEmailService) {}

  /**
   * Send lease execution email
   * POST /leases/:leaseId/send-execution-email
   * 
   * Sends a custom email with lease execution copy and DocuSign link
   */
  @Post(':leaseId/send-execution-email')
  @HttpCode(HttpStatus.OK)
  async sendExecutionEmail(
    @Param('leaseId') leaseId: string,
    @Body() dto: SendExecutionEmailDto,
    @Req() req: any,
  ): Promise<{
    success: boolean;
    message: string;
    emailId?: string;
    taskId?: string;
    followUpEmailId?: string;
  }> {
    this.logger.log(`Received request to send execution email for lease ${leaseId}`);

    try {
      // Validate lease ID
      if (!leaseId || leaseId.trim() === '') {
        throw new BadRequestException('Lease ID is required');
      }

      // Get user from request (set by auth middleware)
      const user = req.user;
      if (!user) {
        throw new BadRequestException('User not authenticated');
      }

      // Send execution email
      const result = await this.leaseEmailService.sendExecutionEmail(
        leaseId,
        dto,
        user,
      );

      this.logger.log(
        `Successfully sent execution email for lease ${leaseId} to ${dto.to}`,
      );

      return {
        success: true,
        message: 'Email sent successfully',
        ...result,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to send execution email for lease ${leaseId}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        `Failed to send email: ${error.message}`,
      );
    }
  }
}
