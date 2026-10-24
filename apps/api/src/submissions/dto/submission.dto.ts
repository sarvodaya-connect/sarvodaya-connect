import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { SUBMISSION_STATUSES, type SubmissionStatus } from '../submission-transitions.js';

export const SUBMISSION_TYPES = [
  'COUNCIL_UPDATE',
  'PROFILE_UPDATE',
  'MEMBERSHIP_COUNTS',
  'ACTIVITY_REPORT',
  'PAYMENT',
] as const;
export type SubmissionTypeValue = (typeof SUBMISSION_TYPES)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SubmissionChangeInputDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  field: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  label: string;

  @IsOptional()
  previousValue?: unknown;

  @IsDefined()
  proposedValue: unknown;
}

export class CreateSubmissionDto {
  @IsUUID()
  societyId: string;

  @IsIn(SUBMISSION_TYPES)
  type: SubmissionTypeValue;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SubmissionChangeInputDto)
  changes: SubmissionChangeInputDto[];
}

/** Every action sends the version it last saw; a stale value returns 409. */
export class SubmissionActionDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ReturnedFieldDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  field: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'comment is required for each returned field' })
  @MaxLength(1000)
  comment: string;
}

export class RequestChangesDto extends SubmissionActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnedFieldDto)
  fields: ReturnedFieldDto[];
}

export class CorrectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  field: string;

  @IsDefined()
  correctedValue: unknown;
}

export class ResubmitDto extends SubmissionActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CorrectionDto)
  corrections: CorrectionDto[];
}

export class SubmissionQueryDto {
  @IsOptional()
  @IsIn(SUBMISSION_STATUSES)
  status?: SubmissionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}