import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  SOCIETY_GRADE_VALUES,
  type SocietyGradeValue,
} from './society-updates.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Largest yearly total accepted, in LKR. */
export const MAX_YEARLY_AMOUNT = 999_999_999_999;

/** M06f: two yearly totals in LKR with at most two decimal places. */
export class AnnualSummaryUpdateDto {
  /** A loss is entered as a negative profit. */
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'totalProfit must be a number, for example 412500' },
  )
  @Min(-MAX_YEARLY_AMOUNT)
  @Max(MAX_YEARLY_AMOUNT)
  totalProfit!: number;

  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'totalExpenses must be a number, for example 1286000' },
  )
  @Min(0)
  @Max(MAX_YEARLY_AMOUNT)
  totalExpenses!: number;
}

export class FinancialYearQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;
}

/** M06g. */
export class GradeChangeRequestDto {
  @IsIn(SOCIETY_GRADE_VALUES) toGrade!: SocietyGradeValue;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Explain the reason in at least 10 characters' })
  @MaxLength(500)
  reason!: string;
}

/** HQ decision on a grade-change request. A comment is required to reject. */
export class GradeDecisionDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export const HISTORY_CATEGORY_VALUES = [
  'SOCIETY',
  'EXCO',
  'WORK_PLAN',
  'ANNUAL_SUMMARY',
  'GRADE',
  'DOCUMENTS',
] as const;
export type HistoryCategoryValue = (typeof HISTORY_CATEGORY_VALUES)[number];

export class SocietyHistoryQueryDto {
  @IsOptional() @IsIn(HISTORY_CATEGORY_VALUES) category?: HistoryCategoryValue;
}

export class WorkPlanQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;
}
