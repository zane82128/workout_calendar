// Product rules: pure functions, independent of DOM and browser storage.
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) throw new Error('請選擇有效日期');
  const [y, m, d] = key.split('-').map(Number);
  const result = new Date(y, m - 1, d);
  if (dateKey(result) !== key) throw new Error('請選擇有效日期');
  return result;
}

export function requirePastDate(key, today = dateKey()) {
  parseDate(key);
  if (key > today) throw new Error('不能記錄未來日期');
  return key;
}

export function weightValue(input) {
  if (!['number', 'string'].includes(typeof input) || String(input).trim() === '') throw new Error('請填重量，徒手填 0');
  const weight = Number(input);
  if (!Number.isFinite(weight) || weight < 0) throw new Error('重量必須是 0 或正數');
  return weight;
}

export function comparison(records, exerciseId, selectedDate) {
  const history = records.filter((r) => r.exerciseId === exerciseId);
  return {
    previous: history.filter((r) => r.dateKey < selectedDate).sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] || null,
    current: history.find((r) => r.dateKey === selectedDate) || null,
    highest: history.length ? Math.max(...history.map((r) => r.weight)) : null,
  };
}

export function complete(data, exerciseId, selectedDate, input, today = dateKey()) {
  requirePastDate(selectedDate, today);
  const weight = weightValue(input);
  const exercise = data.exercises.find((e) => e.id === exerciseId && !e.archived);
  if (!exercise) throw new Error('請先選擇未封存的動作');
  const existing = data.completedEntries.find((r) => r.exerciseId === exerciseId && r.dateKey === selectedDate);
  if (existing) {
    existing.weight = Math.max(existing.weight, weight);
    existing.updatedAt = new Date().toISOString();
    return existing;
  }
  const entry = {
    id: crypto.randomUUID(), exerciseId, exerciseName: exercise.name,
    exerciseCategory: exercise.category, dateKey: selectedDate, weight, unit: 'kg',
    createdAt: new Date().toISOString(),
  };
  data.completedEntries.push(entry);
  return entry;
}

export function correct(data, id, input, today = dateKey()) {
  const record = data.completedEntries.find((r) => r.id === id);
  if (!record) throw new Error('找不到這筆紀錄，請重新選擇');
  requirePastDate(record.dateKey, today);
  record.weight = weightValue(input);
  record.updatedAt = new Date().toISOString();
}

export function validName(data, name, excludingId = null) {
  const result = String(name || '').trim();
  if (!result) throw new Error('請填動作名稱');
  if (data.exercises.some((e) => e.id !== excludingId && e.name.trim().toLowerCase() === result.toLowerCase())) {
    throw new Error('已有同名動作，請改名或恢復封存動作');
  }
  return result;
}

export function fourWeeks(key) {
  const anchor = parseDate(key);
  anchor.setDate(anchor.getDate() - anchor.getDay() - 14);
  return Array.from({ length: 28 }, (_, i) => {
    const result = new Date(anchor);
    result.setDate(result.getDate() + i);
    return dateKey(result);
  });
}
