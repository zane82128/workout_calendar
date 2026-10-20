import test from 'node:test';
import assert from 'node:assert/strict';
import { complete, correct, comparison, weightValue, requirePastDate, validName, fourWeeks } from '../src/records.js';
import { createStore, STORAGE_KEY, BACKUP_KEY } from '../src/storage.js';
import { remaining } from '../src/rest-timer.js';

const data = () => ({ exercises: [{ id: 'ex', name: '臥推', category: '胸' }], entries: [{ weight: 9999, unit: 'lb' }], completedEntries: [] });
const finish = (d, date, weight) => complete(d, 'ex', date, weight, '2026-10-20');
test('同日最高、重複點擊、隔日獨立與徒手零值', () => {
  const d = data(); finish(d, '2026-10-01', 40); finish(d, '2026-10-01', 45); finish(d, '2026-10-01', 42.5); finish(d, '2026-10-01', 45);
  assert.equal(d.completedEntries.length, 1); assert.equal(d.completedEntries[0].weight, 45);
  finish(d, '2026-10-02', 0); assert.equal(d.completedEntries[1].weight, 0);
});
test('補登順序不影響上次，上次排除當天，最高不取舊資料', () => {
  const d = data(); finish(d, '2026-10-03', 45); finish(d, '2026-10-01', 40); finish(d, '2026-10-04', 42.5);
  assert.equal(comparison(d.completedEntries, 'ex', '2026-10-04').previous.weight, 45);
  assert.equal(comparison(d.completedEntries, 'ex', '2026-10-05').previous.weight, 42.5);
  assert.equal(comparison(d.completedEntries, 'ex', '2026-10-02').previous.weight, 40);
  assert.equal(comparison(d.completedEntries, 'ex', '2026-10-01').previous, null);
  assert.equal(comparison(d.completedEntries, 'ex', '2026-10-01').highest, 45);
});
test('更正可降低、刪除重算、全部刪完不回補舊資料', () => {
  const d = data(); finish(d, '2026-10-01', 40); const record = finish(d, '2026-10-02', 45);
  correct(d, record.id, 35, '2026-10-20'); assert.equal(comparison(d.completedEntries, 'ex', '2026-10-03').highest, 40);
  d.completedEntries.splice(0, 1); assert.equal(comparison(d.completedEntries, 'ex', '2026-10-03').highest, 35);
  d.completedEntries = []; assert.equal(comparison(d.completedEntries, 'ex', '2026-10-03').highest, null);
});
test('拒絕空白、負值、非數字、無限值及錯誤日期', () => {
  for (const v of ['', ' ', -1, 'abc', Infinity, NaN, null, false]) assert.throws(() => weightValue(v));
  assert.equal(weightValue('0'), 0); assert.equal(weightValue('1.25'), 1.25);
  for (const key of ['2026-02-30', '2026-1-1', '2026-10-21']) assert.throws(() => requirePastDate(key, '2026-10-20'));
});
test('封存不可完成、恢復身份持續、改名不改過去快照', () => {
  const d = data(); const record = finish(d, '2026-10-01', 40);
  d.exercises[0].name = validName(d, '新版臥推', 'ex'); d.exercises[0].archived = true;
  assert.throws(() => finish(d, '2026-10-02', 45)); d.exercises[0].archived = false;
  finish(d, '2026-10-02', 45); correct(d, record.id, 35, '2026-10-20');
  assert.equal(record.exerciseName, '臥推'); assert.equal(d.completedEntries[1].exerciseName, '新版臥推');
  assert.equal(comparison(d.completedEntries, 'ex', '2026-10-03').highest, 45);
  assert.throws(() => validName(d, '新版臥推'));
});
function memory(initial) {
  const map = new Map(initial === null ? [] : [[STORAGE_KEY, initial]]);
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
}
test('首次遷移先備份原始字串，保留退休欄位與舊資料不改寫', () => {
  const original = JSON.stringify({ ...data(), recordMemo: 'memo', scheduleTimerElapsedSeconds: 99, presetVersionApplied: '2026-02-07-v2' });
  const storage = memory(original), store = createStore(storage); store.initialize();
  assert.equal(storage.getItem(BACKUP_KEY), original);
  const result = store.read(); assert.equal(result.schemaVersion, 2); assert.equal(result.recordMemo, 'memo');
  assert.equal(result.scheduleTimerElapsedSeconds, 99); assert.deepEqual(result.entries, JSON.parse(original).entries);
  store.transaction((next) => finish(next, '2026-10-01', 40)); assert.equal(storage.getItem(BACKUP_KEY), original);
});
test('備份失敗就不覆寫舊資料', () => {
  const original = JSON.stringify(data()), storage = memory(original), base = storage.setItem;
  storage.setItem = (key, value) => { if (key === BACKUP_KEY) throw new Error('quota'); base(key, value); };
  assert.throws(() => createStore(storage).initialize()); assert.equal(storage.getItem(STORAGE_KEY), original);
});
test('損壞或較新資料格式不覆寫', () => {
  for (const raw of ['broken', 'null', '{"schemaVersion":99}', '{"completedEntries":{}}']) {
    const storage = memory(raw); assert.throws(() => createStore(storage).initialize()); assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});
test('每次交易取最新資料，失敗不污染儲存', () => {
  const storage = memory(null), one = createStore(storage), two = createStore(storage); one.initialize();
  one.transaction((d) => { d.recordMemo = '另一頁的新資料'; });
  two.transaction((d) => { d.unknownField = '保留'; }); assert.equal(one.read().recordMemo, '另一頁的新資料');
  const before = storage.getItem(STORAGE_KEY); assert.throws(() => one.transaction((d) => { d.exercises = null; })); assert.equal(storage.getItem(STORAGE_KEY), before);
});
test('四週日曆跨月份且以週日開始', () => {
  const dates = fourWeeks('2026-11-02'); assert.equal(dates.length, 28); assert.equal(dates[0], '2026-10-18'); assert.equal(dates[27], '2026-11-14');
});
test('休息倒數使用時間戳，暫停不繼續扣秒', () => {
  const state = { restTimerRunning: true, restTimerStartedAt: 1000, restTimerRemainingSeconds: 90 };
  assert.equal(remaining(state, 31000), 60); assert.equal(remaining(state, 100000), 0);
  state.restTimerRunning = false; assert.equal(remaining(state, 31000), 90);
});
