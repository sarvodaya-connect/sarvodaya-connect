// Tests the actual inline Lambda source without AWS access or credentials.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { EventEmitter } = require('node:events');
const { randomBytes } = require('node:crypto');

const prefix = '/sarvodaya-connect/test';
const stackId = 'arn:aws:cloudformation:ap-southeast-1:123456789012:stack/fictional-test/fictional';
const event = () => ({
  RequestType: 'Create', ResourceProperties: { Prefix: prefix }, StackId: stackId,
  RequestId: 'fictional-request', LogicalResourceId: 'SecureParameters',
  ResponseURL: 'https://response.test.invalid/never-contacted',
});

function setup({ region = 'ap-southeast-1', existing = {}, failure, responseStatus = 200 } = {}) {
  const calls = [], responses = [], errors = [];
  let destroyed = false;
  const commands = Object.fromEntries(['GetParameterCommand', 'ListTagsForResourceCommand', 'PutParameterCommand'].map(name => [name, class {
    constructor(input) { this.kind = name; this.input = input; }
  }]));
  const client = {
    async send(command) {
      calls.push(command);
      if (failure) throw failure;
      const name = command.input.Name ?? command.input.ResourceId;
      if (command.kind === 'GetParameterCommand') {
        if (!existing[name]) throw Object.assign(new Error('fictional missing'), { name: 'ParameterNotFound' });
        return { Parameter: { Type: existing[name].type ?? 'SecureString' } };
      }
      if (command.kind === 'ListTagsForResourceCommand') return { TagList: [{ Key: 'sarvodaya:stack-id', Value: existing[name].owner }] };
      if (command.kind === 'PutParameterCommand') return { Version: 1 };
      throw new Error('Unexpected SDK command');
    },
    destroy() { destroyed = true; },
  };
  const exports = {};
  runInNewContext(readFileSync(join(__dirname, 'secure-parameters.cjs'), 'utf8'), {
    exports, process: { env: { AWS_REGION: region } }, Buffer,
    console: { error: (...args) => errors.push(args.join(' ')) },
    require(name) {
      if (name === '@aws-sdk/client-ssm') return { ...commands, SSMClient: class { constructor() { return client; } } };
      if (name === 'node:crypto') return { randomBytes };
      if (name === 'node:https') return { request(url, options, callback) {
        assert.equal(url, 'https://response.test.invalid/never-contacted');
        assert.equal(options.method, 'PUT');
        const request = new EventEmitter();
        request.setTimeout = () => request;
        request.end = body => {
          responses.push(JSON.parse(body));
          const response = new EventEmitter();
          response.statusCode = responseStatus;
          response.resume = () => {};
          callback(response);
          response.emit('end');
        };
        return request;
      } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { ...exports, client, calls, responses, errors, wasDestroyed: () => destroyed };
}

const puts = state => state.calls.filter(command => command.kind === 'PutParameterCommand');

test('creates only two encrypted, tagged test parameters, without returning values', async () => {
  const state = setup();
  assert.equal(await state.ensureParameters(event(), state.client), undefined);
  assert.deepEqual(puts(state).map(command => command.input.Name), [`${prefix}/database-master-password`, `${prefix}/nic-encryption-key`]);
  assert.match(puts(state)[0].input.Value, /^[a-f0-9]{48}$/);
  assert.match(puts(state)[1].input.Value, /^[a-f0-9]{64}$/);
  for (const { input } of puts(state)) {
    assert.equal(input.Type, 'SecureString');
    assert.equal(input.Tier, 'Standard');
    assert.equal(input.KeyId, 'alias/aws/ssm');
    assert.equal(input.Overwrite, false);
    assert.ok(input.Tags.some(tag => tag.Key === 'sarvodaya:stack-id' && tag.Value === stackId));
  }
  assert.ok(state.calls.filter(command => command.kind === 'GetParameterCommand').every(command => command.input.WithDecryption === false));
});

test('same-stack retry and update preserve all existing keys', async () => {
  for (const RequestType of ['Create', 'Update']) {
    const existing = Object.fromEntries(['database-master-password', 'nic-encryption-key'].map(suffix => [`${prefix}/${suffix}`, { owner: stackId }]));
    const state = setup({ existing });
    await state.ensureParameters({ ...event(), RequestType }, state.client);
    assert.equal(puts(state).length, 0);
  }
});

test('partial retry creates only the missing parameter', async () => {
  const state = setup({ existing: { [`${prefix}/database-master-password`]: { owner: stackId } } });
  await state.ensureParameters(event(), state.client);
  assert.equal(puts(state).length, 1);
  assert.equal(puts(state)[0].input.Name, `${prefix}/nic-encryption-key`);
});

test('inspects every name before writing, so a later ownership collision creates nothing', async () => {
  const state = setup({ existing: { [`${prefix}/nic-encryption-key`]: { owner: 'another-stack' } } });
  await assert.rejects(state.ensureParameters(event(), state.client), /another owner/);
  assert.equal(puts(state).length, 0);
});

test('refuses plaintext even when it has this stack ownership tag', async () => {
  const state = setup({ existing: { [`${prefix}/database-master-password`]: { owner: stackId, type: 'String' } } });
  await assert.rejects(state.ensureParameters(event(), state.client), /encrypted/);
  assert.equal(puts(state).length, 0);
});

test('wrong region or prefix fails before any AWS calls', async () => {
  for (const [region, Prefix] of [['us-east-1', prefix], ['ap-southeast-1', '/sarvodaya-connect/production']]) {
    const state = setup({ region });
    await assert.rejects(state.ensureParameters({ ...event(), ResourceProperties: { Prefix } }, state.client), /scope/);
    assert.equal(state.calls.length, 0);
  }
});

test('delete retains recovery material and makes no SSM calls', async () => {
  const state = setup();
  await state.ensureParameters({ ...event(), RequestType: 'Delete' }, state.client);
  assert.equal(state.calls.length, 0);
});

test('SDK failures propagate without creating replacement keys', async () => {
  const state = setup({ failure: new Error('fictional service failure') });
  await assert.rejects(state.ensureParameters(event(), state.client), /fictional service failure/);
  assert.equal(puts(state).length, 0);
});

test('success closes SDK client and sends no values to CloudFormation', async () => {
  const state = setup();
  await state.handler(event());
  assert.equal(state.wasDestroyed(), true);
  assert.equal(state.responses[0].Status, 'SUCCESS');
  assert.equal(state.responses[0].NoEcho, true);
  assert.deepEqual(state.responses[0].Data, {});
  for (const { input } of puts(state)) assert.ok(!JSON.stringify(state.responses).includes(input.Value));
});

test('failure response and logs redact the original SDK error and its name', async () => {
  const secret = 'fictional-secret-value';
  const state = setup({ failure: Object.assign(new Error(secret), { name: secret }) });
  await state.handler(event());
  assert.equal(state.wasDestroyed(), true);
  assert.equal(state.responses[0].Status, 'FAILED');
  assert.ok(!JSON.stringify([state.responses, state.errors]).includes(secret));
});

test('preserves the physical ID on updates', async () => {
  const state = setup();
  await state.handler({ ...event(), RequestType: 'Update', PhysicalResourceId: 'existing-physical-id' });
  assert.equal(state.responses[0].PhysicalResourceId, 'existing-physical-id');
});

test('CloudFormation response rejection is surfaced', async () => {
  const state = setup({ responseStatus: 403 });
  await assert.rejects(state.handler(event()), /response rejected/);
  assert.equal(state.wasDestroyed(), true);
});
