import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const INCIDENT_TYPES = ['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT', 'FIRE', 'PUBLIC_HEALTH', 'OTHER'] as const;
export const SEVERITIES = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const;
export const INCIDENT_STATUSES = ['ACTIVE', 'CONTAINED', 'CLOSED'] as const;
export const RECORD_STATUSES = ['DRAFT', 'SUBMITTED'] as const;
export const ACTION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export class ActivateIncidentDto {
  @IsUUID() districtId: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) title: string;
  @IsIn(INCIDENT_TYPES) type: (typeof INCIDENT_TYPES)[number];
  @IsIn(SEVERITIES) severity: (typeof SEVERITIES)[number];
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(4000) description: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) location: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
}

export class SyncAssessmentDto {
  @IsUUID() clientMutationId: string;
  @IsUUID() incidentId: string;
  @IsUUID() societyId: string;
  @IsOptional() @IsInt() @Min(1) expectedRevision?: number;
  @IsIn(RECORD_STATUSES) status: (typeof RECORD_STATUSES)[number];
  @IsDateString() observedAt: string;
  @IsInt() @Min(0) @Max(10000000) peopleAffected: number;
  @IsInt() @Min(0) @Max(10000000) householdsAffected: number;
  @IsInt() @Min(0) @Max(10000000) displacedPeople: number;
  @Transform(trim) @IsString() @MaxLength(2000) infrastructureNotes: string;
  @Transform(trim) @IsString() @MaxLength(2000) urgentNeeds: string;
  @Transform(trim) @IsString() @MaxLength(4000) notes: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
}

export class CreateResponseActionDto {
  @IsUUID() clientMutationId: string;
  @IsUUID() incidentId: string;
  @IsOptional() @IsUUID() societyId?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) title: string;
  @Transform(trim) @IsString() @MaxLength(2000) description: string;
  @IsIn(ACTION_STATUSES) status: (typeof ACTION_STATUSES)[number];
  @IsOptional() @IsDateString() dueAt?: string;
}

export class SyncSituationReportDto {
  @IsUUID() clientMutationId: string;
  @IsUUID() incidentId: string;
  @IsOptional() @IsUUID() societyId?: string;
  @IsOptional() @IsInt() @Min(1) expectedRevision?: number;
  @IsIn(RECORD_STATUSES) status: (typeof RECORD_STATUSES)[number];
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(4000) summary: string;
  @Transform(trim) @IsString() @MaxLength(2000) needs: string;
}

export class UpdateIncidentStatusDto {
  @IsIn(INCIDENT_STATUSES) status: (typeof INCIDENT_STATUSES)[number];
}

export class UpdateResponseActionStatusDto {
  @IsIn(ACTION_STATUSES) status: (typeof ACTION_STATUSES)[number];
}
