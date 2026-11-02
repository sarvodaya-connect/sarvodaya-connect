# AWS configuration

How the platform is configured for the agreed AWS shape: the Next.js 15 dashboard on AWS Amplify, the NestJS API on AWS Lambda behind API Gateway, PostgreSQL on Amazon RDS (through RDS Proxy) with Prisma, Cognito for production identity, and a private S3 bucket for documents. Nothing in the repository creates AWS resources, holds credentials or deploys.

Every setting is an environment variable with a safe development default (`.env.example`). **Secret** values come from AWS Secrets Manager in production; **config** values are plain Lambda or Amplify environment variables.

## API settings

| Variable | Kind | Default (development) | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Secret | local PostgreSQL | RDS connection through RDS Proxy |
| `DATABASE_CONNECTION_LIMIT` | Config | `2` | Pool size per Lambda instance; keep within the RDS Proxy budget |
| `NIC_ENCRYPTION_KEY` | Secret | — | NIC vault key (64 hex characters) |
| `STORAGE_DRIVER` | Config | `local` (`s3` in production) | Document storage driver |
| `S3_BUCKET` | Config | — | Private documents bucket |
| `S3_REGION` | Config | — | Bucket region |
| `STORAGE_URL_TTL_SECONDS` | Config | `900` | Lifetime of pre-signed upload and download URLs (60–604800) |
| `DOCUMENT_MAX_UPLOAD_BYTES` | Config | `10000000` | Largest upload; PDF, JPG or PNG; at most 50 MB (PR 4) |
| `LOCAL_STORAGE_DIR` | Config | `.local-storage` | Development driver only; refused in production |
| `STORAGE_SIGNING_SECRET` | Secret | random per start | Development driver link signing |
| `CORS_ALLOWED_ORIGINS` | Config | empty | Development driver only: dashboard origin allowed to PUT to local upload links (PR 4) |
| `SARVOAI_ENABLED` | Config (feature flag) | `false` | SarvoAI on Bedrock; see `sarvoai-aws-setup.md` |

The temporary DDM access maximum is added with PR 7.

## Documents in S3 (PR 4)

- **Upload:** the API checks the user's permission, records the metadata (society, type, financial year, uploader, time, size, SHA-256) and returns a short-lived pre-signed `PUT` URL. The client sends the file straight to S3 and then calls `POST /documents/:id/complete`; the API checks the stored size before marking it uploaded. Files never pass through API Gateway or Lambda.
- **Integrity:** the pre-signed URL signs `Content-Type` and `x-amz-checksum-sha256`, so S3 refuses a different file or type.
- **Download:** permission-checked, short-lived pre-signed `GET` URLs. The signed members list opens only for District Managers and HQ.
- **Keys:** `societies/{societyId}/{type}/{fy}/{uuid}.{ext}`, for example `societies/…/audit-report/2025-26/….pdf`; `general` is used for documents without a financial year. Keys contain no names or other personal data.

### IAM permissions for the API's Lambda role

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::<documents-bucket>/societies/*"
}
```

`s3:GetObject` also covers the `HEAD` request used to confirm an upload. The bucket blocks all public access and uses default encryption.

### Bucket CORS (browser uploads from the dashboard)

```json
[
  {
    "AllowedOrigins": ["https://<dashboard-domain>"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "x-amz-checksum-sha256"],
    "MaxAgeSeconds": 3000
  }
]
```

The phone app uploads with a native HTTP client and needs no CORS rule.

## Database migrations

Apply with `npm run prisma:deploy` in `apps/api` against RDS (through a migration task, not from a developer machine).

| Migration | PR | What it adds |
|---|---|---|
| `20261103090000_v5_activities_sdgs_documents` | 4 | Activity status (waiting for SPC, sent back, approved), dimension, participants and beneficiaries, partners, resources, volunteer hours, who sent and reviewed it; `work_plan_activity_sdgs` (UN SDG 1–17 with a check constraint); document SHA-256. Existing activities become approved. |
| `20261103091000_v5_registrar_document_counts` | 4 | Index on `society_documents (financial_year_start, document_type, society_id)` for the D11/D12 national counts |

Indexes added in PR 4 for dashboard queries: `work_plan_activities (status, submitted_at)` and `(status, reviewed_at)` for the SPC queue, `work_plan_activity_sdgs (sdg)` for SDG rankings (PR 5), and the Registrar document index above. National Registrar counts run as two grouped SQL queries, not a loop over societies.
