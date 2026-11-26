import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ActivityCategory,
  ActivityDimension,
} from '../generated/prisma/enums.js';

const toInt = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

/**
 * Issue #173: a filter given once, repeated (`?dimension=SOCIAL&dimension=
 * ECONOMIC`) or comma separated, as a list with each value once. Validation
 * then rejects any value that is not a supported code.
 */
const toList = ({ value }: { value: unknown }) => {
  if (value === undefined || value === '') return undefined;
  const items = (Array.isArray(value) ? value : [value])
    .flatMap((item: unknown) =>
      typeof item === 'string' ? item.split(',') : [item],
    )
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
    .filter((item: unknown) => item !== '');
  return [...new Set(items)];
};

export const DIRECTORY_VIEW_VALUES = [
  'all',
  'not-updated',
  'figures-not-added',
  'audit-past-due',
] as const;
export type DirectoryViewValue = (typeof DIRECTORY_VIEW_VALUES)[number];

/** A financial year by the calendar year it starts in. */
export class YearQueryDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

/**
 * Issue #173: Programmes for a financial year, optionally narrowed to
 * activities the SPC classified with any of the given dimensions and any of
 * the given categories.
 */
export class ProgrammesQueryDto extends YearQueryDto {
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(Object.values(ActivityDimension).length)
  @IsIn(Object.values(ActivityDimension), { each: true })
  dimension?: ActivityDimension[];

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(Object.values(ActivityCategory).length)
  @IsIn(Object.values(ActivityCategory), { each: true })
  category?: ActivityCategory[];
}

export class PagedYearQueryDto extends YearQueryDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  page = 1;
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class MapQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'ALL'])
  status?: 'ACTIVE' | 'ALL';
  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  grade?: 'A' | 'B' | 'C';
}

/** V5 D04 / M66 filters. */
export class DirectoryQueryDto extends PagedYearQueryDto {
  @IsOptional()
  @IsIn(DIRECTORY_VIEW_VALUES)
  view: DirectoryViewValue = 'all';
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;
  @IsOptional()
  @IsUUID()
  districtId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dsDivision?: string;
  @IsOptional()
  @IsIn(['A', 'B', 'C', 'NONE'])
  grade?: 'A' | 'B' | 'C' | 'NONE';
  @IsOptional()
  @IsUUID()
  spcId?: string;
  @IsOptional()
  @IsIn(['recent', 'stale'])
  records?: 'recent' | 'stale';
  @IsOptional()
  @IsIn(['waiting', 'none'])
  gradeRequest?: 'waiting' | 'none';
  @IsOptional()
  @IsIn(['ACTIVE', 'ALL'])
  status: 'ACTIVE' | 'ALL' = 'ACTIVE';
}
