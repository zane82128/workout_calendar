import test from 'node:test';
import assert from 'node:assert/strict';
import { exerciseOrder, exerciseLabel, saveSet, importSet } from '../src/training.js';
import { decode, createStore, STORAGE_KEY, TRAINING_BACKUP_KEY } from '../src/storage.js';
const data = () => ({ exercises: [{ id: 'a', name: '平板臥推', category: '胸' }, { id: 'b', name: '上斜臥推', category: '胸' }, { id: 'c', name: '引體向上', category: '背' }], entries: [], completedEntries: [] });
test('category-first stroke order is explicit and labels put category first', () => {
  const items = data().exercises.reverse().sort(exerciseOrder);
  assert.deepEqual(items.map(e => e.id), ['b', 'a', 'c']); assert.equal(exerciseLabel(items[0]), '胸 · 上斜臥推');
});
test('save and edit a set, duplicate names and archived exercises rejected', () => {
  const d = data(); saveSet(d, null, '推日', ['b', 'a']); const id = d.trainingSets[0].id;
  assert.throws(() => saveSet(d, null, '推日', ['a']));
  saveSet(d, id, '胸日', ['a', 'b']); assert.deepEqual(d.trainingSets[0].exerciseIds, ['a', 'b']);
  d.exercises[0].archived = true; assert.throws(() => saveSet(d, id, '胸日', ['a']));
});
test('import adds plans only, deduplicates, skips archived and completed, disallows future', () => {
  const d = data(); saveSet(d, null, '組合', ['b', 'a', 'c']); const id = d.trainingSets[0].id;
  d.exercises[2].archived = true;
  assert.deepEqual(importSet(d, id, '2026-10-21', '2026-10-21'), { added: 2, skipped: 1 });
  assert.equal(d.completedEntries.length, 0);
  assert.deepEqual(importSet(d, id, '2026-10-21', '2026-10-21'), { added: 0, skipped: 1 });
  assert.deepEqual(d.plannedExercises.map(p => p.exerciseId), ['b', 'a']);
  d.completedEntries.push({ exerciseId: 'a', dateKey: '2026-10-20' });
  assert.equal(importSet(d, id, '2026-10-20', '2026-10-21').added, 1);
  assert.throws(() => importSet(d, id, '2026-10-22', '2026-10-21'));
});
test('plans are independent snapshots; changing/deleting set and renaming source keep them', () => {
  const d = data(); saveSet(d, null, '組合', ['a']); importSet(d, d.trainingSets[0].id, '2026-10-21', '2026-10-21');
  d.exercises[0].name = '新名稱'; d.trainingSets = [];
  assert.equal(d.plannedExercises[0].exerciseName, '平板臥推');
  assert.equal(decode(JSON.stringify(d)).plannedExercises[0].exerciseName, '平板臥推');
});
test('optional additive fields validate without removing old fields', () => {
  const d = { ...data(), recordMemo: '舊資料' }; assert.equal(decode(JSON.stringify(d)).recordMemo, '舊資料');
  assert.throws(() => decode(JSON.stringify({ ...d, trainingSets: {} })));
  assert.throws(() => decode(JSON.stringify({ ...d, plannedExercises: [{ dateKey: 'bad', exerciseId: 'a', exerciseName: 'A' }] })));
});
test('first training write backs up original; backup failure cannot overwrite source', () => {
  const raw = JSON.stringify(data()), values = new Map([[STORAGE_KEY, raw]]);
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const store = createStore(storage);
  store.transaction(d => saveSet(d, null, '推日', ['a']));
  assert.equal(values.get(TRAINING_BACKUP_KEY), raw);
  const other = new Map([[STORAGE_KEY, raw]]);
  const failed = createStore({ getItem: k => other.get(k) ?? null, setItem: (k, v) => { if (k === TRAINING_BACKUP_KEY) throw Error('quota'); other.set(k, v); } });
  assert.throws(() => failed.transaction(d => saveSet(d, null, '推日', ['a'])));
  assert.equal(other.get(STORAGE_KEY), raw);
});
