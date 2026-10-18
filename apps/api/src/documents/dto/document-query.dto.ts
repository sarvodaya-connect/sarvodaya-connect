import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  type DocumentStatusValue,
  type DocumentTypeValue,
} from '../upload-rules.js';

export class DocumentQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsUUID()
  societyId?: string;

  @IsOptional()
  @IsUUID()
  districtId?: string;

  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  documentType?: DocumentTypeValue;

  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: DocumentStatusValue;
}
