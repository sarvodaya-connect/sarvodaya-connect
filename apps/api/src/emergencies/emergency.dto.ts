import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  ALLOWED_CONTENT_TYPES,
  SHA256_BASE64,
} from '../documents/upload-rules.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Mirrors packages/api-contracts/src/emergency.ts. */
export const INCIDENT_TYPES = [
  'FLOOD',
  'LANDSLIDE',
  'CYCLONE',
  'DROUGHT',
  'FIRE',
  'PUBLIC_HEALTH',
  'OTHER',
] as const;
export const IMPACTS = ['SAFE', 'AFFECTED', 'CRITICAL'] as const;
export const ROAD_ACCESS = [
  'OPEN',
  'PARTLY_BLOCKED',
  'CUT_OFF',
  'UNKNOWN',
] as const;
export const NEEDS = [
  'DRINKING_WATER',
  'DRY_RATIONS',
  'TEMPORARY_SHELTER',
  'MEDICAL_HELP',
  'CLOTHING',
  'VOLUNTEERS',
  'OTHER',
] as const;
export const HELPER_STATUSES = [
  'ASSIGNED',
  'IN_PROGRESS',
  'DELIVERED',
] as const;

/** Counts are whole numbers; a society's figures stay well below this. */
const MAX_COUNT = 1_000_000;

export class IncidentListQueryDto {
  @IsOptional() @IsIn(['ACTIVE', 'CLOSED']) status: 'ACTIVE' | 'CLOSED' =
    'ACTIVE';
}

/** V5 D30, IR02 and M48: open an incident. */
export class OpenIncidentDto {
  @IsIn(INCIDENT_TYPES) type: (typeof INCIDENT_TYPES)[number];
  @IsUUID() reportingSocietyId: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  districtIds: string[];
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) message?: string;
  @IsDateString() startedAt: string;
  @IsOptional() @IsDateString() assessmentsDueAt?: string;
}

export class SocietyListQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'NOT_ASSESSED', 'AFFECTED', 'CRITICAL', 'SAFE'])
  state: 'ALL' | 'NOT_ASSESSED' | 'AFFECTED' | 'CRITICAL' | 'SAFE' = 'ALL';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page: number =
    1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}

/** V5 M41/M42: one rapid assessment, sent online. Counts only. */
export class SendAssessmentDto {
  /** A retry with the same id returns the assessment already received. */
  @IsUUID() clientMutationId: string;
  @IsUUID() societyId: string;
  @IsIn(IMPACTS) impact: (typeof IMPACTS)[number];
  @IsInt() @Min(0) @Max(MAX_COUNT) families: number;
  @IsInt() @Min(0) @Max(MAX_COUNT) people: number;
  @IsInt() @Min(0) @Max(MAX_COUNT) housesFully: number;
  @IsInt() @Min(0) @Max(MAX_COUNT) housesPartly: number;
  @IsInt() @Min(0) @Max(MAX_COUNT) injured: number;
  @IsInt() @Min(0) @Max(MAX_COUNT) displaced: number;
  @IsIn(ROAD_ACCESS) roadAccess: (typeof ROAD_ACCESS)[number];
  @IsArray()
  @ArrayMaxSize(NEEDS.length)
  @ArrayUnique()
  @IsIn(NEEDS, { each: true })
  needs: (typeof NEEDS)[number][];
  @Transform(trim) @IsString() @MaxLength(1000) note: string;
  @IsBoolean() confirmedWithPresident: boolean;
}

/** V5 D32: a need for one society, with the helpers HQ assigns now or later. */
export class CreateActionDto {
  @IsUUID() clientMutationId: string;
  @IsUUID() societyId: string;
  @IsIn(NEEDS) need: (typeof NEEDS)[number];
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) title: string;
  @IsInt() @Min(1) @Max(MAX_COUNT) quantity: number;
  @Transform(trim) @IsString() @MaxLength(30) unit: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class HelperInputDto {
  @IsUUID() societyId: string;
  @IsInt() @Min(1) @Max(MAX_COUNT) quantity: number;
}

export class AssignHelpersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HelperInputDto)
  helpers: HelperInputDto[];
  @IsDateString() dueAt: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) note?: string;
}

/** V5 M46: a helping society's delivery. */
export class UpdateDeliveryDto {
  @IsIn(HELPER_STATUSES) status: (typeof HELPER_STATUSES)[number];
  @IsInt() @Min(0) @Max(MAX_COUNT) deliveredQuantity: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) deliveredOn?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) note?: string;
}

export class CreateReportDto {
  @IsUUID() clientMutationId: string;
  @Transform(trim) @IsString() @MaxLength(4000) summary: string;
}

/** A photo or PDF for an assessment or a delivery, sent straight to storage. */
export class CreateEvidenceDto {
  @IsIn(Object.keys(ALLOWED_CONTENT_TYPES))
  contentType: keyof typeof ALLOWED_CONTENT_TYPES;
  @IsInt() @Min(1) sizeBytes: number;
  @IsOptional() @Matches(SHA256_BASE64) checksumSha256?: string;
}
