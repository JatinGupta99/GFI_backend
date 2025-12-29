import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ResetTokenType } from '../../../common/enums/common-enums';

export type UserResetTokenDocument = UserResetToken & Document;

@Schema({ timestamps: true })
export class UserResetToken {
  _id: string;
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  token: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  used: boolean;

  @Prop({ default: null })
  usedAt: Date;

  @Prop({ enum: ResetTokenType, required: true })
  type: ResetTokenType;
}

export const UserResetTokenSchema =
  SchemaFactory.createForClass(UserResetToken);
