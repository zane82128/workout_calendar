import test from 'node:test';
import assert from 'node:assert/strict';
import { toKg, fromKg, displayWeight, recordedUnit, completeInUnit, correctInUnit } from '../src/weight-units.js';
const data = () => ({ exercises: [{ id: 'bench', name: '臥推' }], completedEntries: [] });
test('lb conversion is normalized to kg, blank/negative/invalid units rejected, zero supported', () => {
  assert.equal(toKg(20, 'lb'), 9.071847400000001); assert.equal(fromKg(toKg(20, 'lb'), 'lb'), 20);
  assert.equal(toKg(0, 'lb'), 0);
  for (const [input, unit] of [['', 'kg'], [-1, 'lb'], ['bad', 'kg'], [1, 'ton']]) assert.throws(() => toKg(input, unit));
});
test('mixed units compare actual weights, a lower retry preserves winning input unit', () => {
  const d = data(); completeInUnit(d, 'bench', '2026-10-01', 20, 'lb', '2026-10-02');
  assert.equal(recordedUnit(d.completedEntries[0]), 'lb');
  completeInUnit(d, 'bench', '2026-10-01', 10, 'kg', '2026-10-02');
  assert.equal(d.completedEntries[0].weight, 10); assert.equal(recordedUnit(d.completedEntries[0]), 'kg');
  completeInUnit(d, 'bench', '2026-10-01', 20, 'lb', '2026-10-02');
  assert.equal(d.completedEntries.length, 1); assert.equal(d.completedEntries[0].weight, 10); assert.equal(recordedUnit(d.completedEntries[0]), 'kg');
});
test('correction uses selected unit, stale metadata cannot override canonical kg', () => {
  const d = data(); const r = completeInUnit(d, 'bench', '2026-10-01', 20, 'lb', '2026-10-02');
  correctInUnit(d, r.id, 5, 'kg', '2026-10-02'); assert.equal(r.weight, 5); assert.equal(recordedUnit(r), 'kg');
  r.inputUnit = 'lb'; r.inputWeight = 20; assert.equal(recordedUnit(r), 'kg');
});
test('untouched rounded prefill keeps exact comparison weight', () => {
  const d = data(), exact = toKg(20, 'lb');
  const r = completeInUnit(d, 'bench', '2026-10-01', '9.07', 'kg', '2026-10-02', exact);
  assert.equal(r.weight, exact); assert.equal(displayWeight(exact, 'lb'), '20 lb');
  assert.equal(displayWeight(null, 'lb'), '尚無紀錄');
});
