import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  CouncilMemberDto,
  SOCIETY_GRADE_VALUES,
  type SocietyGradeValue,
} from './society-updates.dto.js';

/** D05a. null leaves the role without anyone. */
export class AssignStaffDto {
  @ValidateIf((_, value) => value !== null) @IsUUID() deputyId!: string | null;
  @ValidateIf((_, value) => value !== null) @IsUUID() coordinatorId!:
    string | null;
  @ValidateIf((_, value) => value !== null) @IsUUID() officerId!: string | null;
}

/** D05c: an Exco member entered while creating a society, with an optional NIC. */
export class NewCouncilMemberDto extends CouncilMemberDto {
  @IsOptional()
  @Matches(/^(?:[0-9]{9}[vVxX]|[0-9]{12})$/, { message: 'Enter a valid NIC' })
  nic?: string;
}

/** D05n + D05c. */
export class CreateSocietyDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]{2,19}$/, {
    message: 'Enter the S number, for example S-104233',
  })
  societyCode!: string;
  @IsString() @MinLength(2) @MaxLength(150) nameEn!: string;
  @IsOptional() @IsString() @MaxLength(150) nameLocal?: string;
  @IsUUID() districtId!: string;
  @IsString() @MinLength(2) @MaxLength(100) dsDivision!: string;
  @IsOptional() @IsString() @MaxLength(100) gnDivision?: string;
  @IsString() @MinLength(3) @MaxLength(255) addressLine!: string;
  @IsInt() @Min(1) @Max(1_000_000) memberCount!: number;
  @IsOptional() @IsString() @MaxLength(30) landline?: string;
  @IsIn(SOCIETY_GRADE_VALUES) grade!: SocietyGradeValue;
  @IsOptional() @IsString() @MaxLength(1000) businessDescription?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsArray()
  @ArrayMinSize(25, {
    message: 'Every society must have exactly 25 Exco members',
  })
  @ArrayMaxSize(25, {
    message: 'Every society must have exactly 25 Exco members',
  })
  @ArrayUnique((member: NewCouncilMemberDto) => member.seatNumber)
  @ValidateNested({ each: true })
  @Type(() => NewCouncilMemberDto)
  council!: NewCouncilMemberDto[];
}
