import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** SP02 / DD03 / DM02 filters. */
export class HomeSocietyQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  grade?: 'A' | 'B' | 'C';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  dsDivision?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  needsUpdate?: boolean;

  @IsOptional()
  @IsIn(['PENDING', 'NONE'])
  gradeRequest?: 'PENDING' | 'NONE';

  @IsOptional()
  @IsUUID()
  spcId?: string;

  @IsOptional()
  @IsUUID()
  ddmId?: string;

  /** DD04: a DDM with temporary access can list the whole district (view only). */
  @IsOptional()
  @IsIn(['MINE', 'DISTRICT'])
  scope?: 'MINE' | 'DISTRICT';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  assignedToMe?: boolean;
}

/** Issue #118: a DDM chooses their own societies or the temporary district view. */
export class HomeMembershipQueryDto {
  @IsOptional()
  @IsIn(['MINE', 'DISTRICT'])
  scope?: 'MINE' | 'DISTRICT';
}

/** Issue #119: D11 for one financial year, the follow-up list one page at a time. */
export class HomeAuditsQueryDto extends HomeMembershipQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;
}
