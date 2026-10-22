import { EXERCISE_CATEGORIES, DEFAULT_EXERCISE_CATEGORY } from './preset-exercises.js';
import './theme.js';
import { startFeedback } from './feedback.js';
import { startAppShell } from './app-shell.js';
import { exerciseOrder, exerciseLabel } from './training.js';
import { startTraining } from './training-ui.js';
import { renderExerciseGroups } from './exercise-groups.js';
import { displayWeight, inputNumber, recordedUnit, completeInUnit, correctInUnit } from './weight-units.js';
import { isCardio, cardioUnits, unitLabel, allRecords, cardioText, cardioComparison, completeCardio, correctCardio } from './cardio.js';
import { dateKey, parseDate, requirePastDate, comparison, validName, fourWeeks } from './records.js';
import { createStore, STORAGE_KEY, StorageFailure } from './storage.js';
import { createRestTimer, remaining, restConfig, timerLabel } from './rest-timer.js';
import { startUpdateManager, UPDATE_SNAPSHOT_KEY } from './update-manager.js';

const $ = (id) => document.getElementById(id);
const shell = startAppShell();
const pageScroll = { record: 0, tasks: 0 };
const store = createStore({ getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) });
let data = { exercises: [], entries: [], completedEntries: [] };
const view = { page: 'record', date: dateKey(), exerciseId: '', weightDirty: false, editId: null, deleteId: null, taskEditId: null };
let toastId, timer, frozen = false, storageFailed = false;
let training;
const shortDate = (key) => key.replaceAll('-', '/');
let weightPrefill = null;
const entryUnit = () => $('entry-unit').value;
const currentCardio = () => isCardio(data.exercises.find(e => e.id === view.exerciseId));
function renderEntryUnits() {
  const cardio = currentCardio(), units = cardio ? cardioUnits : ['kg', 'lb'], previous = entryUnit();
  if ([...$('entry-unit').options].map(o => o.value).join() !== units.join()) {
    $('entry-unit').replaceChildren(...units.map(value => { const option = node('option', cardio ? unitLabel(value) : value); option.value = value; return option; }));
    if (units.includes(previous)) $('entry-unit').value = previous;
  }
  const label = cardio ? (entryUnit() === 'minutes' ? '本次時間' : '本次次數') : '本次重量';
  document.querySelector('label[for="entry-weight"]').textContent = label;
  $('entry-weight').placeholder = cardio ? '請輸入' : '徒手填 0';
  $('entry-weight').setAttribute('aria-label', cardio ? label : '本次實際完成最高重量');
  $('entry-unit').setAttribute('aria-label', cardio ? '本次有氧單位' : '本次重量單位');
  $('entry-weight').step = entryUnit() === 'reps' ? '1' : 'any';
  $('entry-weight').inputMode = entryUnit() === 'reps' ? 'numeric' : 'decimal';
  $('highest-label').textContent = cardio ? (entryUnit() === 'minutes' ? '歷史最長' : '歷史最多') : '歷史最高';
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function button(text, action, className) {
  const result = node('button', text, className); result.type = 'button'; result.addEventListener('click', action); return result;
}
function showError(error, field = 'app') {
  const element = field === 'entry' ? $('entry-error') : field === 'task' ? $('task-error') : $('error-text');
  element.textContent = error.message || String(error); element.hidden = false;
  if (field === 'app') $('app-error').hidden = false;
}
function notify(text, duration = 1000) {
  clearTimeout(toastId);
  $('completion-toast').textContent = text; $('completion-toast').hidden = false;
  toastId = setTimeout(() => { $('completion-toast').hidden = true; }, duration);
}
function hideToast() { clearTimeout(toastId); $('completion-toast').hidden = true; }
function updateVisibleArea() {
  const viewport = window.visualViewport;
  const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
  document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
}
window.visualViewport?.addEventListener('resize', updateVisibleArea);
window.visualViewport?.addEventListener('scroll', updateVisibleArea);
updateVisibleArea();
function transact(action, field = 'app') {
  if (frozen) return false;
  try {
    data = store.transaction(action); storageFailed = false; $('app-error').hidden = true;
    $('entry-error').hidden = true; $('task-error').hidden = true;
    return true;
  } catch (error) {
    // A failed write never updates data or reports success.
    if (error instanceof StorageFailure) storageFailed = true;
    showError(error, field); return false;
  }
}
function categories(select, all = false) {
  select.replaceChildren();
  if (all) { const option = node('option', '全部分類'); option.value = 'all'; select.append(option); }
  for (const value of EXERCISE_CATEGORIES) { const option = node('option', value); option.value = value; select.append(option); }
  if (!all) select.value = DEFAULT_EXERCISE_CATEGORY;
}
function activeExercises() {
  return data.exercises.filter((e) => !e.archived)
    .sort(exerciseOrder);
}
function renderPicker(openCurrent = false) {
  const query = $('exercise-search').value.trim().toLowerCase();
  const exercises = activeExercises().filter(e => e.name.toLowerCase().includes(query) || (e.category || DEFAULT_EXERCISE_CATEGORY).includes(query));
  const results = $('exercise-picker-results');
  const row = e => {
    const choice = button(query ? exerciseLabel(e) : e.name, () => chooseExercise(e.id), 'exercise-choice');
    choice.dataset.exerciseId = e.id; choice.setAttribute('aria-pressed', String(e.id === view.exerciseId)); return choice;
  };
  if (query) results.replaceChildren(...exercises.map(row));
  else renderExerciseGroups(results, exercises, { prefix: 'picker-group', renderRow: row,
    openCategory: openCurrent ? data.exercises.find(e => e.id === view.exerciseId)?.category || DEFAULT_EXERCISE_CATEGORY : undefined });
  $('exercise-picker-empty').hidden = Boolean(exercises.length);
}
function chooseExercise(id) {
  if (!data.exercises.some(e => e.id === id && !e.archived)) return;
  view.exerciseId = id; renderOptions(true);
  if ($('exercise-picker').open) $('exercise-picker').close();
}
function renderOptions(reset = false) {
  const exercises = activeExercises();
  if (!exercises.some((e) => e.id === view.exerciseId)) { view.exerciseId = exercises[0]?.id || ''; reset = true; }
  $('exercise-select').replaceChildren();
  for (const e of exercises) { const option = node('option', exerciseLabel(e)); option.value = e.id; $('exercise-select').append(option); }
  if (!exercises.length) { const option = node('option', '沒有符合的動作，請新增或恢復動作'); option.value = ''; $('exercise-select').append(option); }
  $('exercise-select').value = view.exerciseId;
  $('exercise-select').disabled = !exercises.length;
  $('complete-button').disabled = !exercises.length;
  $('selected-exercise').textContent = data.exercises.find(e => e.id === view.exerciseId) ? exerciseLabel(data.exercises.find(e => e.id === view.exerciseId)) : '請先新增或恢復動作';
  $('open-exercise-picker').disabled = !exercises.length;
  if ($('exercise-picker').open) renderPicker();
  renderComparison(reset);
}
function renderComparison(reset = false) {
  renderEntryUnits();
  const cardio = currentCardio();
  const result = cardio ? cardioComparison(data, view.exerciseId, view.date, entryUnit()) : comparison(data.completedEntries, view.exerciseId, view.date);
  const display = value => cardio ? (value === null ? '尚無紀錄' : `${value} ${unitLabel(entryUnit())}`) : displayWeight(value, entryUnit());
  const valueOf = record => record ? (cardio ? record.value : record.weight) : null;
  $('last-weight').textContent = display(valueOf(result.previous));
  $('last-date').textContent = result.previous ? shortDate(result.previous.dateKey) : '';
  $('highest-weight').textContent = display(result.highest);
  $('last-weight').classList.toggle('empty-value', result.previous === null);
  $('highest-weight').classList.toggle('empty-value', result.highest === null);
  $('current-weight').textContent = `當天${cardio ? (entryUnit() === 'minutes' ? '最長' : '最多') : '最高'}：${result.current ? display(valueOf(result.current)) : '—'}`;
  if (reset) {
    $('entry-weight').value = result.previous ? (cardio ? String(result.previous.value) : inputNumber(result.previous.weight, entryUnit())) : '';
    weightPrefill = result.previous && !cardio ? { kg: result.previous.weight, text: $('entry-weight').value, unit: entryUnit() } : null;
    view.weightDirty = false;
  }
}
function renderCalendar() {
  const today = dateKey();
  $('schedule-date-input').max = today; $('schedule-date-input').value = view.date;
  $('date-title').textContent = view.date === today ? '今天' : shortDate(view.date);
  $('calendar-month').textContent = view.date.slice(0, 7).replace('-', ' / ');
  $('calendar-days').replaceChildren();
  const completed = new Set(allRecords(data).map((r) => r.dateKey)), legacy = new Set(data.entries.map((r) => r?.dateKey));
  for (const key of fourWeeks(view.date)) {
    const hasNew = completed.has(key), hasOld = legacy.has(key);
    const cell = button(String(Number(key.slice(-2))), () => selectDate(key));
    cell.dataset.date = key;
    cell.className = hasNew ? 'calendar__day--workout' : hasOld ? 'calendar__day--legacy' : '';
    cell.disabled = key > today; cell.setAttribute('aria-pressed', String(key === view.date));
    cell.setAttribute('aria-label', `${shortDate(key)}${hasNew ? '，已完成' : hasOld ? '，舊版紀錄' : '，無紀錄'}`);
    $('calendar-days').append(cell);
  }
}
function selectDate(key) {
  hideToast();
  try { requirePastDate(key); } catch (error) { showError(error, 'entry'); $('schedule-date-input').value = view.date; return; }
  view.date = key; view.editId = null; view.deleteId = null; $('entry-error').hidden = true;
  $('daily-set-status').textContent = '';
  renderCalendar(); renderRecords(); renderComparison(true); training?.renderPending();
}
function renderRecords() {
  const list = $('completed-list'); list.replaceChildren();
  const records = allRecords(data).filter((r) => r.dateKey === view.date);
  if (!records.length) list.append(node('p', '尚無紀錄', 'muted'));
  for (const r of records) {
    const row = node('article', undefined, 'record-item'); row.dataset.id = r.id;
    const cardio = cardioUnits.includes(r.unit);
    const heading = node('div', undefined, 'row'); heading.append(node('span', r.exerciseName + (!cardio && r.exerciseCategory === '有氧' ? ' · 舊重量紀錄' : '')), node('span', cardio ? cardioText(r) : displayWeight(r.weight, recordedUnit(r))));
    const actions = node('div', undefined, 'links');
    actions.append(button('更正', () => { view.editId = r.id; view.deleteId = null; renderRecords(); }), button('刪除', () => { view.deleteId = r.id; view.editId = null; renderRecords(); }));
    row.append(heading, actions);
    if (view.editId === r.id) {
      const form = node('form', undefined, 'edit-box'); form.noValidate = true;
      const label = node('label', cardio ? '更正紀錄' : '更正重量'); label.htmlFor = 'correct-weight';
      const originalUnit = cardio ? r.unit : recordedUnit(r), originalText = cardio ? String(r.value) : inputNumber(r.weight, originalUnit);
      const input = node('input'); input.id = 'correct-weight'; input.type = 'number'; input.min = '0'; input.step = 'any'; input.inputMode = 'decimal'; input.value = originalText;
      const unit = node('select'); unit.id = 'correct-unit'; unit.setAttribute('aria-label', '更正重量單位');
      for (const name of cardio ? [r.unit] : ['kg', 'lb']) { const option = node('option', cardio ? unitLabel(name) : name); option.value = name; unit.append(option); } unit.value = originalUnit;
      if (cardio) { unit.disabled = true; unit.setAttribute('aria-label', '此筆有氧單位'); input.step = r.unit === 'reps' ? '1' : 'any'; }
      let untouched = true; input.oninput = unit.onchange = () => { untouched = false; };
      const error = node('p', '', 'error'); error.setAttribute('role', 'alert');
      const save = node('button', '儲存'); save.type = 'submit';
      form.append(label, input, unit, save, button('取消', () => { view.editId = null; renderRecords(); }), error);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (transact((latest) => cardio ? correctCardio(latest, r.id, input.value) : correctInUnit(latest, r.id, input.value, unit.value, dateKey(), untouched && input.value === originalText && unit.value === originalUnit ? r.weight : undefined), 'entry')) { view.editId = null; refresh(); notify('已更正'); }
        else error.textContent = $('entry-error').textContent;
      });
      row.append(form);
    }
    if (view.deleteId === r.id) {
      const confirmation = node('div', undefined, 'confirm-box'); confirmation.setAttribute('role', 'alert');
      confirmation.append(node('p', '刪除這筆紀錄？'), node('p', '重量對照將重新計算。', 'muted'), button('取消', () => { view.deleteId = null; renderRecords(); }), button('確認刪除', () => {
        if (transact((latest) => { latest.completedEntries = latest.completedEntries.filter((entry) => entry.id !== r.id); if (latest.cardioEntries) latest.cardioEntries = latest.cardioEntries.filter(entry => entry.id !== r.id); })) {
          view.deleteId = null; refresh(); notify('已刪除');
        }
      })); row.append(confirmation);
    }
    list.append(row);
  }
  const old = data.entries.filter((r) => r && r.dateKey === view.date);
  $('legacy-section').hidden = !old.length; $('legacy-list').replaceChildren();
  for (const r of old) {
    const card = node('article', undefined, 'record-item');
    card.append(node('p', `${r.exerciseName || '未命名動作'}　${r.weight ?? '—'} ${r.unit || 'kg'}`), node('p', `${r.reps ?? '—'} 次 × ${r.sets ?? '—'} 組`, 'muted'));
    if (r.note) card.append(node('p', r.note, 'muted'));
    $('legacy-list').append(card);
  }
}
function renderTasks() {
  function taskRow(exercise) {
    const row = node('div', undefined, 'task-item'); row.dataset.id = exercise.id;
    const heading = node('div', undefined, 'row'), links = node('div', undefined, 'links');
    heading.append(node('span', exercise.name));
    if (!exercise.archived) links.append(button('改名', () => { view.taskEditId = exercise.id; renderTasks(); }));
    links.append(button(exercise.archived ? '恢復' : '封存', () => {
      if (transact((latest) => {
        const current = latest.exercises.find((e) => e.id === exercise.id);
        if (!current) throw new Error('動作已變更，請重試');
        current.archived = !current.archived;
      }, 'task')) { view.taskEditId = null; refresh(); notify(exercise.archived ? '已恢復' : '已封存'); }
    }));
    const menu = node('details', undefined, 'exercise-actions'); menu.id = `exercise-actions-${exercise.id}`;
    const summary = node('summary', '⋯'); summary.setAttribute('aria-label', `${exercise.name}的操作`);
    menu.append(summary, links); heading.append(menu); row.append(heading);
    menu.open = view.taskEditId === exercise.id;
    if (view.taskEditId === exercise.id && !exercise.archived) {
      const form = node('form', undefined, 'edit-box'); form.noValidate = true;
      const input = node('input'); input.id = 'task-edit-name'; input.value = exercise.name; input.setAttribute('aria-label', '動作名稱');
      const category = node('select'); category.id = 'task-edit-category'; category.setAttribute('aria-label', '動作分類'); categories(category); category.value = exercise.category || DEFAULT_EXERCISE_CATEGORY;
      const save = node('button', '儲存'); save.type = 'submit';
      form.append(input, category, save, button('取消', () => { view.taskEditId = null; renderTasks(); }));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (transact((latest) => {
          const current = latest.exercises.find((e) => e.id === exercise.id);
          if (!current) throw new Error('動作已變更，請重試');
          current.name = validName(latest, input.value, current.id); current.category = category.value;
        }, 'task')) { view.taskEditId = null; refresh(); notify('已儲存'); }
      }); row.append(form);
    }
    return row;
  }
  const editing = data.exercises.find(e => e.id === view.taskEditId);
  renderExerciseGroups($('task-list'), data.exercises.filter(e => !e.archived), { prefix: 'task-group', renderRow: taskRow, openCategory: editing?.category });
  renderExerciseGroups($('archived-list'), data.exercises.filter(e => e.archived), { prefix: 'archive-group', renderRow: taskRow });
  if (!$('task-list').childElementCount) $('task-list').append(node('p', '請新增或恢復動作', 'muted'));
  if (!$('archived-list').childElementCount) $('archived-list').append(node('p', '尚無封存動作', 'muted'));
}
function setPage(page) {
  const next = page === 'tasks' ? 'tasks' : 'record';
  const changed = next !== view.page;
  if (changed) pageScroll[view.page] = window.scrollY;
  view.page = next;
  for (const name of ['record', 'tasks']) { $(`${name}-page`).hidden = view.page !== name; $(`${name}-tab`).setAttribute('aria-selected', String(view.page === name)); }
  if (changed) window.scrollTo({ top: pageScroll[next], behavior: 'instant' });
}
function refresh() { renderCalendar(); renderOptions(); renderRecords(); renderTasks(); training?.render(); }
function renderTimer(latest, alarmPlaying, highlighted) {
  $('rest-panel').classList.toggle('rest-finished', Boolean(highlighted));
  $('rest-panel').querySelector('summary').textContent = highlighted ? '休息結束' : '休息倒數';
  const config = restConfig(latest);
  $('rest-timer-display').textContent = timerLabel(remaining(latest));
  for (const [id, value] of [['rest-timer-minutes', config.minutes], ['rest-timer-seconds', config.seconds]]) {
    // Do not overwrite a partial numeric input while the user is editing it.
    if (document.activeElement !== $(id)) $(id).value = value;
    $(id).disabled = Boolean(latest.restTimerRunning);
  }
  $('rest-timer-start').disabled = Boolean(latest.restTimerRunning) || !(config.minutes * 60 + config.seconds);
  $('rest-timer-pause').disabled = !latest.restTimerRunning && !alarmPlaying;
}

categories($('task-category')); categories($('exercise-category-filter'), true);
try { data = store.initialize(); } catch (error) { storageFailed = true; showError(error); }
refresh(); renderComparison(true);
timer = createRestTimer({ store, render: renderTimer, message: notify, failure: (error) => { storageFailed = true; showError(error); } });

$('record-tab').onclick = () => setPage('record'); $('tasks-tab').onclick = () => setPage('tasks');
// Keyboard navigation for the two tabs.
document.querySelector('nav').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const page = event.key === 'Home' ? 'record' : event.key === 'End' ? 'tasks' : view.page === 'record' ? 'tasks' : 'record'; setPage(page); $(`${page}-tab`).focus();
});
$('schedule-date-input').onchange = (event) => selectDate(event.target.value);
$('go-today').onclick = () => selectDate(dateKey());
for (const [id, offset] of [['calendar-prev', -7], ['calendar-next', 7]]) $(id).onclick = () => {
  const next = parseDate(view.date); next.setDate(next.getDate() + offset); selectDate(dateKey(next) > dateKey() ? dateKey() : dateKey(next));
};
$('exercise-select').onchange = (event) => chooseExercise(event.target.value);
$('exercise-search').oninput = () => renderPicker();
$('open-exercise-picker').onclick = () => { $('exercise-search').value = ''; renderPicker(true); $('exercise-picker').showModal(); };
$('close-exercise-picker').onclick = () => $('exercise-picker').close();
$('exercise-picker').addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); $('exercise-picker').close(); } });
$('entry-weight').oninput = () => { weightPrefill = null; view.weightDirty = true; $('entry-error').hidden = true; };
$('entry-unit').onchange = () => { weightPrefill = null; view.weightDirty = true; renderComparison(); };
$('complete-form').onsubmit = (event) => {
  event.preventDefault();
  hideToast();
  const exactKg = weightPrefill && weightPrefill.text === $('entry-weight').value && weightPrefill.unit === entryUnit() ? weightPrefill.kg : undefined;
  if (transact((latest) => currentCardio() ? completeCardio(latest, view.exerciseId, view.date, $('entry-weight').value, entryUnit()) : completeInUnit(latest, view.exerciseId, view.date, $('entry-weight').value, entryUnit(), dateKey(), exactKg), 'entry')) {
    view.weightDirty = false; refresh(); notify('已完成');
  }
};
$('task-form').onsubmit = (event) => {
  event.preventDefault();
  if (transact((latest) => latest.exercises.push({ id: crypto.randomUUID(), name: validName(latest, $('task-input').value), category: $('task-category').value, createdAt: new Date().toISOString() }), 'task')) {
    $('task-input').value = ''; refresh(); notify('已新增');
  }
};
$('retry-storage').onclick = () => { try { data = store.initialize(); storageFailed = false; $('app-error').hidden = true; refresh(); timer.update(); } catch (error) { showError(error); } };
$('rest-timer-start').onclick = timer.start; $('rest-timer-pause').onclick = timer.pause;
$('rest-timer-reset').onclick = timer.reset;
for (const id of ['rest-timer-minutes', 'rest-timer-seconds']) $(id).onchange = () => timer.configure($('rest-timer-minutes').value, $('rest-timer-seconds').value);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderCalendar(); timer.update(); } });

const feedback = startFeedback();
training = startTraining({ getData: () => data, getDate: () => view.date, selectDate, transact, refresh,
  choose: id => { chooseExercise(id); $('entry-weight').focus(); $('entry-weight').scrollIntoView({ block: 'center' }); } });
training.render();
function snapshot() {
  pageScroll[view.page] = window.scrollY;
  return {
    page: view.page, selectedDate: view.date, exerciseId: view.exerciseId, weightDirty: view.weightDirty,
    weightPrefill,
    pageScroll: { ...pageScroll }, settingsOpen: shell.isOpen(),
    editId: view.editId, taskEditId: view.taskEditId,
    training: training.snapshot(),
    details: Array.from(document.querySelectorAll('details[id]')).filter((d) => d.open).map((d) => d.id),
    fields: Array.from(document.querySelectorAll('input[id],select[id]')).filter((input) => !input.id.startsWith('feedback-')).map((input) => ({ id: input.id, value: input.value })),
  };
}
try {
  const raw = sessionStorage.getItem(UPDATE_SNAPSHOT_KEY), saved = raw ? JSON.parse(raw) : null;
  if (saved) {
    const fields = new Map((saved.fields || []).map((field) => [field.id, field.value]));
    // Accept the previous four-page updater's snapshot during the first upgrade.
    const storedDate = saved.selectedDate;
    const date = fields.get('schedule-date-input') || (typeof storedDate === 'string' && storedDate.length === 10 ? storedDate : storedDate ? dateKey(new Date(storedDate)) : null);
    if (date) { try { requirePastDate(date); view.date = date; } catch { /* Invalid/future selection: use today. */ } }
    view.page = saved.page || (saved.activePage === 'tasks' ? 'tasks' : 'record');
    view.exerciseId = saved.exerciseId || fields.get('exercise-select') || '';
    view.editId = saved.editId || null; view.taskEditId = saved.taskEditId || saved.taskDrafts?.[0]?.id || null;
    for (const id of ['exercise-search', 'exercise-category-filter', 'entry-unit']) if (fields.has(id)) $(id).value = fields.get(id);
    refresh(); setPage(view.page);
    for (const [id, value] of fields) {
      if (['schedule-date-input', 'exercise-select', 'exercise-category-filter', 'exercise-search', 'rest-timer-minutes', 'rest-timer-seconds'].includes(id)) continue;
      if ($(id)) $(id).value = value;
    }
    renderComparison();
    if (saved.taskDrafts?.[0] && $('task-edit-name')) { $('task-edit-name').value = saved.taskDrafts[0].name; $('task-edit-category').value = saved.taskDrafts[0].category; }
    for (const id of saved.details || []) if ($(id)) $(id).open = true;
    view.weightDirty = Boolean(saved.weightDirty);
    weightPrefill = saved.weightPrefill || null;
    training.restore(saved.training);
    if ($('task-input').value.trim()) $('add-exercise-panel').open = true;
    for (const name of ['record', 'tasks']) if (Number.isFinite(saved.pageScroll?.[name]) && saved.pageScroll[name] >= 0) pageScroll[name] = saved.pageScroll[name];
    if (saved.settingsOpen) shell.open();
    requestAnimationFrame(() => window.scrollTo({ top: pageScroll[view.page], behavior: 'instant' }));
    sessionStorage.removeItem(UPDATE_SNAPSHOT_KEY);
  }
} catch (error) { showError(new Error(`更新畫面無法還原：${error.message}`)); }

// Changes from other tabs are read before every write. Do not destroy local drafts.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || frozen) return;
  try { data = store.read(); renderCalendar(); renderOptions(); if (!view.editId) renderRecords(); if (!view.taskEditId) renderTasks(); training.render(); }
  catch (error) { storageFailed = true; showError(error); }
});
startUpdateManager({
  save: () => {
    if (storageFailed) throw new Error('請先排除儲存錯誤再更新');
    if (!feedback.canPrepare()) throw new Error('請等待回報送出完成，或排除草稿儲存問題');
    feedback.persist();
    const latest = localStorage.getItem(STORAGE_KEY); store.read();
    if (latest !== null) localStorage.setItem(STORAGE_KEY, latest);
  },
  snapshot,
  canPrepare: () => !training.dirty() && feedback.canPrepare() && !storageFailed && !view.weightDirty && !$('task-input').value.trim() && !view.taskEditId && !view.editId && !store.read().restTimerRunning && !timer.playing(),
  freeze: (value) => { frozen = value; $('app-root').inert = value; shell.freeze(value); if (value && $('exercise-picker').open) $('exercise-picker').close(); $('exercise-picker').inert = value; timer.freeze(value); },
});
