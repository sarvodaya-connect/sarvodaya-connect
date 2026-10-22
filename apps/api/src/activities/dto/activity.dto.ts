import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

const dimensions = ['SOCIAL', 'ECONOMIC', 'GOVERNANCE'] as const;
export class ActivityInputDto {
  @IsUUID() societyId!: string;
  @IsString() @MaxLength(160) title!: string;
  @IsString() @MaxLength(4000) description!: string;
  @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) activityDate!: string;
  @IsString() @MaxLength(255) location!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsString() @MaxLength(80) sector!: string;
  @IsIn(dimensions) dimension!: (typeof dimensions)[number];
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(17, { each: true })
  sdgs?: number[];
  @IsInt() @Min(0) @Max(1000000) femaleParticipants!: number;
  @IsInt() @Min(0) @Max(1000000) maleParticipants!: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) otherParticipants = 0;
  @IsOptional() @IsString() @MaxLength(4000) outcomes?: string;
}

export class ActivityQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
  @IsOptional() @IsUUID() societyId?: string;
  @IsOptional() @IsUUID() districtId?: string;
  @IsOptional() @IsString() @MaxLength(80) sector?: string;
  @IsOptional() @IsIn(dimensions) dimension?: (typeof dimensions)[number];
  @IsOptional()
  @IsIn([
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'CHANGES_REQUESTED',
    'RESUBMITTED',
    'APPROVED',
    'REJECTED',
  ])
  status?: string;
  @IsOptional() @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}
