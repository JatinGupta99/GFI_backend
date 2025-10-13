import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  AccountStatus,
  CompanyUserRole,
} from '../../../common/enums/common-enums';

export type CompanyUserDocument = CompanyUser & Document;

@Schema({ timestamps: true })
export class CompanyUser {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String,enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: String,
    required: true,
    enum: CompanyUserRole,
    default: CompanyUserRole.ADMIN,
  })
  role: CompanyUserRole;

  @Prop({ type: Date, default: null })
  passwordChangedAt?: Date;
}

export const CompanyUserSchema = SchemaFactory.createForClass(CompanyUser);
CompanyUserSchema.pre<CompanyUserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});
