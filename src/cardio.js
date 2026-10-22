import { dateKey, requirePastDate } from './records.js';

export const isCardio = exercise => exercise?.category === '有氧';
export const cardioUnits = ['minutes', 'reps'];
export const unitLabel = unit => unit === 'minutes' ? '分鐘' : '下';
export function cardioValue(input, unit) {
  if (!cardioUnits.includes(unit)) throw Error('請選擇分鐘或下');
  if (!['number', 'string'].includes(typeof input) || String(input).trim() === '') throw Error('請填時間或次數');
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0 || (unit === 'reps' && !Number.isSafeInteger(value))) throw Error(unit === 'reps' ? '次數必須是正整數' : '分鐘必須大於 0');
  return value;
}
export const allRecords = data => [...data.completedEntries, ...(data.cardioEntries || [])];
export const cardioText = record => `${record.value} ${unitLabel(record.unit)}`;
export function cardioComparison(data, id, date, unit) {
  const history = (data.cardioEntries || []).filter(r => r.exerciseId === id && r.unit === unit);
  return {
    previous: history.filter(r => r.dateKey < date).sort((a,b) => b.dateKey.localeCompare(a.dateKey))[0] || null,
    current: history.find(r => r.dateKey === date) || null,
    highest: history.length ? Math.max(...history.map(r => r.value)) : null,
  };
}
export function completeCardio(data, id, date, input, unit, today = dateKey()) {
  requirePastDate(date, today);
  const value = cardioValue(input, unit);
  const exercise = data.exercises.find(e => e.id === id && !e.archived);
  if (!isCardio(exercise)) throw Error('請選擇未封存的有氧動作');
  data.cardioEntries ||= [];
  const current = data.cardioEntries.find(r => r.exerciseId === id && r.dateKey === date && r.unit === unit);
  if (current) { current.value = Math.max(current.value, value); current.updatedAt = new Date().toISOString(); return current; }
  const record = { id: crypto.randomUUID(), exerciseId: id, exerciseName: exercise.name, exerciseCategory: exercise.category, dateKey: date, value, unit, createdAt: new Date().toISOString() };
  data.cardioEntries.push(record); return record;
}
export function correctCardio(data, id, input, today = dateKey()) {
  const record = (data.cardioEntries || []).find(r => r.id === id);
  if (!record) throw Error('找不到這筆紀錄');
  requirePastDate(record.dateKey, today);
  record.value = cardioValue(input, record.unit); record.updatedAt = new Date().toISOString();
}
export function validateCardio(data) {
  if (data.cardioEntries !== undefined && !Array.isArray(data.cardioEntries)) throw Error('有氧紀錄格式不正確');
  const keys = new Set(), ids = new Set(data.completedEntries.map(r => r.id));
  for (const r of data.cardioEntries || []) {
    if (!r || typeof r.id !== 'string' || typeof r.exerciseId !== 'string' || typeof r.exerciseName !== 'string' || typeof r.value !== 'number') throw Error('有氧紀錄格式不正確');
    requirePastDate(r.dateKey, '9999-12-31'); cardioValue(r.value, r.unit);
    const key = JSON.stringify([r.exerciseId, r.dateKey, r.unit]);
    if (keys.has(key) || ids.has(r.id)) throw Error('有氧紀錄重複');
    keys.add(key); ids.add(r.id);
  }
}
