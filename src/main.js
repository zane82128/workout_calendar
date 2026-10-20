import { EXERCISE_CATEGORIES, DEFAULT_EXERCISE_CATEGORY } from './preset-exercises.js';
import { dateKey, parseDate, requirePastDate, comparison, complete, correct, validName, fourWeeks } from './records.js';
import { createStore, STORAGE_KEY, StorageFailure } from './storage.js';
import { createRestTimer, remaining, restConfig, timerLabel } from './rest-timer.js';
import { startUpdateManager, UPDATE_SNAPSHOT_KEY } from './update-manager.js';

const $ = (id) => document.getElementById(id);
const store = createStore({ getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) });
let data = { exercises: [], entries: [], completedEntries: [] };
const view = { page: 'record', date: dateKey(), exerciseId: '', weightDirty: false, editId: null, deleteId: null, taskEditId: null };
let toastId, timer, frozen = false, storageFailed = false;
const kg = (value) => value === null ? '尚無紀錄' : `${value} kg`;
const shortDate = (key) => key.replaceAll('-', '/');

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
    .filter((e) => $('exercise-category-filter').value === 'all' || (e.category || DEFAULT_EXERCISE_CATEGORY) === $('exercise-category-filter').value)
    .filter((e) => e.name.toLowerCase().includes($('exercise-search').value.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function renderOptions(reset = false) {
  const exercises = activeExercises();
  if (!exercises.some((e) => e.id === view.exerciseId)) { view.exerciseId = exercises[0]?.id || ''; reset = true; }
  $('exercise-select').replaceChildren();
  for (const e of exercises) { const option = node('option', `${e.name} · ${e.category || DEFAULT_EXERCISE_CATEGORY}`); option.value = e.id; $('exercise-select').append(option); }
  if (!exercises.length) { const option = node('option', '沒有符合的動作，請新增或恢復動作'); option.value = ''; $('exercise-select').append(option); }
  $('exercise-select').value = view.exerciseId;
  $('exercise-select').disabled = !exercises.length;
  $('complete-button').disabled = !exercises.length;
  renderComparison(reset);
}
function renderComparison(reset = false) {
  const result = comparison(data.completedEntries, view.exerciseId, view.date);
  $('last-weight').textContent = kg(result.previous?.weight ?? null);
  $('last-date').textContent = result.previous ? shortDate(result.previous.dateKey) : '';
  $('highest-weight').textContent = kg(result.highest);
  $('current-weight').textContent = `當天最高：${result.current ? kg(result.current.weight) : '—'}`;
  if (reset) { $('entry-weight').value = result.previous ? result.previous.weight : ''; view.weightDirty = false; }
}
function renderCalendar() {
  const today = dateKey();
  $('schedule-date-input').max = today; $('schedule-date-input').value = view.date;
  $('date-title').textContent = view.date === today ? '今天' : shortDate(view.date);
  $('calendar-month').textContent = view.date.slice(0, 7).replace('-', ' / ');
  $('calendar-days').replaceChildren();
  const completed = new Set(data.completedEntries.map((r) => r.dateKey)), legacy = new Set(data.entries.map((r) => r?.dateKey));
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
  renderCalendar(); renderRecords(); renderComparison(true);
}
function renderRecords() {
  const list = $('completed-list'); list.replaceChildren();
  const records = data.completedEntries.filter((r) => r.dateKey === view.date);
  if (!records.length) list.append(node('p', '尚無紀錄', 'muted'));
  for (const r of records) {
    const row = node('article', undefined, 'record-item'); row.dataset.id = r.id;
    const heading = node('div', undefined, 'row'); heading.append(node('span', r.exerciseName), node('span', kg(r.weight)));
    const actions = node('div', undefined, 'links');
    actions.append(button('更正', () => { view.editId = r.id; view.deleteId = null; renderRecords(); }), button('刪除', () => { view.deleteId = r.id; view.editId = null; renderRecords(); }));
    row.append(heading, actions);
    if (view.editId === r.id) {
      const form = node('form', undefined, 'edit-box'); form.noValidate = true;
      const label = node('label', '更正重量（kg）'); label.htmlFor = 'correct-weight';
      const input = node('input'); input.id = 'correct-weight'; input.type = 'number'; input.min = '0'; input.step = 'any'; input.inputMode = 'decimal'; input.value = r.weight;
      const error = node('p', '', 'error'); error.setAttribute('role', 'alert');
      const save = node('button', '儲存'); save.type = 'submit';
      form.append(label, input, save, button('取消', () => { view.editId = null; renderRecords(); }), error);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (transact((latest) => correct(latest, r.id, input.value), 'entry')) { view.editId = null; refresh(); notify('已更正'); }
        else error.textContent = $('entry-error').textContent;
      });
      row.append(form);
    }
    if (view.deleteId === r.id) {
      const confirmation = node('div', undefined, 'confirm-box'); confirmation.setAttribute('role', 'alert');
      confirmation.append(node('p', '刪除這筆紀錄？'), node('p', '重量對照將重新計算。', 'muted'), button('取消', () => { view.deleteId = null; renderRecords(); }), button('確認刪除', () => {
        if (transact((latest) => { latest.completedEntries = latest.completedEntries.filter((entry) => entry.id !== r.id); })) {
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
  $('task-list').replaceChildren(); $('archived-list').replaceChildren();
  for (const exercise of data.exercises.slice().sort((a, b) => a.name.localeCompare(b.name))) {
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
    heading.append(links); row.append(heading, node('div', exercise.category || DEFAULT_EXERCISE_CATEGORY, 'muted'));
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
    $(exercise.archived ? 'archived-list' : 'task-list').append(row);
  }
  if (!$('task-list').childElementCount) $('task-list').append(node('p', '請新增或恢復動作', 'muted'));
  if (!$('archived-list').childElementCount) $('archived-list').append(node('p', '尚無封存動作', 'muted'));
}
function setPage(page) {
  view.page = page === 'tasks' ? 'tasks' : 'record';
  for (const name of ['record', 'tasks']) { $(`${name}-page`).hidden = view.page !== name; $(`${name}-tab`).setAttribute('aria-selected', String(view.page === name)); }
}
function refresh() { renderCalendar(); renderOptions(); renderRecords(); renderTasks(); }
function renderTimer(latest, alarmPlaying) {
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
$('exercise-select').onchange = (event) => { view.exerciseId = event.target.value; renderComparison(true); };
$('exercise-search').oninput = () => renderOptions(true); $('exercise-category-filter').onchange = () => renderOptions(true);
$('entry-weight').oninput = () => { view.weightDirty = true; $('entry-error').hidden = true; };
$('complete-form').onsubmit = (event) => {
  event.preventDefault();
  hideToast();
  if (transact((latest) => complete(latest, view.exerciseId, view.date, $('entry-weight').value), 'entry')) {
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
for (const id of ['rest-timer-minutes', 'rest-timer-seconds']) $(id).onchange = () => timer.configure($('rest-timer-minutes').value, $('rest-timer-seconds').value);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderCalendar(); timer.update(); } });

function snapshot() {
  return {
    page: view.page, selectedDate: view.date, exerciseId: view.exerciseId, weightDirty: view.weightDirty,
    editId: view.editId, taskEditId: view.taskEditId,
    details: Array.from(document.querySelectorAll('details[id]')).filter((d) => d.open).map((d) => d.id),
    fields: Array.from(document.querySelectorAll('input[id],select[id]')).map((input) => ({ id: input.id, value: input.value })),
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
    for (const id of ['exercise-search', 'exercise-category-filter']) if (fields.has(id)) $(id).value = fields.get(id);
    refresh(); setPage(view.page);
    for (const [id, value] of fields) {
      if (['schedule-date-input', 'exercise-select', 'exercise-category-filter', 'exercise-search', 'rest-timer-minutes', 'rest-timer-seconds'].includes(id)) continue;
      if ($(id)) $(id).value = value;
    }
    if (saved.taskDrafts?.[0] && $('task-edit-name')) { $('task-edit-name').value = saved.taskDrafts[0].name; $('task-edit-category').value = saved.taskDrafts[0].category; }
    for (const id of saved.details || []) if ($(id)) $(id).open = true;
    view.weightDirty = Boolean(saved.weightDirty);
    sessionStorage.removeItem(UPDATE_SNAPSHOT_KEY);
  }
} catch (error) { showError(new Error(`更新畫面無法還原：${error.message}`)); }

// Changes from other tabs are read before every write. Do not destroy local drafts.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || frozen) return;
  try { data = store.read(); renderCalendar(); renderComparison(); if (!view.editId) renderRecords(); if (!view.taskEditId) renderTasks(); }
  catch (error) { storageFailed = true; showError(error); }
});
startUpdateManager({
  save: () => {
    if (storageFailed) throw new Error('請先排除儲存錯誤再更新');
    const latest = localStorage.getItem(STORAGE_KEY); store.read();
    if (latest !== null) localStorage.setItem(STORAGE_KEY, latest);
  },
  snapshot,
  canPrepare: () => !storageFailed && !view.weightDirty && !$('task-input').value.trim() && !view.taskEditId && !view.editId && !store.read().restTimerRunning && !timer.playing(),
  freeze: (value) => { frozen = value; $('app-root').inert = value; timer.freeze(value); },
});
