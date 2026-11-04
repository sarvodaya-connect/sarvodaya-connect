# RDS certificate bundle

`rds-ap-southeast-1.pem` contains public AWS RDS root CA certificates, not
credentials, client certificates or private keys.

- Source: https://truststore.pki.rds.amazonaws.com/ap-southeast-1/ap-southeast-1-bundle.pem
- Retrieved: 2026-11-04 over verified HTTPS.
- SHA-256: `3c696020a3b7c6721085d182211c28024ab01873ade35dcc7eeebb89c20ee979`
- Contents: Singapore RSA4096 G1, RSA2048 G1 and ECC384 G1 root CAs.
- AWS guidance: https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html#nodejs-certificates

`scripts/package-lambda.sh` copies this reviewed file into the deployment package.
The SAM template sets `NODE_EXTRA_CA_CERTS` for the test Lambda to
`/var/task/certificates/rds-ap-southeast-1.pem`. Node must receive this setting at
process startup; assigning it later during SSM loading does not load the CAs.
The encrypted runtime database URL uses `sslmode=verify-full` so node-postgres
verifies the certificate chain and hostname. Do not put the CloudShell CA file
path into the runtime secret. The deployment package does not contain that file.

Before a CA rotation, download the bundle from the source URL into a temporary
file, inspect its certificate subjects/issuers and expiry dates, review the diff,
update this checksum/date, and submit the update through a PR. Rebuild and deploy
the Lambda package before changing the database CA. Builds use the committed
bundle and do not download changing trust material automatically.

This bundle covers Singapore only. Other deployment regions need their own
reviewed CA configuration.
