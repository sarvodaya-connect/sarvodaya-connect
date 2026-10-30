import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MembershipCategory } from '../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const SOCIETY_GRADE_VALUES = ['A', 'B', 'C'] as const;
export type SocietyGradeValue = (typeof SOCIETY_GRADE_VALUES)[number];

export class PrimaryContactDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string;
  @IsOptional() @IsString() @MaxLength(100) position?: string;
  @IsString() @MinLength(5) @MaxLength(30) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}

export class SocietyProfileUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(150) nameLocal?: string;
  @IsOptional() @IsString() @MaxLength(100) dsDivision?: string;
  @IsOptional() @IsString() @MaxLength(100) gnDivision?: string;
  @IsOptional() @IsString() @MaxLength(100) village?: string;
  @IsOptional() @IsString() @MaxLength(255) addressLine?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsISO8601({ strict: true }) establishedOn?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => PrimaryContactDto)
  primaryContact?: PrimaryContactDto;
  // SC-65: V4 society record fields.
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) memberCount?: number;
  /** A 10-digit number such as 037 000 0000, or +94 and 9 digits. Empty removes it. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  landline?: string;
  /** Empty removes it. Information only: no sales, stock or accounts. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  businessDescription?: string;
  /** HQ only. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{2,19}$/, {
    message: 'societyCode must look like S-104233',
  })
  societyCode?: string;
  /** HQ only, with a reason. */
  @IsOptional() @IsIn(SOCIETY_GRADE_VALUES) grade?: SocietyGradeValue;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  gradeReason?: string;
}

export class CouncilMemberDto {
  @IsInt() @Min(1) @Max(25) seatNumber!: number;
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string;
  @IsString() @MinLength(2) @MaxLength(100) position!: string;
  @IsEnum(MembershipCategory) seatType!: MembershipCategory;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsInt() @Min(1) @Max(120) age?: number;
  @IsOptional() @IsISO8601({ strict: true }) appointedOn?: string;
  @IsOptional() @IsISO8601({ strict: true }) endedOn?: string;
  @IsBoolean() isActive!: boolean;
  @IsBoolean() isPrimaryContact!: boolean;
}

export class SocietyCouncilUpdateDto {
  @IsArray()
  @ArrayMinSize(25)
  @ArrayMaxSize(25)
  @ArrayUnique((member: CouncilMemberDto) => member.seatNumber)
  @ValidateNested({ each: true })
  @Type(() => CouncilMemberDto)
  members!: CouncilMemberDto[];
}

export class MembershipCategoryDto {
  @IsEnum(MembershipCategory) category!: MembershipCategory;
  @IsInt() @Min(0) female!: number;
  @IsInt() @Min(0) male!: number;
}

export class SocietyMembershipUpdateDto {
  @IsInt() @Min(1900) @Max(2200) year!: number;
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ArrayUnique((category: MembershipCategoryDto) => category.category)
  @ValidateNested({ each: true })
  @Type(() => MembershipCategoryDto)
  categories!: MembershipCategoryDto[];
}

export class MembershipQueryDto {
  @Type(() => Number) @IsInt() @Min(1900) @Max(2200) year =
    new Date().getFullYear();
}
