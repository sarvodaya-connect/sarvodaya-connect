import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const statuses = ['ACTIVE', 'INACTIVE', 'UNDER_REVIEW', 'SUSPENDED'] as const;
const verificationStatuses = ['UNVERIFIED', 'PENDING', 'VERIFIED'] as const;
export class SocietyQueryDto {
  @IsOptional() @Transform(({ value }: { value: unknown }) => Number(value)) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Transform(({ value }: { value: unknown }) => Number(value)) @IsInt() @Min(1) @Max(100)
  pageSize = 10;
  @IsOptional() @IsString() @MaxLength(150)
  search?: string;
  @IsOptional() @IsUUID()
  districtId?: string;
  @IsOptional() @IsIn(statuses)
  status?: (typeof statuses)[number];
  @IsOptional() @IsIn(verificationStatuses)
  verificationStatus?: (typeof verificationStatuses)[number];
}
