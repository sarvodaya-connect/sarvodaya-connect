import { IsISO8601, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDistrictDelegationDto {
  @IsString() @MinLength(1) @MaxLength(64) deputyUserId!: string;
  @IsUUID() districtId!: string;
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsISO8601({ strict: true }) endsAt!: string;
}
