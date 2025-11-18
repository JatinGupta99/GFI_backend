import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { LeadStatus } from "../../../common/enums/common-enums";
import { Transform } from "class-transformer";

const trim = () =>
  Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  );

const toLower = () =>
  Transform(({ value }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  );

const E164_REGEX = /^\+?[1-9]\d{1,14}$/;

export class CreateLeadDto {
  @trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @toLower()
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  @trim()
  @IsOptional()
  @Matches(E164_REGEX, {
    message: "cellPhone must be in E.164-ish format (e.g. +123456789).",
  })
  cellPhone?: string;

  @trim()
  @IsOptional()
  @Matches(E164_REGEX, {
    message: "workPhone must be in E.164-ish format (e.g. +123456789).",
  })
  workPhone?: string;

  @trim()
  @IsOptional()
  @MaxLength(200)
  businessName?: string;

  @trim()
  @IsOptional()
  @MaxLength(300)
  mailingAddress?: string;

  @trim()
  @IsOptional()
  @MaxLength(100)
  use?: string;

  @trim()
  @IsOptional()
  @MaxLength(200)
  property?: string;

  @trim()
  @IsOptional()
  @MaxLength(50)
  suite?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status: LeadStatus = LeadStatus.PROSPECT;

  @trim()
  @IsOptional()
  @MaxLength(2000)
  notes: string = "Note";
}
