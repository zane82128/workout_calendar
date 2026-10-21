import { EXERCISE_CATEGORIES } from './preset-exercises.js';
import { categoryOf, exerciseOrder } from './training.js';

// Native details keeps keyboard interaction and expands categories independently.
export function renderExerciseGroups(container, exercises, { prefix, renderRow, openCategory, selected = [] } = {}) {
  const opened = new Set([...container.querySelectorAll('details[data-category][open]')].map(d => d.dataset.category));
  container.replaceChildren();
  const categories = [...EXERCISE_CATEGORIES, ...new Set(exercises.map(categoryOf).filter(c => !EXERCISE_CATEGORIES.includes(c)))];
  for (const category of categories) {
    const items = exercises.filter(e => categoryOf(e) === category).sort(exerciseOrder);
    if (!items.length) continue;
    const section = document.createElement('details'); section.className = 'exercise-group'; section.dataset.category = category;
    section.id = `${prefix}-${encodeURIComponent(category)}`;
    section.open = opened.has(category) || category === openCategory;
    const summary = document.createElement('summary');
    const name = document.createElement('span'); name.textContent = category;
    const count = document.createElement('span'); count.className = 'muted group-count';
    const checked = items.filter(e => selected.includes(e.id)).length;
    count.textContent = `${items.length} 個${checked ? ` · 已選 ${checked}` : ''}`;
    summary.append(name, count); section.append(summary);
    const content = document.createElement('div'); content.className = 'exercise-group-content';
    for (const e of items) content.append(renderRow(e));
    section.append(content); container.append(section);
  }
}
