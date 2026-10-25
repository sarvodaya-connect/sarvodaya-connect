import assert from 'node:assert/strict';
import test from 'node:test';
import * as contracts from "../dist/index.js";

test('registry approval allowlist is explicit and covers every submission type once', () => {
  const registry = [...contracts.REGISTRY_UPDATE_TYPES];
  const recordOnly = [...contracts.RECORD_ONLY_SUBMISSION_TYPES];
  assert.deepEqual(registry, ['PROFILE_UPDATE', 'COUNCIL_UPDATE', 'MEMBERSHIP_COUNTS']);
  assert.deepEqual(recordOnly, ['ACTIVITY_REPORT', 'PAYMENT']);
  assert.deepEqual([...registry, ...recordOnly].sort(), [...contracts.SUBMISSION_TYPES].sort());
});

test('system-controlled and unconfirmed fields are not approvable', () => {
  for (const field of ['id', 'societyCode', 'districtId', 'status', 'primaryContact']) {
    assert.ok(!contracts.REGISTRY_UPDATE_PROFILE_FIELDS.includes(field), field);
  }
  for (const field of ['seatNumber', 'seatType', 'age', 'phone', 'email', 'isActive', 'isPrimaryContact']) {
    assert.ok(!contracts.REGISTRY_UPDATE_COUNCIL_FIELDS.includes(field), field);
  }
});

test('field path builders produce the paths the API accepts', () => {
  assert.equal(contracts.registryUpdateFieldPath.profile('village'), 'profile.village');
  assert.equal(contracts.registryUpdateFieldPath.council(3, 'endedOn'), 'council.3.endedOn');
  assert.equal(
    contracts.registryUpdateFieldPath.membership(2026, 'CHILDREN', 'female'),
    'membership.2026.CHILDREN.female',
  );
});
