# SarvoAI AgentCore TEST deployment

The API authenticates the HQ user, calls Bedrock through the spending ledger and
runs its approved read-only tools. The AgentCore container runs the LangGraph
workflow over an IAM-signed WebSocket. The socket carries operation names, model
stop reasons and tool identifiers. The API keeps the question, tool inputs,
results, model answer and audit data in its existing request. Each question gets
a new runtime session ID. An interrupted session returns an error through the
existing API and does not retry paid calls.

## Create the runtime in Singapore

Run these commands from the reviewed repository checkout in a terminal with
Docker and authenticated AWS CLI access to the TEST account. The first change
set creates the deployment repository. The second creates the AgentCore runtime
and its execution role.

```bash
aws cloudformation deploy \
  --region ap-southeast-1 \
  --stack-name sarvodaya-connect-test-agentcore \
  --template-file infrastructure/aws/agentcore-test.yaml \
  --capabilities CAPABILITY_IAM \
  --tags Project=SarvodayaConnect Environment=test \
  --no-execute-changeset
```

Review and execute the change set. When the stack is ready, retrieve its
repository URI and push an ARM64 image. Use an immutable commit tag.

```bash
repo_uri=$(aws cloudformation describe-stacks \
  --region ap-southeast-1 \
  --stack-name sarvodaya-connect-test-agentcore \
  --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue | [0]" \
  --output text) &&
image_tag=$(git rev-parse --short HEAD) &&
test -n "$repo_uri" && test "$repo_uri" != "None" &&
aws ecr get-login-password --region ap-southeast-1 |
  docker login --username AWS --password-stdin "${repo_uri%%/*}"
```

```bash
docker buildx build --platform linux/arm64 --provenance=false --sbom=false \
  --file apps/api/Dockerfile.agentcore --tag "$repo_uri:$image_tag" --push . &&
image_digest=$(aws ecr describe-images --region ap-southeast-1 \
  --repository-name "${repo_uri#*/}" --image-ids "imageTag=$image_tag" \
  --query 'imageDetails[0].imageDigest' --output text) &&
aws cloudformation deploy \
  --region ap-southeast-1 \
  --stack-name sarvodaya-connect-test-agentcore \
  --template-file infrastructure/aws/agentcore-test.yaml \
  --capabilities CAPABILITY_IAM \
  --tags Project=SarvodayaConnect Environment=test \
  --parameter-overrides "RuntimeImageDigest=$image_digest" \
  --no-execute-changeset
```

Review and execute the second change set, then copy the stack's `RuntimeArn`
output. The runtime role can pull the image and write operational logs. The
runtime has no database credentials or model invocation permission.

## Connect the TEST API

Apply any pending database migrations for the reviewed API commit through the
existing TEST migration process. Build the API Lambda artifact from the same
commit and create an update change set for the existing Singapore TEST API stack using
`infrastructure/aws/template.yaml`. Set `SarvoAiAgentCoreRuntimeArn` to the
output above. Keep the existing stack tags, Haiku 4.5 model, pricing approval,
fictional-only setting, and US$3 application spending limit. Review the
Lambda's code, environment, and role changes before executing. The previous TEST
deployment deliberately omitted the independent Cognito account-deletion
permission, so retain that deployment choice unless it is being rolled out.

The API attaches WebSocket invocation permission for the selected runtime and
its DEFAULT endpoint. With `SarvoAiAgentCoreRuntimeArn` empty, the API continues
to run LangGraph in Lambda. Clear the parameter through the same TEST stack to
roll back the runtime integration.

## Verify

Ask for the FY 2025/26 overview of `TEST-A01` from the TEST HQ dashboard. Verify
the result against the baseline, including four missing Registrar uploads,
source records and settled reservations for each Bedrock call. Check the duration
on both a cold and a warm request since the API's existing 22-second question
deadline also covers the AgentCore connection. Dashboard responses currently
continue through the existing buffered API endpoint.
