import { weightValue, complete, correct } from './records.js';

export const KG_PER_LB = 0.45359237;
export function validUnit(unit) { if (!['kg', 'lb'].includes(unit)) throw Error('請選擇 kg 或 lb'); return unit; }
export const toKg = (input, unit) => {
  const value = weightValue(input) * (validUnit(unit) === 'lb' ? KG_PER_LB : 1);
  if (!Number.isFinite(value)) throw Error('重量過大'); return value;
};
export const fromKg = (value, unit) => value / (validUnit(unit) === 'lb' ? KG_PER_LB : 1);
export const inputNumber = (kg, unit) => {
  const value = fromKg(kg, unit), rounded = Number(value.toFixed(2));
  return (value > 0 && rounded === 0 ? value : rounded).toString();
};
export const displayWeight = (kg, unit) => kg === null ? '尚無紀錄' : `${inputNumber(kg, unit)} ${unit}`;
// Old v2 apps can edit canonical kg without refreshing optional input metadata.
// Treat stale metadata as absent, never let it override the actual saved weight.
export function recordedUnit(record) {
  if (['kg', 'lb'].includes(record.inputUnit) && typeof record.inputWeight === 'number' && Number.isFinite(record.inputWeight) && record.inputWeight >= 0) {
    const canonical = toKg(record.inputWeight, record.inputUnit);
    if (Math.abs(canonical - record.weight) <= 1e-10 * Math.max(1, record.weight)) return record.inputUnit;
  }
  return 'kg';
}
export function completeInUnit(data, id, date, input, unit, today, exactKg) {
  const converted = toKg(input, unit);
  const kg = exactKg === undefined ? converted : weightValue(exactKg);
  const record = complete(data, id, date, kg, today);
  if (record.weight === kg) { record.inputUnit = unit; record.inputWeight = fromKg(kg, unit); }
  return record;
}
export function correctInUnit(data, id, input, unit, today, exactKg) {
  const converted = toKg(input, unit);
  const kg = exactKg === undefined ? converted : weightValue(exactKg);
  correct(data, id, kg, today);
  const record = data.completedEntries.find(r => r.id === id);
  record.inputUnit = unit; record.inputWeight = fromKg(kg, unit);
}
