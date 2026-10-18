import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  ALLOWED_CONTENT_TYPES,
  type AllowedContentType,
  DOCUMENT_TYPES,
  type DocumentTypeValue,
  MAX_DOCUMENT_BYTES,
} from '../upload-rules.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Metadata for a new document. The file itself is uploaded to the returned URL. */
export class CreateDocumentDto {
  @IsUUID()
  societyId: string;

  @IsIn(DOCUMENT_TYPES)
  documentType: DocumentTypeValue;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  // A plain file name: no folders, control characters or characters that are unsafe in headers.
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  @Matches(/^[^\\/:*?"<>|\p{Cc}]{1,255}$/u, {
    message: 'fileName must be a plain file name',
  })
  fileName: string;

  @IsIn(Object.keys(ALLOWED_CONTENT_TYPES))
  contentType: AllowedContentType;

  @IsInt()
  @Min(1)
  @Max(MAX_DOCUMENT_BYTES)
  sizeBytes: number;
}
