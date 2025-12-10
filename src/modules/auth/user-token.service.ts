import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt } from 'crypto';
import { EmailType, ResetTokenType } from '../../common/enums/common-enums';
import { UserResetTokenRepository } from './repository/user-reset-token.repository';
import { UserResetToken } from './schema/user-reset-token.schema';
import { MailService } from '../mail/mail.service';
@Injectable()
export class UserTokenService {
    private readonly logger = new Logger(UserTokenService.name);
    private readonly resetTokenExpiryMinutes: number;

    constructor(
        private readonly configService: ConfigService,
        private readonly resetTokenRepo: UserResetTokenRepository,
        private readonly mailService: MailService,
    ) {
        this.resetTokenExpiryMinutes =
            Number(this.configService.get('RESET_TOKEN_EXPIRY_MINUTES')) || 15;
    }

    /**
     * Generate a random token with hash and expiry
     */
    private generateToken() {
        const plainToken = randomBytes(32).toString('hex');
        const hashedToken = createHash('sha256').update(plainToken).digest('hex');
        const expiresAt = new Date(Date.now() + this.resetTokenExpiryMinutes * 60 * 1000);
        return { plainToken, hashedToken, expiresAt };
    }

    /**
     * Validate a token of any type
     */
    async validateToken(token: string, type: ResetTokenType): Promise<UserResetToken> {
        const hashedToken = createHash('sha256').update(token).digest('hex');
        const record = await this.resetTokenRepo.findByToken(hashedToken);
        if (!record || record.used || record.expiresAt < new Date() || record.type !== type) {
            throw new BadRequestException('Invalid or expired token');
        }
        return record;
    }

    /**
     * Request a token for password reset or account setup
     * @param userId - User's ID
     * @param email - User's email
     * @param name - User's name (for email personalization)
     * @param type - Type of token (RESET or SETUP)
     */
    async requestToken(
        userId: string,
        email: string,
        name: string,
        type: ResetTokenType,
    ) {
        this.logger.debug(`requestToken called for email: ${email}, type: ${type}`);

        this.logger.debug(`User found: ${userId}, generating token...`);
        const { plainToken, hashedToken, expiresAt } = this.generateToken();

        this.logger.debug(`Token generated, saving to database...`);
        await this.resetTokenRepo.create(userId, email, hashedToken, expiresAt, type);

        const payload = {
            email,
            name,
            token: plainToken,
        };

        this.logger.debug(`Attempting to send ${type} email to ${email}`);

        try {
            if (type === ResetTokenType.RESET) {
                await this.mailService.send(EmailType.PASSWORD_RESET, payload);
                this.logger.log(`Password reset email sent successfully to ${email}`);
            } else if (type === ResetTokenType.SETUP) {
                await this.mailService.send(EmailType.SETUP_ACCOUNT, payload);
                this.logger.log(`Setup account email sent successfully to ${email}`);
            }
        } catch (error) {
            this.logger.error(`Failed to send email to ${email}:`, error);
            throw error;
        }
    }

    async sendOtp(userId: string, email: string, name: string) {
    const otp = randomInt(1000, 10000).toString();

        const hashedOtp = createHash('sha256').update(otp).digest('hex');
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

        await this.resetTokenRepo.create(
            userId,
            email,
            hashedOtp,
            expiresAt,
            ResetTokenType.OTP,
        );
        
        await this.mailService.send(EmailType.LOGIN_OTP, {
          email,
          otp,
          name
          ,  year: new Date().getFullYear(),
        });

        this.logger.log(`OTP sent successfully to ${email}`);
        return { message: 'OTP sent successfully' };
    }

    /**
     * Verify OTP for login
     * @param otp - The OTP to verify
     * @param email - User's email
     */
    async verifyOtp(otp: string, email: string) {
        const hashedOtp = createHash('sha256').update(otp).digest('hex');
        const record = await this.resetTokenRepo.findByToken(hashedOtp);

        if (!record || record.used || record.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired OTP');
        }

        if (record.email !== email) {
            throw new BadRequestException('Invalid OTP for user');
        }

        await this.resetTokenRepo.markTokenUsed(record._id.toString(), ResetTokenType.OTP);

        return { verified: true };
    }

    /**
     * Mark a token as used
     */
    async markTokenUsed(tokenId: string, type: ResetTokenType) {
        return this.resetTokenRepo.markTokenUsed(tokenId, type);
    }
}
