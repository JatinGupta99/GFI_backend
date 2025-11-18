import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CompanyUserRole } from '../../../common/enums/common-enums';
export type CompanyUserDocument = CompanyUser & Document;

@Schema({ timestamps: true })
export class CompanyUser {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String })
  status: string;

  @Prop({ required: true })
  password: string;
  
@Prop({
  required: true,
  type: String,
  enum: CompanyUserRole,
})
role: CompanyUserRole;


  @Prop({ type: Date, default: null })
  passwordChangedAt?: Date;

  @Prop({ type: String, default: null })
  avatar?: string;
}

export const CompanyUserSchema = SchemaFactory.createForClass(CompanyUser);
CompanyUserSchema.pre<CompanyUserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10);
    const salt = await bcrypt.genSalt(saltRounds);

    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});
