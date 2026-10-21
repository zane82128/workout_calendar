import { PRESET_EXERCISES, PRESET_VERSION } from './preset-exercises.js';
import { parseDate, weightValue } from './records.js';
import { validateTraining } from './training.js';

export const STORAGE_KEY = 'workoutCalendar.v1';
export const BACKUP_KEY = 'workoutCalendar.backup.beforeWeightV2';
export const TRAINING_BACKUP_KEY = 'workoutCalendar.backup.beforeTrainingSets';
export const DATA_VERSION = 2;
export class StorageFailure extends Error {}

export function decode(raw) {
  const data = raw === null ? {} : JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('儲存資料格式不正確，原資料未修改');
  if (data.schemaVersion !== undefined && (!Number.isInteger(data.schemaVersion) || data.schemaVersion > DATA_VERSION)) throw new Error('此資料需要較新的 App，請先更新');
  for (const key of ['exercises', 'entries', 'completedEntries', 'trainingSets', 'plannedExercises']) {
    if (data[key] !== undefined && !Array.isArray(data[key])) throw new Error('紀錄格式不正確，原資料未修改');
  }
  const result = { ...data, exercises: data.exercises || [], entries: data.entries || [], completedEntries: data.completedEntries || [] };
  const names = new Set();
  for (const e of result.exercises) {
    if (!e || typeof e.id !== 'string' || typeof e.name !== 'string' || names.has(e.id)) throw new Error('動作資料不正確，原資料未修改');
    names.add(e.id);
  }
  const days = new Set(), ids = new Set();
  for (const r of result.completedEntries) {
    if (!r || typeof r.id !== 'string' || typeof r.exerciseId !== 'string' || typeof r.exerciseName !== 'string' || r.unit !== 'kg' || typeof r.weight !== 'number') throw new Error('完成紀錄不正確，原資料未修改');
    parseDate(r.dateKey); weightValue(r.weight);
    const key = JSON.stringify([r.exerciseId, r.dateKey]);
    if (days.has(key) || ids.has(r.id)) throw new Error('完成紀錄重複，原資料未修改');
    days.add(key); ids.add(r.id);
  }
  validateTraining(result);
  return result;
}

// Every transaction reads the latest data, validates and writes before the UI
// reports success. Unknown/retired fields and legacy entries are kept intact.
export function createStore(storage) {
  function access(operation) {
    try { return operation(); } catch (error) { throw new StorageFailure(`資料無法讀寫，請保留原資料並重試：${error.message}`); }
  }
  const read = () => access(() => decode(storage.getItem(STORAGE_KEY)));
  function transaction(mutator) {
    const raw = access(() => storage.getItem(STORAGE_KEY));
    const data = access(() => decode(raw));
    if (raw !== null && (data.schemaVersion || 1) < DATA_VERSION && access(() => storage.getItem(BACKUP_KEY)) === null) access(() => storage.setItem(BACKUP_KEY, raw));
    mutator(data);
    data.schemaVersion = DATA_VERSION;
    const serialized = JSON.stringify(data);
    access(() => decode(serialized));
    if (raw !== null) {
      const previous = JSON.parse(raw);
      const addsTraining = ['trainingSets', 'plannedExercises'].some(key => previous[key] === undefined && data[key] !== undefined);
      if (addsTraining && access(() => storage.getItem(TRAINING_BACKUP_KEY)) === null) access(() => storage.setItem(TRAINING_BACKUP_KEY, raw));
    }
    access(() => storage.setItem(STORAGE_KEY, serialized));
    return data;
  }
  function initialize() {
    const data = read();
    if (data.schemaVersion === DATA_VERSION && data.presetVersionApplied === PRESET_VERSION) return data;
    return transaction((next) => {
      if (next.presetVersionApplied === PRESET_VERSION) return;
      const existing = new Set(next.exercises.map((e) => e.name.trim().toLowerCase()));
      for (const preset of PRESET_EXERCISES) {
        if (existing.has(preset.name.toLowerCase())) continue;
        next.exercises.push({ id: crypto.randomUUID(), ...preset, createdAt: new Date().toISOString() });
        existing.add(preset.name.toLowerCase());
      }
      next.presetVersionApplied = PRESET_VERSION;
    });
  }
  return { read, transaction, initialize };
}
