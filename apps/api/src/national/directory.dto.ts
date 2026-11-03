import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const toInt = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

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
