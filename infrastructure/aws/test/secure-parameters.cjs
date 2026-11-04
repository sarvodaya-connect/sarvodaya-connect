// Embedded into the foundation template by render-foundation.py. Node's Lambda
// runtime provides AWS SDK v3. No values are returned, logged or put in outputs.
const { SSMClient, GetParameterCommand, ListTagsForResourceCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');
const { randomBytes } = require('node:crypto');
const https = require('node:https');

async function ensureParameters(event, client) {
  if (process.env.AWS_REGION !== 'ap-southeast-1' || event.ResourceProperties.Prefix !== '/sarvodaya-connect/test') {
    throw new Error('Invalid test parameter scope');
  }
  if (event.RequestType === 'Delete') return; // Retain encryption/backup recovery material.
  const specs = [['database-master-password', 24], ['nic-encryption-key', 32]];
  // Inspect every existing name before creating any parameter. Never overwrite.
  const missing = [];
  for (const [suffix, bytes] of specs) {
    const name = `${event.ResourceProperties.Prefix}/${suffix}`;
    try {
      const existing = await client.send(new GetParameterCommand({ Name: name, WithDecryption: false }));
      if (existing.Parameter?.Type !== 'SecureString') throw new Error('Existing parameter must be encrypted');
      const tags = await client.send(new ListTagsForResourceCommand({ ResourceType: 'Parameter', ResourceId: name }));
      if (!tags.TagList?.some(tag => tag.Key === 'sarvodaya:stack-id' && tag.Value === event.StackId)) {
        throw new Error('Existing parameter belongs to another owner');
      }
    } catch (error) {
      if (error.name !== 'ParameterNotFound') throw error;
      missing.push([name, bytes]);
    }
  }
  for (const [name, bytes] of missing) {
    await client.send(new PutParameterCommand({
      Name: name, Value: randomBytes(bytes).toString('hex'),
      Type: 'SecureString', Tier: 'Standard', KeyId: 'alias/aws/ssm', Overwrite: false,
      Tags: [
        { Key: 'Project', Value: 'SarvodayaConnect' },
        { Key: 'Environment', Value: 'test' },
        { Key: 'sarvodaya:stack-id', Value: event.StackId },
      ],
    }));
  }
}

function respond(event, status, physicalId) {
  const body = JSON.stringify({
    Status: status,
    Reason: status === 'SUCCESS' ? 'Test parameters prepared; values are never returned' : 'Test parameter preparation failed; check permissions and parameter ownership',
    PhysicalResourceId: physicalId, StackId: event.StackId, RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId, NoEcho: true, Data: {},
  });
  return new Promise((resolve, reject) => {
    const request = https.request(event.ResponseURL, { method: 'PUT', headers: { 'content-type': '', 'content-length': Buffer.byteLength(body) } }, response => {
      response.resume();
      response.on('end', () => response.statusCode >= 200 && response.statusCode < 300 ? resolve() : reject(new Error('CloudFormation response rejected')));
    });
    request.setTimeout(5000, () => request.destroy());
    request.on('error', () => reject(new Error('CloudFormation response could not be delivered')));
    request.end(body);
  });
}

exports.ensureParameters = ensureParameters;
exports.handler = async event => {
  const client = new SSMClient({ maxAttempts: 2 });
  let status = 'SUCCESS';
  try {
    await ensureParameters(event, client);
  } catch (error) {
    status = 'FAILED';
    console.error('Test parameter preparation failed; check permissions and parameter ownership');
  } finally {
    client.destroy();
  }
  await respond(event, status, event.PhysicalResourceId ?? 'sarvodaya-connect-test-encrypted-parameters');
};
