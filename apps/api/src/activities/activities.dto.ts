import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
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

import { MAX_YEARLY_AMOUNT } from '../societies/dto/society-record.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Empty optional text is stored as nothing. */
const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export const ACTIVITY_DIMENSION_VALUES = [
  'SOCIAL',
  'ECONOMIC',
  'GOVERNANCE',
] as const;
export type ActivityDimensionValue = (typeof ACTIVITY_DIMENSION_VALUES)[number];

/** Largest count of people or households accepted for one activity. */
const MAX_PEOPLE = 100_000;

function OptionalCount() {
  return function (target: object, key: string) {
    IsOptional()(target, key);
    IsInt({ message: `${key} must be a whole number` })(target, key);
    Min(0)(target, key);
    Max(MAX_PEOPLE)(target, key);
  };
}

/** M09a–M09c: an activity the Society Officer sends to the SPC. */
export class ActivityInputDto {
  @IsInt() @Min(2000) @Max(2200) year!: number;

  @IsInt() @Min(1) @Max(12) month!: number;

  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Enter the activity name' })
  @MaxLength(150)
  name!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Describe the activity in at least 10 characters' })
  @MaxLength(1000)
  description!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Choose the sector' })
  @MaxLength(100)
  sector!: string;

  @IsIn(ACTIVITY_DIMENSION_VALUES) dimension!: ActivityDimensionValue;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(60)
  datesLabel?: string;

  /** Planning amount in LKR, not a payment. */
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'allocatedCost must be a number, for example 55000' },
  )
  @Min(0)
  @Max(MAX_YEARLY_AMOUNT)
  allocatedCost!: number;

  @OptionalCount() femaleParticipants?: number;
  @OptionalCount() maleParticipants?: number;
  @OptionalCount() youthParticipants?: number;
  @OptionalCount() householdsBenefited?: number;
  @OptionalCount() womenHeadedHouseholds?: number;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(500)
  partners?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(500)
  resourcesNeeded?: string;

  @OptionalCount() volunteerHours?: number;
}

/** SP07 / M51: at least one UN SDG, numbers 1–17, each once. */
export class ApproveActivityDto {
  @ArrayMinSize(1, { message: 'Choose at least one UN SDG to approve' })
  @ArrayMaxSize(17)
  @ArrayUnique({ message: 'Choose each UN SDG only once' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Each UN SDG is a number from 1 to 17' })
  @Min(1, { each: true, message: 'Each UN SDG is a number from 1 to 17' })
  @Max(17, { each: true, message: 'Each UN SDG is a number from 1 to 17' })
  sdgs!: number[];
}

/** M51b: what the Society Officer should change. */
export class SendBackActivityDto {
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(500)
  comment?: string;
}
