# Database schema reference

Derived from [`schema.prisma`](../apps/api/prisma/schema.prisma) on 11 November 2026.
All 31 Prisma models are included below. Field names use their mapped PostgreSQL
column names. Types are abbreviated; consult Prisma for enum values, lengths,
defaults, composite constraints and delete actions. `nullable` means the scalar
column is optional. Connections represent declared Prisma relations only. PK/UK field labels show
single-column declarations; composite keys and uniqueness are listed explicitly
in the constraint section below.

This documents repository migrations, not a live inspection of RDS. Apply reviewed
migrations separately; do not use this document as SQL or a migration tool.

UUID-looking scalar fields and arrays are not automatically database foreign keys.
In particular, account society assignments, temporary grants, audit target/actor
IDs, notification recipients and incident area-district arrays are enforced or
interpreted by application code where no Prisma relation is declared.

## Registry, records and activities

```mermaid
erDiagram
    DISTRICTS {
        uuid id PK
        varchar code UK
        varchar name_en UK
        varchar province "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    SOCIETIES {
        uuid id PK
        varchar society_code UK
        varchar name_en
        varchar name_local "nullable"
        uuid district_id FK
        varchar ds_division "nullable"
        varchar gn_division "nullable"
        varchar village "nullable"
        varchar address_line "nullable"
        float latitude "nullable"
        float longitude "nullable"
        date established_on "nullable"
        enum status
        int member_count "nullable"
        varchar landline "nullable"
        varchar business_description "nullable"
        enum grade "nullable"
        timestamptz grade_changed_at "nullable"
        varchar grade_changed_by_name "nullable"
        varchar grade_changed_by_role "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    SOCIETY_CONTACTS {
        uuid id PK
        uuid society_id FK
        varchar label "nullable"
        varchar full_name "nullable"
        varchar position "nullable"
        varchar phone "nullable"
        varchar email "nullable"
        boolean is_primary
        timestamptz created_at
        timestamptz updated_at
    }
    SOCIETY_COUNCIL_MEMBERS {
        uuid id PK
        uuid society_id FK
        int seat_number
        varchar full_name
        text nic_ciphertext "nullable"
        varchar nic_last_four "nullable"
        varchar position
        enum seat_type
        varchar phone "nullable"
        varchar email "nullable"
        int age "nullable"
        date date_of_birth "nullable"
        varchar profession "nullable"
        varchar address_line "nullable"
        date appointed_on "nullable"
        date ended_on "nullable"
        boolean is_active
        boolean is_primary_contact
        timestamptz created_at
        timestamptz updated_at
    }
    SOCIETY_MEMBERSHIP_COUNTS {
        uuid id PK
        uuid society_id FK
        int year
        enum category
        int female
        int male
        timestamptz created_at
        timestamptz updated_at
    }
    SOCIETY_DOCUMENTS {
        uuid id PK
        uuid society_id FK
        enum document_type
        varchar title
        varchar file_name
        varchar content_type
        int size_bytes
        varchar storage_key UK
        enum status
        enum access_level
        int version
        varchar uploaded_by_id
        varchar uploaded_by_name
        timestamptz uploaded_at "nullable"
        varchar uploaded_by_role "nullable"
        int financial_year_start "nullable"
        varchar checksum_sha256 "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    ANNUAL_FINANCIAL_SUMMARIES {
        uuid id PK
        uuid society_id FK
        int financial_year_start
        decimal total_profit "nullable"
        decimal total_expenses "nullable"
        decimal previous_profit "nullable"
        decimal previous_expenses "nullable"
        timestamptz profit_updated_at "nullable"
        varchar profit_updated_by_name "nullable"
        varchar profit_updated_by_role "nullable"
        timestamptz expenses_updated_at "nullable"
        varchar expenses_updated_by_name "nullable"
        varchar expenses_updated_by_role "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    GRADE_CHANGE_REQUESTS {
        uuid id PK
        uuid society_id FK
        enum from_grade "nullable"
        enum to_grade
        varchar reason
        enum status
        varchar requested_by_id
        varchar requested_by_name
        varchar requested_by_role
        timestamptz requested_at
        varchar decided_by_id "nullable"
        varchar decided_by_name "nullable"
        timestamptz decided_at "nullable"
        varchar decision_comment "nullable"
    }
    WORK_PLAN_ACTIVITIES {
        uuid id PK
        uuid society_id FK
        int year
        int month
        varchar name
        varchar description
        varchar sector "nullable"
        varchar dates_label "nullable"
        decimal allocated_cost
        enum dimension "nullable"
        enum status
        int female_participants "nullable"
        int male_participants "nullable"
        int youth_participants "nullable"
        int households_benefited "nullable"
        int women_headed_households "nullable"
        varchar partners "nullable"
        varchar resources_needed "nullable"
        int volunteer_hours "nullable"
        varchar created_by_id "nullable"
        varchar created_by_name "nullable"
        varchar created_by_role "nullable"
        timestamptz submitted_at "nullable"
        varchar reviewed_by_id "nullable"
        varchar reviewed_by_name "nullable"
        timestamptz reviewed_at "nullable"
        varchar review_comment "nullable"
        varchar updated_by_name "nullable"
        varchar updated_by_role "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    WORK_PLAN_ACTIVITY_SDGS {
        uuid activity_id FK
        int sdg
    }
    DISTRICTS ||--o{ SOCIETIES : district
    SOCIETIES ||--o{ SOCIETY_CONTACTS : society
    SOCIETIES ||--o{ SOCIETY_COUNCIL_MEMBERS : society
    SOCIETIES ||--o{ SOCIETY_MEMBERSHIP_COUNTS : society
    SOCIETIES ||--o{ SOCIETY_DOCUMENTS : society
    SOCIETIES ||--o{ ANNUAL_FINANCIAL_SUMMARIES : society
    SOCIETIES ||--o{ GRADE_CHANGE_REQUESTS : society
    SOCIETIES ||--o{ WORK_PLAN_ACTIVITIES : society
    WORK_PLAN_ACTIVITIES ||--o{ WORK_PLAN_ACTIVITY_SDGS : activity
```

## Accounts and access

```mermaid
erDiagram
    PLATFORM_ACCOUNTS {
        uuid id PK
        varchar username UK
        varchar display_name
        varchar phone
        varchar email "nullable"
        varchar role
        uuid district_id FK "nullable"
        uuid_array society_ids
        varchar status
        text password_hash "nullable"
        timestamptz password_set_at "nullable"
        int password_set_count
        int failed_login_count
        timestamptz locked_until "nullable"
        text provider_subject UK "nullable"
        timestamptz sessions_revoked_at "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    ACCOUNT_INVITATIONS {
        uuid id PK
        uuid account_id FK
        text token_hash UK
        varchar method
        timestamptz expires_at
        timestamptz used_at "nullable"
        int attempts
        timestamptz created_at
    }
    ACCOUNT_SESSIONS {
        uuid id PK
        uuid account_id FK
        text token_hash UK
        timestamptz expires_at
    }
    DISTRICT_ACCESS_GRANTS {
        uuid id PK
        uuid district_id
        uuid deputy_id
        varchar granted_by_id
        timestamptz starts_at
        timestamptz expires_at
        timestamptz revoked_at "nullable"
        varchar reason
        timestamptz created_at
    }
    PLATFORM_AUDIT_EVENTS {
        uuid id PK
        varchar actor_id
        varchar actor_name "nullable"
        varchar actor_role "nullable"
        varchar action
        varchar target_id
        uuid society_id "nullable"
        uuid district_id "nullable"
        varchar detail
        timestamptz created_at
    }
    DISTRICTS o|--o{ PLATFORM_ACCOUNTS : district
    PLATFORM_ACCOUNTS ||--o{ ACCOUNT_INVITATIONS : account
    PLATFORM_ACCOUNTS ||--o{ ACCOUNT_SESSIONS : account
```

## Emergency response

```mermaid
erDiagram
    EMERGENCY_INCIDENTS {
        uuid id PK
        int reference_number UK
        uuid district_id FK
        uuid_array area_district_ids
        uuid reporting_society_id FK "nullable"
        varchar title
        enum type
        enum severity
        enum status
        varchar description
        varchar message
        varchar location
        float latitude "nullable"
        float longitude "nullable"
        varchar created_by_id
        varchar created_by_name "nullable"
        varchar created_by_role "nullable"
        timestamptz started_at
        timestamptz assessments_due_at "nullable"
        timestamptz last_reminder_at "nullable"
        timestamptz activated_at
        timestamptz closed_at "nullable"
        varchar closed_by_id "nullable"
        varchar closed_by_name "nullable"
        varchar closed_by_role "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    EMERGENCY_ASSESSMENTS {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK
        uuid client_mutation_id
        int revision
        enum status
        timestamptz observed_at
        enum impact
        int people_affected
        int households_affected
        int displaced_people
        int houses_fully_damaged
        int houses_partly_damaged
        int injured
        enum road_access
        enum_array needs
        boolean confirmed_with_president
        varchar infrastructure_notes
        varchar urgent_needs
        varchar notes
        float latitude "nullable"
        float longitude "nullable"
        varchar created_by_id
        varchar created_by_name "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    EMERGENCY_RESPONSE_ACTIONS {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK "nullable"
        uuid client_mutation_id
        enum need
        varchar title
        varchar description
        int quantity
        varchar unit
        enum status
        timestamptz due_at "nullable"
        varchar created_by_id
        varchar created_by_name "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    EMERGENCY_ACTION_HELPERS {
        uuid id PK
        uuid action_id FK
        uuid helper_society_id FK
        int quantity
        int delivered_quantity
        enum status
        varchar note
        varchar delivery_note
        date delivered_on "nullable"
        varchar assigned_by_id
        varchar assigned_by_name
        varchar updated_by_id "nullable"
        varchar updated_by_name "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    EMERGENCY_EVIDENCE {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK
        uuid assessment_id FK "nullable"
        uuid helper_id FK "nullable"
        varchar storage_key UK
        varchar content_type
        int size_bytes
        varchar checksum_sha256 "nullable"
        varchar uploaded_by_id
        timestamptz uploaded_at "nullable"
        timestamptz created_at
    }
    EMERGENCY_SITUATION_REPORTS {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK "nullable"
        uuid client_mutation_id
        int revision
        enum status
        int number "nullable"
        timestamptz as_of "nullable"
        jsonb snapshot "nullable"
        varchar summary
        varchar needs
        varchar created_by_id
        varchar created_by_name "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    DISTRICTS ||--o{ EMERGENCY_INCIDENTS : district
    SOCIETIES o|--o{ EMERGENCY_INCIDENTS : reportingSociety
    EMERGENCY_INCIDENTS ||--o{ EMERGENCY_ASSESSMENTS : incident
    SOCIETIES ||--o{ EMERGENCY_ASSESSMENTS : society
    EMERGENCY_INCIDENTS ||--o{ EMERGENCY_RESPONSE_ACTIONS : incident
    SOCIETIES o|--o{ EMERGENCY_RESPONSE_ACTIONS : society
    EMERGENCY_RESPONSE_ACTIONS ||--o{ EMERGENCY_ACTION_HELPERS : action
    SOCIETIES ||--o{ EMERGENCY_ACTION_HELPERS : helperSociety
    EMERGENCY_INCIDENTS ||--o{ EMERGENCY_EVIDENCE : incident
    SOCIETIES ||--o{ EMERGENCY_EVIDENCE : society
    EMERGENCY_ASSESSMENTS o|--o{ EMERGENCY_EVIDENCE : assessment
    EMERGENCY_ACTION_HELPERS o|--o{ EMERGENCY_EVIDENCE : helper
    EMERGENCY_INCIDENTS ||--o{ EMERGENCY_SITUATION_REPORTS : incident
    SOCIETIES o|--o{ EMERGENCY_SITUATION_REPORTS : society
```

## Notifications, requests and AI spending

```mermaid
erDiagram
    NOTIFICATIONS {
        uuid id PK
        varchar recipient_user_id
        enum category
        enum topic "nullable"
        varchar title
        varchar body "nullable"
        varchar link_path "nullable"
        uuid society_id FK "nullable"
        uuid document_id FK "nullable"
        timestamptz read_at "nullable"
        timestamptz created_at
    }
    INFORMATION_REQUESTS {
        uuid id PK
        varchar title
        enum audience
        uuid district_id FK "nullable"
        int financial_year_start "nullable"
        date due_on
        varchar created_by_id
        varchar created_by_name
        timestamptz created_at
    }
    INFORMATION_REQUEST_SOCIETIES {
        uuid request_id FK
        uuid society_id FK
        timestamptz responded_at "nullable"
        varchar responded_by_id "nullable"
        varchar responded_by_name "nullable"
        varchar note "nullable"
    }
    ASSISTANT_MONTHLY_SPEND {
        varchar month PK
        bigint committed_micro_usd
        timestamptz updated_at
    }
    ASSISTANT_SPEND_RESERVATIONS {
        uuid id PK
        varchar month FK
        varchar model_id
        enum status
        bigint reserved_micro_usd
        bigint actual_micro_usd "nullable"
        int input_tokens "nullable"
        int cache_write_tokens "nullable"
        int cache_read_tokens "nullable"
        int output_tokens "nullable"
        timestamptz created_at
        timestamptz closed_at "nullable"
    }
    ASSISTANT_SPEND_HOLDS {
        uuid reservation_id PK,FK
        varchar reasons
        bigint reserved_micro_usd
        bigint actual_micro_usd
        timestamptz detected_at
    }
    SOCIETIES o|--o{ NOTIFICATIONS : society
    SOCIETY_DOCUMENTS o|--o{ NOTIFICATIONS : document
    DISTRICTS o|--o{ INFORMATION_REQUESTS : district
    INFORMATION_REQUESTS ||--o{ INFORMATION_REQUEST_SOCIETIES : request
    SOCIETIES ||--o{ INFORMATION_REQUEST_SOCIETIES : society
    ASSISTANT_MONTHLY_SPEND ||--o{ ASSISTANT_SPEND_RESERVATIONS : monthlySpend
    ASSISTANT_SPEND_RESERVATIONS ||--o| ASSISTANT_SPEND_HOLDS : reservation
```

## Village Economic Profile (issue #145)

Businesses the society itself operates and the production reported for exact
covered periods. See [Village Economic Profile](village-economic-profile.md)
for the rules. Industry, product and unit are catalogue codes from
`packages/api-contracts/src/economy.ts`, checked by the API; the database
checks quantities, periods and Other descriptions.

```mermaid
erDiagram
    SOCIETY_BUSINESSES {
        uuid id PK
        uuid society_id FK
        varchar name
        varchar industry
        varchar other_industry "nullable"
        varchar description "nullable"
        enum status
        timestamptz closed_at "nullable"
        int version
        varchar created_by_id
        varchar created_by_name
        varchar created_by_role "nullable"
        varchar updated_by_name "nullable"
        varchar updated_by_role "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    BUSINESS_OUTPUTS {
        uuid id PK
        uuid business_id FK
        varchar product
        varchar other_description "nullable"
        varchar unit
        timestamptz archived_at "nullable"
        int version
        varchar created_by_id
        varchar created_by_name
        varchar created_by_role "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    PRODUCTION_RECORDS {
        uuid id PK
        uuid output_id FK
        enum basis
        date period_start
        date period_end
        varchar season_label "nullable"
        enum measurement
        decimal quantity
        varchar note "nullable"
        varchar source "nullable"
        int version
        uuid client_request_id UK "nullable"
        varchar created_by_id
        varchar created_by_name
        varchar created_by_role "nullable"
        varchar updated_by_name "nullable"
        varchar updated_by_role "nullable"
        timestamptz created_at
        timestamptz updated_at
    }
    PRODUCTION_RECORD_REVISIONS {
        uuid id PK
        uuid record_id FK
        int version
        varchar change
        decimal quantity
        varchar season_label "nullable"
        varchar note "nullable"
        varchar source "nullable"
        varchar changed_by_id
        varchar changed_by_name
        varchar changed_by_role "nullable"
        timestamptz changed_at
    }
    SOCIETIES ||--o{ SOCIETY_BUSINESSES : society
    SOCIETY_BUSINESSES ||--o{ BUSINESS_OUTPUTS : business
    BUSINESS_OUTPUTS ||--o{ PRODUCTION_RECORDS : output
    PRODUCTION_RECORDS ||--o{ PRODUCTION_RECORD_REVISIONS : record
```

## Composite keys, unique constraints and indexes

### `societies`

```prisma
@@index([districtId])
@@index([status])
@@index([status, updatedAt])
@@index([nameEn])
```

### `society_contacts`

```prisma
@@index([societyId])
```

### `society_council_members`

```prisma
@@unique([societyId, seatNumber])
@@index([societyId, isActive])
```

### `society_membership_counts`

```prisma
@@unique([societyId, year, category])
@@index([year, societyId])
```

### `society_documents`

```prisma
@@unique([societyId, documentType, title, version])
@@index([societyId, documentType])
@@index([societyId, documentType, financialYear])
@@index([financialYear, documentType, societyId])
@@index([status])
```

### `annual_financial_summaries`

```prisma
@@unique([societyId, financialYear])
```

### `grade_change_requests`

```prisma
@@index([societyId, requestedAt])
@@index([status, requestedAt])
```

### `work_plan_activities`

```prisma
@@index([societyId, year, month])
@@index([status, submittedAt])
@@index([status, reviewedAt])
```

### `work_plan_activity_sdgs`

```prisma
@@id([activityId, sdg])
@@index([sdg])
```

### `notifications`

```prisma
@@index([recipientUserId, createdAt])
@@index([recipientUserId, readAt])
@@index([recipientUserId, topic, createdAt])
```

### `emergency_incidents`

```prisma
@@index([districtId, status, activatedAt])
@@index([areaDistrictIds], type: Gin)
@@index([status, activatedAt])
```

### `emergency_assessments`

```prisma
@@unique([createdById, clientMutationId])
@@index([incidentId, societyId, status])
@@index([incidentId, status, createdAt])
```

### `emergency_response_actions`

```prisma
@@unique([createdById, clientMutationId])
@@index([incidentId, status, dueAt])
@@index([societyId])
```

### `emergency_action_helpers`

```prisma
@@unique([actionId, helperSocietyId])
@@index([helperSocietyId])
```

### `emergency_evidence`

```prisma
@@index([assessmentId])
@@index([helperId])
```

### `emergency_situation_reports`

```prisma
@@unique([createdById, clientMutationId], map: "emergency_situation_reports_created_by_id_client_mutation_i_key")
@@unique([incidentId, number])
@@index([incidentId, status, createdAt])
```

### `platform_accounts`

```prisma
@@index([districtId, role])
```

### `account_sessions`

```prisma
@@index([accountId])
```

### `district_access_grants`

```prisma
@@index([deputyId, expiresAt])
```

### `platform_audit_events`

```prisma
@@index([createdAt])
@@index([societyId, createdAt])
@@index([action, targetId])
```

### `information_requests`

```prisma
@@index([createdAt])
```

### `information_request_societies`

```prisma
@@id([requestId, societyId])
@@index([societyId, respondedAt])
@@index([requestId, respondedAt])
```

### `assistant_spend_reservations`

```prisma
@@index([month, status])
```

### `assistant_spend_holds`

```prisma
@@index([detectedAt])
```

### `society_businesses`

```prisma
@@index([societyId])
```

### `business_outputs`

```prisma
@@index([businessId])
@@index([product])
```

Also, in the migration only: `business_outputs_one_current_product`, a unique
index on `(business_id, product)` where `archived_at IS NULL AND product <> 'OTHER'`.

### `production_records`

```prisma
@@unique([outputId, measurement, periodStart, periodEnd])
@@index([periodStart, periodEnd])
```

### `production_record_revisions`

```prisma
@@unique([recordId, version])
```
