import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AccountStatus, CompanyUserRole } from '../../../common/enums/common-enums';

export type CompanyUserDocument = CompanyUser & Document;

@Schema({ timestamps: true })
export class CompanyUser {
  _id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ enum: CompanyUserRole, default: CompanyUserRole.OWNER })
  role: CompanyUserRole;

  @Prop({ enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Prop({ required: false, default: '' })
  password: string;

  @Prop({ required: false, default: '' })
  phone_no: string;

  @Prop({ required: false, default: null })
  avatar: string;

  @Prop({ type: Date, default: null })
  passwordChangedAt?: Date;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date;

  @Prop({ type: String, default: null })
  deletedBy: string;
}

export const CompanyUserSchema = SchemaFactory.createForClass(CompanyUser);

CompanyUserSchema.pre<CompanyUserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
  next();
});

CompanyUserSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as any;

  if (!update) return next();

  if (update.password) {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const salt = await bcrypt.genSalt(saltRounds);
    update.password = await bcrypt.hash(update.password, salt);
    update.passwordChangedAt = new Date();
  }

  if (update.$set && update.$set.password) {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const salt = await bcrypt.genSalt(saltRounds);
    update.$set.password = await bcrypt.hash(update.$set.password, salt);
    update.$set.passwordChangedAt = new Date();
  }

  next();
});
