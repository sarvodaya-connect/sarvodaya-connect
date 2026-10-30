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
export class IssueInvitationDto {
  @IsIn(['LINK', 'TEMPORARY_PASSWORD']) method: 'LINK' | 'TEMPORARY_PASSWORD';
}
export class LoginDto {
  @IsString() @Length(1, 100) username: string;
  @IsString() @Length(1, 200) password: string;
}
export class ActivationCheckDto {
  @IsString() @Length(1, 200) credential: string;
  @IsOptional() @IsString() @MaxLength(100) username?: string;
}
export class ActivateAccountDto extends ActivationCheckDto {
  @IsString() @Length(10, 128) password: string;
}
export class GrantDistrictAccessDto {
  @IsUUID() deputyId: string;
  @IsUUID() districtId: string;
  @IsISO8601({ strict: true }) startsAt: string;
  @IsISO8601({ strict: true }) expiresAt: string;
  @IsString() @Length(3, 1000) reason: string;
}
