# Production AWS foundation

The first rollout uses the same network and database layout as TEST in Singapore.
Production has its own VPC, private PostgreSQL database, Cognito pool and S3
buckets. The foundation does not contain users, seed data, application code or
a reference to the TEST bootstrap credentials. It uses a Single-AZ RDS instance
and one NAT instance, so an outage affecting either can interrupt service.

## Review the change set

Use the reviewed `infrastructure/aws/test/foundation.yaml` from the release
commit. If using CloudShell, upload the file as `foundation.yaml`. Confirm that
the active account is the one Sarvodaya chose for production, that
`10.78.0.0/16` can be used, and that the account can order PostgreSQL 17.11 on
`db.t4g.micro` in Singapore. The standing database, NAT, public IPv4, disk and
managed secret add to the existing TEST bill.

From CloudShell, create a change set for the new stack:

```bash
aws cloudformation deploy \
  --region ap-southeast-1 \
  --stack-name sarvodaya-connect-production-foundation \
  --template-file "$HOME/foundation.yaml" \
  --parameter-overrides Stage=production ExpectedAccountId=<approved-account-id> \
  --tags Project=SarvodayaConnect Environment=production \
  --no-execute-changeset --no-cli-pager
```

Replace `<approved-account-id>` with the confirmed 12-digit AWS account ID.
Use the returned ARN in `aws cloudformation describe-change-set`. For the first
create, check that every resource action is **Add**. Review the two private
subnets, the encrypted database and its backup/deletion settings, the separate
Cognito clients and the private S3 resources. Execute the change set once the
scope and cost are approved. Wait for `stack-create-complete`.

## Connect the application

1. Read `VpcId`, `PrivateSubnetId`, `SecondPrivateSubnetId`,
   `ApplicationSecurityGroupId`, `DatabaseHost`, `DocumentsBucketName`,
   `DeploymentBucketName`, and the three Cognito outputs from the completed
   stack. `DatabaseAdminSecretArn` identifies the RDS-managed admin credential.
   The stack outputs never contain the password itself.
2. Use a private-VPC migration session to apply the release commit's Prisma
   migrations to the empty `sarvodaya_production` database. Set up a dedicated
   runtime role with the required application DML and sequence permissions
   and a connection limit of 10. Create separate Secrets Manager entries for
   its database URL and the production NIC encryption key. Use the production
   database hostname and `sslmode=verify-full` in the runtime URL. Configure the
   production API using these entries as `DatabaseSecretArn` and
   `NicKeySecretArn`. The API starts with a concurrency limit of four and one
   PostgreSQL connection per Lambda instance.
3. Deploy the production API with SarvoAI disabled for initial smoke testing.
   Connect a dedicated production Amplify deployment and set `DashboardOrigin`
   to its actual HTTPS origin for signed document uploads. Retain prior document
   versions in production until Sarvodaya approves an expiry policy.
4. Verify Cognito sign-in, role boundaries and document uploads against
   production before connecting signed store builds. Keep imported real
   records and reviewer access under Sarvodaya's approved data handling plan.

See the [AWS configuration](aws-configuration.md) for application settings.
