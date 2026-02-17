import {
  DEFAULT_EXERCISE_CATEGORY,
  EXERCISE_CATEGORIES,
  PRESET_EXERCISES,
  PRESET_VERSION,
} from './preset-exercises.js';

const STORAGE_KEY = 'workoutCalendar.v1';
const LB_TO_KG = 0.45359237;
const SCHEDULE_TIMER_CYCLE_SECONDS = 60 * 60;
const TOAST_DURATION_MS = 1800;
const REST_TIMER_DEFAULT_MINUTES = 1;
const REST_TIMER_DEFAULT_SECONDS = 30;
const REST_ALARM_DURATION_MS = 60 * 1000;
const REST_ALARM_BURST_INTERVAL_MS = 1200;

const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long' });
const dayFormatter = new Intl.DateTimeFormat('en', { day: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const weekdayFormatter = new Intl.DateTimeFormat('en', { weekday: 'long' });
const PRESET_CATEGORY_MAP = new Map(
  PRESET_EXERCISES.map((preset) => [String(preset.name || '').trim().toLowerCase(), preset.category]),
);

const DOM = {
  month: document.getElementById('calendar-month'),
  year: document.getElementById('calendar-year'),
  days: document.getElementById('calendar-days'),
  goToday: document.getElementById('go-today'),
  selectedDate: document.getElementById('selected-date'),
  selectedWeekday: document.getElementById('selected-weekday'),
  openSchedule: document.getElementById('open-schedule'),
  pages: document.querySelectorAll('.page'),
  navItems: document.querySelectorAll('.bottom-nav__item'),
  taskForm: document.getElementById('task-form'),
  taskInput: document.getElementById('task-input'),
  taskCategory: document.getElementById('task-category'),
  taskList: document.getElementById('task-list'),
  scheduleDate: document.getElementById('schedule-date'),
  scheduleWeekday: document.getElementById('schedule-weekday'),
  scheduleDateInput: document.getElementById('schedule-date-input'),
  scheduleForm: document.getElementById('schedule-form'),
  exerciseCategoryFilter: document.getElementById('exercise-category-filter'),
  exerciseSearch: document.getElementById('exercise-search'),
  exerciseSelect: document.getElementById('exercise-select'),
  scheduleHint: document.getElementById('schedule-hint'),
  scheduleTimerFill: document.getElementById('schedule-timer-fill'),
  scheduleTimerText: document.getElementById('schedule-timer-text'),
  scheduleTimerStart: document.getElementById('schedule-timer-start'),
  scheduleTimerPause: document.getElementById('schedule-timer-pause'),
  restTimerMinutes: document.getElementById('rest-timer-minutes'),
  restTimerSeconds: document.getElementById('rest-timer-seconds'),
  restTimerDisplay: document.getElementById('rest-timer-display'),
  restTimerStart: document.getElementById('rest-timer-start'),
  restTimerPause: document.getElementById('rest-timer-pause'),
  recordSettingsMemo: document.getElementById('record-settings-memo'),
  scheduleToast: document.getElementById('schedule-toast'),
  scheduleList: document.getElementById('schedule-list'),
  progressExercise: document.getElementById('progress-exercise'),
  progressGranularity: document.getElementById('progress-granularity'),
  progressChart: document.getElementById('progress-chart'),
  progressSummary: document.getElementById('progress-summary'),
  calendarButtons: document.querySelectorAll('.calendar__btn[data-action]'),
};

const state = {
  selectedDate: new Date(),
  exercises: [],
  entries: [],
  presetVersionApplied: null,
  recordMemo: '',
  scheduleTimerElapsedSeconds: 0,
  scheduleTimerRunning: true,
  scheduleSessionStartedAt: Date.now(),
  restTimerMinutes: REST_TIMER_DEFAULT_MINUTES,
  restTimerSeconds: REST_TIMER_DEFAULT_SECONDS,
  restTimerRemainingSeconds: REST_TIMER_DEFAULT_MINUTES * 60 + REST_TIMER_DEFAULT_SECONDS,
  restTimerRunning: false,
  restTimerStartedAt: Date.now(),
  activePage: 'home',
};

let scheduleTimerId = null;
let scheduleToastId = null;
let restAlarmAudioContext = null;
let restAlarmIntervalId = null;
let restAlarmStopTimeoutId = null;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.exercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];
    state.exercises = state.exercises.map((exercise) => ({
      ...exercise,
      category: normalizeCategory(exercise.category || inferCategoryByName(exercise.name)),
    }));
    state.entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    state.entries = state.entries.map((entry) => ({
      ...entry,
      note: typeof entry.note === 'string' ? entry.note : '',
    }));
    state.presetVersionApplied = typeof parsed.presetVersionApplied === 'string'
      ? parsed.presetVersionApplied
      : null;
    state.recordMemo = typeof parsed.recordMemo === 'string' ? parsed.recordMemo : '';
    state.scheduleTimerElapsedSeconds = Number.isFinite(Number(parsed.scheduleTimerElapsedSeconds))
      ? Math.max(0, Number(parsed.scheduleTimerElapsedSeconds))
      : 0;
    state.scheduleTimerRunning = typeof parsed.scheduleTimerRunning === 'boolean'
      ? parsed.scheduleTimerRunning
      : true;
    state.scheduleSessionStartedAt = Number.isFinite(Number(parsed.scheduleSessionStartedAt))
      ? Number(parsed.scheduleSessionStartedAt)
      : Date.now();
    state.restTimerMinutes = Number.isFinite(Number(parsed.restTimerMinutes))
      ? Math.max(0, Math.min(99, Number(parsed.restTimerMinutes)))
      : REST_TIMER_DEFAULT_MINUTES;
    state.restTimerSeconds = Number.isFinite(Number(parsed.restTimerSeconds))
      ? Math.max(0, Math.min(59, Number(parsed.restTimerSeconds)))
      : REST_TIMER_DEFAULT_SECONDS;
    const defaultRestSeconds = state.restTimerMinutes * 60 + state.restTimerSeconds;
    state.restTimerRemainingSeconds = Number.isFinite(Number(parsed.restTimerRemainingSeconds))
      ? Math.max(0, Number(parsed.restTimerRemainingSeconds))
      : defaultRestSeconds;
    state.restTimerRunning = typeof parsed.restTimerRunning === 'boolean'
      ? parsed.restTimerRunning
      : false;
    state.restTimerStartedAt = Number.isFinite(Number(parsed.restTimerStartedAt))
      ? Number(parsed.restTimerStartedAt)
      : Date.now();
    if (parsed.selectedDate) {
      const storedDate = new Date(parsed.selectedDate);
      if (!Number.isNaN(storedDate.getTime())) {
        state.selectedDate = storedDate;
      }
    }
  } catch (error) {
    console.warn('Failed to load local data', error);
  }
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      exercises: state.exercises,
      entries: state.entries,
      presetVersionApplied: state.presetVersionApplied,
      recordMemo: state.recordMemo,
      scheduleTimerElapsedSeconds: state.scheduleTimerElapsedSeconds,
      scheduleTimerRunning: state.scheduleTimerRunning,
      scheduleSessionStartedAt: state.scheduleSessionStartedAt,
      restTimerMinutes: state.restTimerMinutes,
      restTimerSeconds: state.restTimerSeconds,
      restTimerRemainingSeconds: state.restTimerRemainingSeconds,
      restTimerRunning: state.restTimerRunning,
      restTimerStartedAt: state.restTimerStartedAt,
      selectedDate: state.selectedDate.toISOString(),
    }),
  );
}

function seedPresetExercises() {
  if (state.presetVersionApplied === PRESET_VERSION) return;
  const existingNames = new Set(
    state.exercises.map((exercise) => exercise.name.trim().toLowerCase()),
  );

  PRESET_EXERCISES.forEach((preset) => {
    const trimmed = String(preset?.name || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (existingNames.has(key)) return;
    existingNames.add(key);
    state.exercises.push({
      id: crypto.randomUUID(),
      name: trimmed,
      category: normalizeCategory(preset?.category),
      createdAt: new Date().toISOString(),
    });
  });

  state.presetVersionApplied = PRESET_VERSION;
  persistState();
}

function normalizeCategory(category) {
  if (EXERCISE_CATEGORIES.includes(category)) return category;
  return DEFAULT_EXERCISE_CATEGORY;
}

function inferCategoryByName(name) {
  const key = String(name || '').trim().toLowerCase();
  return PRESET_CATEGORY_MAP.get(key) || DEFAULT_EXERCISE_CATEGORY;
}

function renderCategorySelect(selectElement, { includeAll = false } = {}) {
  if (!selectElement) return;
  const previousValue = selectElement.value;
  selectElement.innerHTML = '';
  if (includeAll) {
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = '全部分類';
    selectElement.appendChild(allOption);
  }
  EXERCISE_CATEGORIES.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    selectElement.appendChild(option);
  });
  const availableValues = Array.from(selectElement.options).map((option) => option.value);
  if (availableValues.includes(previousValue)) {
    selectElement.value = previousValue;
  } else if (includeAll) {
    selectElement.value = 'all';
  } else {
    selectElement.value = DEFAULT_EXERCISE_CATEGORY;
  }
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const text = String(key || '');
  const [yearText, monthText, dayText] = text.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth()
    && dateA.getDate() === dateB.getDate()
  );
}

function getStartOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function buildFourWeekDates(anchorDate) {
  const thisWeekStart = getStartOfWeek(anchorDate);
  const start = new Date(thisWeekStart);
  start.setDate(start.getDate() - 14);
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const outside = date.getMonth() !== anchorDate.getMonth();
    return { date, outside };
  });
}

function formatTimerLabel(elapsedSeconds) {
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getConfiguredRestSeconds() {
  return (state.restTimerMinutes * 60) + state.restTimerSeconds;
}

function getCurrentRestRemainingSeconds() {
  if (!state.restTimerRunning) {
    return Math.max(0, state.restTimerRemainingSeconds);
  }
  const elapsed = Math.max(0, Math.floor((Date.now() - state.restTimerStartedAt) / 1000));
  return Math.max(0, state.restTimerRemainingSeconds - elapsed);
}

function renderScheduleMemo() {
  if (!DOM.recordSettingsMemo) return;
  DOM.recordSettingsMemo.value = state.recordMemo;
}

function renderRestTimer() {
  if (!DOM.restTimerDisplay) return;
  const remainingSeconds = getCurrentRestRemainingSeconds();
  DOM.restTimerDisplay.textContent = formatTimerLabel(remainingSeconds);

  if (DOM.restTimerMinutes) {
    DOM.restTimerMinutes.value = String(state.restTimerMinutes);
    DOM.restTimerMinutes.disabled = state.restTimerRunning;
  }
  if (DOM.restTimerSeconds) {
    DOM.restTimerSeconds.value = String(state.restTimerSeconds).padStart(2, '0');
    DOM.restTimerSeconds.disabled = state.restTimerRunning;
  }
  if (DOM.restTimerStart) {
    DOM.restTimerStart.disabled = state.restTimerRunning || getConfiguredRestSeconds() <= 0;
  }
  if (DOM.restTimerPause) {
    const isAlarmPlaying = restAlarmIntervalId !== null || restAlarmStopTimeoutId !== null;
    DOM.restTimerPause.disabled = !state.restTimerRunning && !isAlarmPlaying;
  }
}

function renderScheduleTimer() {
  if (!DOM.scheduleTimerFill || !DOM.scheduleTimerText) return;
  const runningSeconds = state.scheduleTimerRunning
    ? Math.floor((Date.now() - state.scheduleSessionStartedAt) / 1000)
    : 0;
  const elapsedSeconds = Math.max(0, Math.floor(state.scheduleTimerElapsedSeconds + runningSeconds));
  const progress = (elapsedSeconds % SCHEDULE_TIMER_CYCLE_SECONDS) / SCHEDULE_TIMER_CYCLE_SECONDS;
  DOM.scheduleTimerFill.style.width = `${Math.max(2, progress * 100)}%`;
  DOM.scheduleTimerText.textContent = `Session timer ${formatTimerLabel(elapsedSeconds)}`;
  if (DOM.scheduleTimerStart) {
    DOM.scheduleTimerStart.disabled = state.scheduleTimerRunning;
  }
  if (DOM.scheduleTimerPause) {
    DOM.scheduleTimerPause.disabled = !state.scheduleTimerRunning;
  }
}

function startScheduleTimer() {
  if (scheduleTimerId !== null) return;
  renderScheduleTimer();
  renderRestTimer();
  scheduleTimerId = window.setInterval(() => {
    renderScheduleTimer();
    const remainingSeconds = getCurrentRestRemainingSeconds();
    if (state.restTimerRunning && remainingSeconds <= 0) {
      state.restTimerRemainingSeconds = 0;
      state.restTimerRunning = false;
      persistState();
      renderRestTimer();
      showScheduleToast('組間休息結束');
      playRestTimerAlarm();
      return;
    }
    renderRestTimer();
  }, 1000);
}

function restartScheduleTimer() {
  state.scheduleTimerElapsedSeconds = 0;
  state.scheduleTimerRunning = true;
  state.scheduleSessionStartedAt = Date.now();
  persistState();
  renderScheduleTimer();
}

async function ensureRestAlarmAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!restAlarmAudioContext) {
    restAlarmAudioContext = new AudioCtor();
  }
  if (restAlarmAudioContext.state === 'suspended') {
    await restAlarmAudioContext.resume();
  }
  return restAlarmAudioContext;
}

async function playRestTimerAlarm() {
  try {
    stopRestTimerAlarm();
    const context = await ensureRestAlarmAudioContext();
    if (!context) return;
    const playBurst = () => {
      const now = context.currentTime;
      const beepOffsets = [0, 0.28, 0.56];
      beepOffsets.forEach((offset) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(context.destination);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
        osc.start(now + offset);
        osc.stop(now + offset + 0.22);
      });
    };

    playBurst();
    restAlarmIntervalId = window.setInterval(() => {
      playBurst();
    }, REST_ALARM_BURST_INTERVAL_MS);
    restAlarmStopTimeoutId = window.setTimeout(() => {
      stopRestTimerAlarm();
    }, REST_ALARM_DURATION_MS);
  } catch (error) {
    console.warn('Failed to play rest timer alarm', error);
  }
}

function stopRestTimerAlarm() {
  if (restAlarmIntervalId !== null) {
    window.clearInterval(restAlarmIntervalId);
    restAlarmIntervalId = null;
  }
  if (restAlarmStopTimeoutId !== null) {
    window.clearTimeout(restAlarmStopTimeoutId);
    restAlarmStopTimeoutId = null;
  }
}

function startRestTimerCountdown() {
  stopRestTimerAlarm();
  if (state.restTimerRunning) return;
  const configuredSeconds = getConfiguredRestSeconds();
  if (configuredSeconds <= 0) return;
  if (state.restTimerRemainingSeconds <= 0) {
    state.restTimerRemainingSeconds = configuredSeconds;
  }
  state.restTimerRunning = true;
  state.restTimerStartedAt = Date.now();
  persistState();
  renderRestTimer();
}

function pauseRestTimerCountdown() {
  stopRestTimerAlarm();
  if (!state.restTimerRunning) return;
  state.restTimerRemainingSeconds = getCurrentRestRemainingSeconds();
  state.restTimerRunning = false;
  persistState();
  renderRestTimer();
}

function syncRestTimerConfigFromInputs() {
  if (!DOM.restTimerMinutes || !DOM.restTimerSeconds) return;
  stopRestTimerAlarm();
  const nextMinutes = Math.max(0, Math.min(99, Number(DOM.restTimerMinutes.value) || 0));
  const nextSeconds = Math.max(0, Math.min(59, Number(DOM.restTimerSeconds.value) || 0));
  state.restTimerMinutes = nextMinutes;
  state.restTimerSeconds = nextSeconds;
  if (!state.restTimerRunning) {
    state.restTimerRemainingSeconds = getConfiguredRestSeconds();
  }
  persistState();
  renderRestTimer();
}

function startScheduleTimerSession() {
  if (state.scheduleTimerRunning) return;
  state.scheduleTimerRunning = true;
  state.scheduleSessionStartedAt = Date.now();
  persistState();
  renderScheduleTimer();
}

function pauseScheduleTimerSession() {
  if (!state.scheduleTimerRunning) return;
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - state.scheduleSessionStartedAt) / 1000));
  state.scheduleTimerElapsedSeconds += deltaSeconds;
  state.scheduleTimerRunning = false;
  persistState();
  renderScheduleTimer();
}

function showScheduleToast(message) {
  if (!DOM.scheduleToast) return;
  if (scheduleToastId !== null) {
    window.clearTimeout(scheduleToastId);
  }
  DOM.scheduleToast.textContent = message;
  DOM.scheduleToast.classList.add('schedule__toast--visible');
  scheduleToastId = window.setTimeout(() => {
    DOM.scheduleToast.classList.remove('schedule__toast--visible');
  }, TOAST_DURATION_MS);
}

function setActivePage(page) {
  if (state.activePage === 'schedule' && page !== 'schedule') {
    stopRestTimerAlarm();
  }
  state.activePage = page;
  DOM.pages.forEach((section) => {
    section.classList.toggle('page--active', section.dataset.page === page);
  });
  DOM.navItems.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.page === page);
  });

  if (page === 'schedule') {
    restartScheduleTimer();
    focusDate(new Date());
    renderSchedule();
  }
  if (page === 'tasks') {
    renderTaskList();
  }
  if (page === 'progress') {
    renderProgress();
  }
}

function setSelectedDate(date) {
  state.selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  persistState();
  renderCalendar();
  renderScheduleHeader();
}

function focusDate(date) {
  setSelectedDate(date);
}

function updateWeightConversion(value, unit, targetEl) {
  if (!targetEl) return;
  if (!value || Number.isNaN(Number(value))) {
    targetEl.textContent = '';
    return;
  }
  if (unit === 'lb') {
    const kg = Number(value) * LB_TO_KG;
    targetEl.textContent = `≈ ${kg.toFixed(1)} kg`;
  } else {
    targetEl.textContent = '';
  }
}

function renderCalendar() {
  const anchorDate = state.selectedDate;
  const monthName = monthFormatter.format(anchorDate);
  DOM.month.textContent = monthName;
  DOM.year.textContent = anchorDate.getFullYear();

  const workoutDays = new Set(state.entries.map((entry) => entry.dateKey));

  DOM.days.innerHTML = '';
  const dates = buildFourWeekDates(anchorDate);
  dates.forEach(({ date, outside }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar__day';
    if (outside) button.classList.add('calendar__day--outside');
    if (isSameDay(date, new Date())) button.classList.add('calendar__day--today');
    if (isSameDay(date, state.selectedDate)) button.classList.add('calendar__day--selected');

    const key = dateKey(date);
    if (workoutDays.has(key)) {
      button.classList.add('calendar__day--workout');
    }

    button.innerHTML = `<span>${dayFormatter.format(date)}</span>`;
    button.addEventListener('click', () => {
      setSelectedDate(date);
    });
    DOM.days.appendChild(button);
  });

  DOM.selectedDate.textContent = fullDateFormatter.format(state.selectedDate);
  DOM.selectedWeekday.textContent = weekdayFormatter.format(state.selectedDate);
}

function renderTaskList() {
  DOM.taskList.innerHTML = '';
  if (state.exercises.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No exercises yet. Add your first movement above.';
    DOM.taskList.appendChild(empty);
    return;
  }

  state.exercises
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((exercise) => {
      const row = document.createElement('div');
      row.className = 'task-item';
      row.innerHTML = `
        <div class="task-item__content">
          <div class="task-item__name">${exercise.name}</div>
          <div class="task-item__meta">${exercise.category} · Added ${new Date(exercise.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="task-item__actions">
          <button class="task-item__edit" type="button" data-id="${exercise.id}">Edit</button>
          <button class="task-item__delete" type="button" data-id="${exercise.id}">Delete</button>
        </div>
      `;

      row.querySelector('.task-item__delete').addEventListener('click', () => {
        state.exercises = state.exercises.filter((item) => item.id !== exercise.id);
        persistState();
        renderTaskList();
        renderScheduleFormOptions();
        renderProgress();
      });

      row.querySelector('.task-item__edit').addEventListener('click', () => {
        const content = row.querySelector('.task-item__content');
        content.innerHTML = `
          <div class="task-item__edit-row">
            <input class="task-item__edit-input" type="text" value="${exercise.name}" />
            <select class="task-item__edit-select">
              ${EXERCISE_CATEGORIES.map((category) => `
                <option value="${category}" ${category === exercise.category ? 'selected' : ''}>${category}</option>
              `).join('')}
            </select>
            <button class="task-item__save" type="button">Save</button>
            <button class="task-item__cancel" type="button">Cancel</button>
          </div>
        `;
        const input = content.querySelector('.task-item__edit-input');
        const categorySelect = content.querySelector('.task-item__edit-select');
        const saveBtn = content.querySelector('.task-item__save');
        const cancelBtn = content.querySelector('.task-item__cancel');

        const restore = () => {
          content.innerHTML = `
            <div class="task-item__name">${exercise.name}</div>
            <div class="task-item__meta">${exercise.category} · Added ${new Date(exercise.createdAt).toLocaleDateString()}</div>
          `;
        };

        saveBtn.addEventListener('click', () => {
          const nextName = input.value.trim();
          if (!applyExerciseRename(exercise.id, nextName)) {
            input.focus();
            return;
          }
          exercise.category = normalizeCategory(categorySelect.value);
          syncEntryExerciseSnapshot(exercise.id);
          persistState();
          renderTaskList();
          renderScheduleFormOptions();
          renderScheduleList();
          renderProgress();
        });

        cancelBtn.addEventListener('click', () => {
          restore();
        });

        input.focus();
      });

      DOM.taskList.appendChild(row);
    });
}

function renderScheduleHeader() {
  DOM.scheduleDate.textContent = fullDateFormatter.format(state.selectedDate);
  DOM.scheduleWeekday.textContent = weekdayFormatter.format(state.selectedDate);
  DOM.scheduleDateInput.value = dateKey(state.selectedDate);
}

function renderScheduleFormOptions() {
  const selectedCategory = DOM.exerciseCategoryFilter?.value || 'all';
  const searchTerm = (DOM.exerciseSearch?.value || '').trim().toLowerCase();
  const previousValue = DOM.exerciseSelect.value;
  DOM.exerciseSelect.innerHTML = '';
  if (state.exercises.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Add exercises in Tasks first';
    DOM.exerciseSelect.appendChild(option);
    DOM.exerciseSelect.disabled = true;
    if (DOM.exerciseSearch) {
      DOM.exerciseSearch.disabled = true;
      DOM.exerciseSearch.value = '';
    }
    if (DOM.exerciseCategoryFilter) {
      DOM.exerciseCategoryFilter.disabled = true;
      DOM.exerciseCategoryFilter.value = 'all';
    }
    DOM.scheduleHint.textContent = 'Create exercises in Tasks to enable entry.';
    return;
  }

  if (DOM.exerciseSearch) {
    DOM.exerciseSearch.disabled = false;
  }
  if (DOM.exerciseCategoryFilter) {
    DOM.exerciseCategoryFilter.disabled = false;
  }

  const filteredExercises = state.exercises
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((exercise) => selectedCategory === 'all' || exercise.category === selectedCategory)
    .filter((exercise) => exercise.name.toLowerCase().includes(searchTerm));

  if (filteredExercises.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No matching exercise';
    DOM.exerciseSelect.appendChild(option);
    DOM.exerciseSelect.disabled = true;
    DOM.scheduleHint.textContent = 'No exercise matches current search.';
    return;
  }

  DOM.exerciseSelect.disabled = false;
  DOM.scheduleHint.textContent = '';
  filteredExercises
    .forEach((exercise) => {
      const option = document.createElement('option');
      option.value = exercise.id;
      option.textContent = `${exercise.name} (${exercise.category})`;
      DOM.exerciseSelect.appendChild(option);
    });

  const hasPrevious = filteredExercises.some((exercise) => exercise.id === previousValue);
  if (hasPrevious) {
    DOM.exerciseSelect.value = previousValue;
  } else {
    DOM.exerciseSelect.value = filteredExercises[0].id;
  }
}

function renderScheduleList() {
  const key = dateKey(state.selectedDate);
  const entries = state.entries.filter((entry) => entry.dateKey === key);
  DOM.scheduleList.innerHTML = '';

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No workout entries yet. Add one above.';
    DOM.scheduleList.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'workout-card';
    card.dataset.id = entry.id;
    const displayName = entry.exerciseName || 'Workout';
    const displayCategory = entry.exerciseCategory || getExerciseCategory(entry.exerciseId);
    const converted = entry.unit === 'lb'
      ? `≈ ${(entry.weight * LB_TO_KG).toFixed(1)} kg`
      : '';

    card.innerHTML = `
      <div class="workout-card__header">
        <h3 class="workout-card__title">${displayName}</h3>
        <div class="workout-card__actions">
          <button class="workout-card__copy" type="button">Copy</button>
          <button class="workout-card__delete" type="button">Delete</button>
        </div>
      </div>
      <p class="workout-card__category">${displayCategory}</p>
      <div class="workout-card__grid">
        <div class="workout-card__field">
          <label>Date</label>
          <input type="date" value="${entry.dateKey}" data-field="dateKey" />
        </div>
        <div class="workout-card__field">
          <label>Weight</label>
          <div class="workout-card__weight">
            <input type="number" min="0" step="0.5" value="${entry.weight}" data-field="weight" />
            <select data-field="unit">
              <option value="kg" ${entry.unit === 'kg' ? 'selected' : ''}>kg</option>
              <option value="lb" ${entry.unit === 'lb' ? 'selected' : ''}>lb</option>
            </select>
          </div>
          <div class="workout-card__convert">${converted}</div>
        </div>
        <div class="workout-card__field">
          <label>Reps</label>
          <input type="number" min="1" step="1" value="${entry.reps}" data-field="reps" />
        </div>
        <div class="workout-card__field">
          <label>Sets</label>
          <input type="number" min="1" step="1" value="${entry.sets}" data-field="sets" />
        </div>
        <div class="workout-card__field workout-card__field--full">
          <label>Note</label>
          <textarea data-field="note" rows="2" placeholder="例如：組間休息 90 秒">${entry.note || ''}</textarea>
        </div>
      </div>
    `;

    card.querySelector('.workout-card__delete').addEventListener('click', () => {
      state.entries = state.entries.filter((item) => item.id !== entry.id);
      persistState();
      renderSchedule();
      renderCalendar();
      renderProgress();
    });

    card.querySelector('.workout-card__copy').addEventListener('click', () => {
      duplicateEntry(entry.id);
    });

    const fields = card.querySelectorAll('[data-field]');
    fields.forEach((field) => {
      const handler = (event) => {
        const target = event.target;
        const keyName = target.dataset.field;
        const current = state.entries.find((item) => item.id === entry.id);
        if (!current) return;
        if (keyName === 'dateKey') {
          if (!parseDateKey(target.value)) return;
          current.dateKey = target.value;
        } else if (keyName === 'note') {
          current.note = target.value;
        } else if (keyName === 'unit') {
          current.unit = target.value;
        } else {
          const value = target.value;
          current[keyName] = value === '' ? 0 : Number(value);
        }
        persistState();
        if (keyName === 'dateKey') {
          renderCalendar();
          renderScheduleList();
          renderProgress();
          return;
        }
        if (keyName === 'weight' || keyName === 'unit') {
          const convertEl = card.querySelector('.workout-card__convert');
          updateWeightConversion(current.weight, current.unit, convertEl);
        }
        if (keyName === 'weight' || keyName === 'reps' || keyName === 'sets') {
          renderProgress();
        }
      };
      field.addEventListener('input', handler);
      field.addEventListener('change', handler);
    });

    DOM.scheduleList.appendChild(card);
  });
}

function renderSchedule() {
  renderScheduleHeader();
  renderScheduleMemo();
  renderScheduleTimer();
  renderRestTimer();
  renderScheduleFormOptions();
  renderScheduleList();
}

function getEntryVolume(entry) {
  return Number(entry.weight || 0) * Number(entry.reps || 0) * Number(entry.sets || 0);
}

function renderProgressExerciseOptions() {
  if (!DOM.progressExercise) return;
  const previousValue = DOM.progressExercise.value;
  DOM.progressExercise.innerHTML = '';
  const sortedExercises = state.exercises.slice().sort((a, b) => a.name.localeCompare(b.name));
  sortedExercises.forEach((exercise) => {
    const option = document.createElement('option');
    option.value = exercise.id;
    option.textContent = `${exercise.name} (${exercise.category})`;
    DOM.progressExercise.appendChild(option);
  });
  if (!sortedExercises.length) return;
  const hasPrevious = sortedExercises.some((exercise) => exercise.id === previousValue);
  DOM.progressExercise.value = hasPrevious ? previousValue : sortedExercises[0].id;
}

function getProgressData(exerciseId, granularity) {
  const entries = state.entries.filter((entry) => entry.exerciseId === exerciseId);
  const aggregate = new Map();
  entries.forEach((entry) => {
    const bucket = granularity === 'month' ? entry.dateKey.slice(0, 7) : entry.dateKey;
    const current = aggregate.get(bucket) || 0;
    aggregate.set(bucket, current + getEntryVolume(entry));
  });

  const keys = Array.from(aggregate.keys()).sort((a, b) => a.localeCompare(b));
  return keys.map((key) => ({ label: key, value: aggregate.get(key) || 0 }));
}

function renderProgressChart(points) {
  if (!DOM.progressChart) return;
  const canvas = DOM.progressChart;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cssWidth = canvas.clientWidth || 900;
  const cssHeight = 320;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  if (!points.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet for selected exercise.', cssWidth / 2, cssHeight / 2);
    return;
  }

  const left = 44;
  const right = 16;
  const top = 20;
  const bottom = 34;
  const chartW = cssWidth - left - right;
  const chartH = cssHeight - top - bottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + chartH);
  ctx.lineTo(left + chartW, top + chartH);
  ctx.stroke();

  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0;
  const pathPoints = points.map((point, index) => {
    const x = left + (points.length > 1 ? stepX * index : chartW / 2);
    const y = top + chartH - (point.value / maxValue) * chartH;
    return { x, y, ...point };
  });

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pathPoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  pathPoints.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px Segoe UI';
  ctx.textAlign = 'center';
  const labelIndexes = points.length <= 6
    ? points.map((_, index) => index)
    : [0, Math.floor(points.length / 2), points.length - 1];
  labelIndexes.forEach((index) => {
    const point = pathPoints[index];
    ctx.fillText(point.label, point.x, top + chartH + 16);
  });

  ctx.textAlign = 'left';
  ctx.fillText('0', 6, top + chartH + 4);
  ctx.fillText(`${Math.round(maxValue)}`, 6, top + 4);
}

function renderProgress() {
  if (!DOM.progressExercise || !DOM.progressGranularity || !DOM.progressSummary) return;
  renderProgressExerciseOptions();
  const exerciseId = DOM.progressExercise.value;
  if (!exerciseId) {
    renderProgressChart([]);
    DOM.progressSummary.textContent = '請先在 Tasks 建立訓練動作。';
    return;
  }

  const granularity = DOM.progressGranularity.value || 'day';
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  const points = getProgressData(exerciseId, granularity);
  renderProgressChart(points);

  const total = points.reduce((sum, point) => sum + point.value, 0);
  DOM.progressSummary.textContent = points.length
    ? `${exercise?.name || 'Exercise'} · ${granularity === 'day' ? '日' : '月'}軸，共 ${points.length} 筆，總容量 ${Math.round(total)}`
    : `${exercise?.name || 'Exercise'} 目前沒有可用紀錄。`;
}

function getExerciseCategory(exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  return exercise?.category || DEFAULT_EXERCISE_CATEGORY;
}

function syncEntryExerciseSnapshot(exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  state.entries.forEach((entry) => {
    if (entry.exerciseId === exerciseId) {
      entry.exerciseName = exercise.name;
      entry.exerciseCategory = exercise.category;
    }
  });
}

function applyExerciseRename(exerciseId, nextName) {
  const trimmed = (nextName || '').trim();
  if (!trimmed) return false;
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return false;
  const exists = state.exercises.some(
    (item) => item.id !== exerciseId && item.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exists) return false;

  exercise.name = trimmed;
  syncEntryExerciseSnapshot(exerciseId);
  return true;
}

function addExercise(name, category) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const exists = state.exercises.some((exercise) => exercise.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    DOM.taskInput.value = '';
    DOM.taskInput.focus();
    return;
  }
  state.exercises.push({
    id: crypto.randomUUID(),
    name: trimmed,
    category: normalizeCategory(category),
    createdAt: new Date().toISOString(),
  });
  persistState();
  DOM.taskInput.value = '';
  renderTaskList();
  renderScheduleFormOptions();
  renderProgress();
}

function addEntry() {
  if (state.exercises.length === 0) return;
  const exerciseId = DOM.exerciseSelect.value;
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;

  state.entries.push({
    id: crypto.randomUUID(),
    dateKey: dateKey(state.selectedDate),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    exerciseCategory: exercise.category,
    weight: 0,
    unit: 'kg',
    reps: 8,
    sets: 3,
    note: '',
    createdAt: new Date().toISOString(),
  });

  persistState();
  renderScheduleList();
  renderCalendar();
  renderProgress();
  showScheduleToast(`已新增${exercise.name}`);
}

function duplicateEntry(entryId) {
  const source = state.entries.find((entry) => entry.id === entryId);
  if (!source) return;
  state.entries.push({
    ...source,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  persistState();
  renderScheduleList();
  renderCalendar();
  renderProgress();
}

function bindEvents() {
  DOM.calendarButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      const next = new Date(state.selectedDate);
      if (action === 'prev') {
        next.setDate(next.getDate() - 7);
      } else if (action === 'next') {
        next.setDate(next.getDate() + 7);
      }
      setSelectedDate(next);
    });
  });

  DOM.goToday.addEventListener('click', () => {
    focusDate(new Date());
  });

  DOM.openSchedule.addEventListener('click', () => {
    setActivePage('schedule');
  });

  DOM.navItems.forEach((button) => {
    button.addEventListener('click', () => {
      setActivePage(button.dataset.page);
    });
  });

  DOM.taskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addExercise(DOM.taskInput.value, DOM.taskCategory?.value);
  });

  DOM.scheduleDateInput.addEventListener('change', (event) => {
    const value = event.target.value;
    if (!value) return;
    const next = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(next.getTime())) {
      focusDate(next);
      renderSchedule();
    }
  });

  DOM.scheduleForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addEntry();
  });

  if (DOM.recordSettingsMemo) {
    DOM.recordSettingsMemo.addEventListener('input', (event) => {
      state.recordMemo = event.target.value;
      persistState();
    });
  }

  if (DOM.scheduleTimerStart) {
    DOM.scheduleTimerStart.addEventListener('click', () => {
      startScheduleTimerSession();
    });
  }

  if (DOM.scheduleTimerPause) {
    DOM.scheduleTimerPause.addEventListener('click', () => {
      pauseScheduleTimerSession();
    });
  }

  if (DOM.restTimerStart) {
    DOM.restTimerStart.addEventListener('click', async () => {
      await ensureRestAlarmAudioContext();
      startRestTimerCountdown();
    });
  }

  if (DOM.restTimerPause) {
    DOM.restTimerPause.addEventListener('click', () => {
      pauseRestTimerCountdown();
    });
  }

  if (DOM.restTimerMinutes) {
    DOM.restTimerMinutes.addEventListener('input', () => {
      syncRestTimerConfigFromInputs();
    });
  }

  if (DOM.restTimerSeconds) {
    DOM.restTimerSeconds.addEventListener('input', () => {
      syncRestTimerConfigFromInputs();
    });
  }

  if (DOM.exerciseSearch) {
    DOM.exerciseSearch.addEventListener('input', () => {
      renderScheduleFormOptions();
    });
  }

  if (DOM.exerciseCategoryFilter) {
    DOM.exerciseCategoryFilter.addEventListener('change', () => {
      renderScheduleFormOptions();
    });
  }

  if (DOM.progressExercise) {
    DOM.progressExercise.addEventListener('change', () => {
      renderProgress();
    });
  }

  if (DOM.progressGranularity) {
    DOM.progressGranularity.addEventListener('change', () => {
      renderProgress();
    });
  }

  window.addEventListener('resize', () => {
    if (state.activePage === 'progress') {
      renderProgress();
    }
  });
}

loadState();
seedPresetExercises();
renderCategorySelect(DOM.taskCategory);
renderCategorySelect(DOM.exerciseCategoryFilter, { includeAll: true });
startScheduleTimer();
renderCalendar();
renderSchedule();
renderTaskList();
renderProgress();
bindEvents();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
