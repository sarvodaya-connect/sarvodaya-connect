import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ArrayUnique,
} from 'class-validator';
import { USER_ROLES } from '../auth/principal.js';
export class AccountDetailsDto {
  @IsString() @Length(2, 150) displayName: string;
  @Matches(/^[a-z0-9][a-z0-9._-]{2,99}$/) username: string;
  @IsString() @Length(7, 30) phone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsIn(USER_ROLES) role: (typeof USER_ROLES)[number];
  @IsOptional() @IsUUID() districtId?: string;
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) societyIds: string[];
}
export class CreateAccountDto extends AccountDetailsDto {
  @IsString() @Length(10, 128) @Matches(/\d/) password: string;
}
export class UpdateAccountDto extends AccountDetailsDto {}
export class SetAccountPasswordDto {
  @IsString() @Length(10, 128) @Matches(/\d/) password: string;
}
export class LoginDto {
  @IsString() @Length(1, 100) username: string;
  @IsString() @Length(1, 200) password: string;
}
export class GrantDistrictAccessDto {
  @IsUUID() deputyId: string;
  @IsUUID() districtId: string;
  @IsISO8601({ strict: true }) startsAt: string;
  @IsISO8601({ strict: true }) expiresAt: string;
  @IsString() @Length(3, 1000) reason: string;
}

/** V5 D24 log groups; each covers the audit actions listed in identity.service.ts. */
export const AUDIT_TYPES = [
  'SOCIETY',
  'EXCO',
  'GRADE',
  'ACCOUNTS',
  'ACCESS',
  'RECORDS',
  'ASSISTANT',
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

export class AuditQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() districtId?: string;
  @IsOptional() @IsIn(AUDIT_TYPES) type?: AuditType;
  @IsOptional() @IsIn(USER_ROLES) role?: (typeof USER_ROLES)[number];
  @IsOptional() @Type(() => Number) @IsIn([1, 7, 30, 90, 365]) days?: number;
}
