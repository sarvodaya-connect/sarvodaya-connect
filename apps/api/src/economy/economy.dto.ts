import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  BUSINESS_STATUSES,
  ECONOMY_INDUSTRIES,
  ECONOMY_PRODUCT_CODES,
  MAX_PRODUCTION_QUANTITY,
  PRODUCTION_BASES,
  PRODUCTION_MEASUREMENTS,
  PRODUCTION_UNIT_CODES,
  type BusinessStatusValue,
  type EconomyIndustry,
  type ProductionBasisValue,
  type ProductionMeasurementValue,
} from './economy.catalogue.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Empty optional text is stored as nothing. */
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_VERSION = 2_147_483_647;

/** POST /societies/:id/businesses */
export class BusinessInputDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Enter the business name' })
  @MaxLength(150)
  name!: string;

  @IsIn(ECONOMY_INDUSTRIES, { message: 'Choose an industry from the list' })
  industry!: EconomyIndustry;

  /** Required when the industry is OTHER. */
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(150)
  otherIndustry?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(BUSINESS_STATUSES)
  status?: BusinessStatusValue;
}

/** PATCH /businesses/:id. Only the fields sent change. */
export class BusinessUpdateDto {
  @IsInt() @Min(1) @Max(MAX_VERSION) version!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Enter the business name' })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsIn(ECONOMY_INDUSTRIES, { message: 'Choose an industry from the list' })
  industry?: EconomyIndustry;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(150)
  otherIndustry?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(BUSINESS_STATUSES)
  status?: BusinessStatusValue;
}

/** POST /businesses/:id/outputs */
export class OutputInputDto {
  @IsIn(ECONOMY_PRODUCT_CODES, {
    message: 'Choose a product or service from the list',
  })
  product!: string;

  /** Required for OTHER. */
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(150)
  otherDescription?: string | null;

  /** Only for OTHER; standard products always use their own unit. */
  @IsOptional()
  @IsIn(PRODUCTION_UNIT_CODES, { message: 'Choose a unit from the list' })
  unit?: string;
}

/** PATCH /business-outputs/:id: archive or bring back an output. */
export class OutputUpdateDto {
  @IsInt() @Min(1) @Max(MAX_VERSION) version!: number;

  @IsBoolean() archived!: boolean;
}

/** POST /business-outputs/:id/production-records */
export class ProductionRecordInputDto {
  @IsOptional()
  @IsUUID('4', { message: 'clientRequestId must be a UUID' })
  clientRequestId?: string;

  @IsIn(PRODUCTION_BASES) basis!: ProductionBasisValue;

  @Matches(DATE, { message: 'startsOn must be YYYY-MM-DD' }) startsOn!: string;

  @Matches(DATE, { message: 'endsOn must be YYYY-MM-DD' }) endsOn!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(60)
  seasonLabel?: string | null;

  @IsIn(PRODUCTION_MEASUREMENTS) measurement!: ProductionMeasurementValue;

  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 },
    { message: 'Enter the quantity as a number' },
  )
  @Min(0, { message: 'The quantity cannot be negative' })
  @Max(MAX_PRODUCTION_QUANTITY)
  quantity!: number;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(150)
  source?: string | null;
}

/**
 * PATCH /production-records/:id: a correction. The period, measurement and
 * output are the record's identity and never change; a record in the wrong
 * period stays, corrected to 0, and the right one is added.
 */
export class ProductionCorrectionDto {
  @IsInt() @Min(1) @Max(MAX_VERSION) version!: number;

  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 },
    { message: 'Enter the quantity as a number' },
  )
  @Min(0, { message: 'The quantity cannot be negative' })
  @Max(MAX_PRODUCTION_QUANTITY)
  quantity!: number;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(60)
  seasonLabel?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(150)
  source?: string | null;
}

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/**
 * GET /economic-profile/production: one exact period and one measurement.
 * `districtId` and `societyId` narrow the caller's scope; they never widen it.
 */
export class ProductionSummaryQueryDto {
  @IsIn(PRODUCTION_BASES) basis!: ProductionBasisValue;

  @Matches(DATE, { message: 'startsOn must be YYYY-MM-DD' }) startsOn!: string;

  @Matches(DATE, { message: 'endsOn must be YYYY-MM-DD' }) endsOn!: string;

  @IsOptional()
  @IsIn(PRODUCTION_MEASUREMENTS)
  measurement?: ProductionMeasurementValue;

  @IsOptional()
  @IsIn(ECONOMY_PRODUCT_CODES)
  product?: string;

  /** The business's industry (issue #147). */
  @IsOptional()
  @IsIn(ECONOMY_INDUSTRIES)
  industry?: EconomyIndustry;

  @IsOptional() @IsUUID() districtId?: string;

  @IsOptional() @IsUUID() societyId?: string;
}

/** GET /economic-profile/production-records: a list, never a total. */
export class ProductionListQueryDto extends PageQueryDto {
  /**
   * Issue #147: with `startsOn` and `endsOn`, only records for exactly that
   * period, the same rows a summary counts. `from`/`to` instead list every
   * record whose period touches the range.
   */
  @IsOptional() @IsIn(PRODUCTION_BASES) basis?: ProductionBasisValue;

  @IsOptional()
  @Matches(DATE, { message: 'startsOn must be YYYY-MM-DD' })
  startsOn?: string;

  @IsOptional()
  @Matches(DATE, { message: 'endsOn must be YYYY-MM-DD' })
  endsOn?: string;

  @IsOptional()
  @IsIn(ECONOMY_INDUSTRIES)
  industry?: EconomyIndustry;

  @IsOptional()
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @IsOptional()
  @IsIn(PRODUCTION_MEASUREMENTS)
  measurement?: ProductionMeasurementValue;

  @IsOptional()
  @IsIn(ECONOMY_PRODUCT_CODES)
  product?: string;

  @IsOptional() @IsUUID() districtId?: string;

  @IsOptional() @IsUUID() societyId?: string;
}

/** GET /economic-profile/scope (issue #147): the filter choices. */
export class EconomyScopeQueryDto {
  @IsOptional() @IsUUID() districtId?: string;
}
