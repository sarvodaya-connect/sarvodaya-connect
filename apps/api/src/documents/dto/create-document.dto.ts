import { Transform } from 'class-transformer';
import {
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
} from 'class-validator';

import {
  ALLOWED_CONTENT_TYPES,
  type AllowedContentType,
  DOCUMENT_TYPES,
  type DocumentTypeValue,
  SHA256_BASE64,
  UPLOAD_SIZE_CEILING,
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

  /** Checked against DOCUMENT_MAX_UPLOAD_BYTES by the service. */
  @IsInt()
  @Min(1)
  @Max(UPLOAD_SIZE_CEILING)
  sizeBytes: number;

  /** SHA-256 of the file in base64; storage refuses an upload that does not match. */
  @IsOptional()
  @Matches(SHA256_BASE64, {
    message: 'checksumSha256 must be the SHA-256 of the file in base64',
  })
  checksumSha256?: string;

  /** Required for the four Registrar documents. 2025 means FY 2025/26. */
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2200)
  financialYear?: number;
}
