import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MembershipCategory } from '../../generated/prisma/client.js';

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
