import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const statuses = ['ACTIVE', 'INACTIVE', 'UNDER_REVIEW', 'SUSPENDED'] as const;
const verificationStatuses = ['UNVERIFIED', 'PENDING', 'VERIFIED'] as const;
const grades = ['A', 'B', 'C'] as const;
const freshnessValues = ['RECENT', 'STALE'] as const;
const gradeRequestValues = ['OPEN', 'NONE'] as const;
export class SocietyQueryDto {
  @IsOptional() @Transform(({ value }: { value: unknown }) => Number(value)) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Transform(({ value }: { value: unknown }) => Number(value)) @IsInt() @Min(1) @Max(100)
  pageSize = 10;
  @IsOptional() @IsString() @MaxLength(150)
  search?: string;
  @IsOptional() @IsUUID()
  districtId?: string;
  @IsOptional() @IsString() @MaxLength(100)
  dsDivision?: string;
  @IsOptional() @IsIn(statuses)
  status?: (typeof statuses)[number];
  @IsOptional() @IsIn(grades)
  grade?: (typeof grades)[number];
  @IsOptional() @IsString() @MaxLength(64)
  spcUserId?: string;
  @IsOptional() @IsIn(freshnessValues)
  freshness?: (typeof freshnessValues)[number];
  @IsOptional() @IsIn(gradeRequestValues)
  gradeRequest?: (typeof gradeRequestValues)[number];
  @IsOptional() @IsIn(verificationStatuses)
  verificationStatus?: (typeof verificationStatuses)[number];
}
