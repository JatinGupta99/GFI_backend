import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResetTokenType } from '../../../common/enums/common-enums';
import {
  UserResetToken,
  UserResetTokenDocument,
} from '../schema/user-reset-token.schema';

@Injectable()
export class UserResetTokenRepository {
  constructor(
    @InjectModel(UserResetToken.name)
    private readonly model: Model<UserResetTokenDocument>,
  ) {}

  async create(
    userId: string,
    email: string,
    token: string,
    expiresAt: Date,
    type: ResetTokenType,
  ) {
    await this.model.updateMany(
      { userId, used: false },
      { used: true, usedAt: new Date() },
    );
    return new this.model({ userId, email, token, expiresAt, type }).save();
  }

  findByToken(token: string) {
    return this.model.findOne({ token });
  }

  async markTokenUsed(id: string, type: ResetTokenType) {
    const token = await this.model.findById(id);
    if (!token) throw new BadRequestException('Token not found');
    token.used = true;
    token.usedAt = new Date();
    token.type = type;
    return token.save();
  }

  removeExpiredTokens() {
    return this.model.deleteMany({
      expiresAt: { $lt: new Date() },
      used: false,
    });
  }
}
