import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const SOCIETY_GRADES = ['A', 'B', 'C'] as const;
export type SocietyGrade = (typeof SOCIETY_GRADES)[number];
export const GRADE_CHANGE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export class CreateGradeChangeRequestDto {
  @IsIn(SOCIETY_GRADES) proposedGrade!: SocietyGrade;
  @IsString() @MinLength(10) @MaxLength(2000) rationale!: string;
}

export class GradeChangeDecisionDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @IsString() @MinLength(5) @MaxLength(2000) comment!: string;
}

export class DirectGradeUpdateDto {
  @IsIn(SOCIETY_GRADES) grade!: SocietyGrade;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}

export class GradeChangeQueryDto {
  @IsOptional() @IsIn(GRADE_CHANGE_STATUSES) status?: (typeof GRADE_CHANGE_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(150) search?: string;
  @IsOptional() @IsString() @MaxLength(100) districtId?: string;
  @IsOptional() @Transform(({ value }: { value: unknown }) => Number(value)) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Transform(({ value }: { value: unknown }) => Number(value)) @IsInt() @Min(1) @Max(100)
  pageSize = 20;
}
