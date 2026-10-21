import { EXERCISE_CATEGORIES, DEFAULT_EXERCISE_CATEGORY } from './preset-exercises.js';
import { requirePastDate } from './records.js';

const stroke = new Intl.Collator('zh-Hant-TW-u-co-stroke', { numeric: true, sensitivity: 'variant' });
export const categoryOf = e => e.category || DEFAULT_EXERCISE_CATEGORY;
export const exerciseLabel = e => `${categoryOf(e)} · ${e.name}`;
export function exerciseOrder(a, b) {
  const rank = e => { const index = EXERCISE_CATEGORIES.indexOf(categoryOf(e)); return index < 0 ? EXERCISE_CATEGORIES.length : index; };
  return rank(a) - rank(b) || stroke.compare(a.name, b.name) || String(a.id).localeCompare(String(b.id), 'en');
}
export function saveSet(data, id, name, exerciseIds) {
  name = name.trim();
  if (!name || name.length > 40) throw Error('請填寫組合名稱（最多 40 字）');
  if (!exerciseIds.length || new Set(exerciseIds).size !== exerciseIds.length) throw Error('請選擇不重複的動作');
  if (exerciseIds.some(id => !data.exercises.some(e => e.id === id && !e.archived))) throw Error('部分動作已封存或不存在，請重新選擇');
  data.trainingSets ||= [];
  if (data.trainingSets.some(s => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) throw Error('組合名稱已存在');
  const current = data.trainingSets.find(s => s.id === id);
  if (id && !current) throw Error('組合已被刪除，請重新建立');
  if (current) Object.assign(current, { name, exerciseIds: [...exerciseIds] });
  else data.trainingSets.push({ id: crypto.randomUUID(), name, exerciseIds: [...exerciseIds] });
}
export function importSet(data, id, date, today) {
  requirePastDate(date, today);
  const set = (data.trainingSets || []).find(s => s.id === id);
  if (!set) throw Error('組合已不存在');
  data.plannedExercises ||= [];
  let added = 0, skipped = 0;
  for (const exerciseId of set.exerciseIds) {
    const exercise = data.exercises.find(e => e.id === exerciseId && !e.archived);
    if (!exercise) { skipped++; continue; }
    if (data.plannedExercises.some(p => p.dateKey === date && p.exerciseId === exerciseId) || data.completedEntries.some(r => r.dateKey === date && r.exerciseId === exerciseId)) continue;
    data.plannedExercises.push({ dateKey: date, exerciseId, exerciseName: exercise.name, category: categoryOf(exercise) }); added++;
  }
  return { added, skipped };
}
export function validateTraining(data) {
  const ids = new Set();
  for (const s of data.trainingSets || []) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id) || typeof s.name !== 'string' || !s.name.trim() || !Array.isArray(s.exerciseIds) || !s.exerciseIds.length || s.exerciseIds.some(id => typeof id !== 'string') || new Set(s.exerciseIds).size !== s.exerciseIds.length) throw Error('訓練組合格式不正確');
    ids.add(s.id);
  }
  const days = new Set();
  for (const p of data.plannedExercises || []) {
    // Historical dates are valid; future plans are not accepted through the UI.
    if (!p || typeof p.exerciseId !== 'string' || typeof p.exerciseName !== 'string') throw Error('待做清單格式不正確');
    requirePastDate(p.dateKey, '9999-12-31');
    const key = JSON.stringify([p.dateKey, p.exerciseId]);
    if (days.has(key)) throw Error('待做動作重複'); days.add(key);
  }
}
