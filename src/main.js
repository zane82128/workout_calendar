import {
  DEFAULT_EXERCISE_CATEGORY,
  EXERCISE_CATEGORIES,
  PRESET_EXERCISES,
  PRESET_VERSION,
} from './preset-exercises.js';

const STORAGE_KEY = 'workoutCalendar.v1';
const LB_TO_KG = 0.45359237;

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
  weightInput: document.getElementById('weight-input'),
  weightUnit: document.getElementById('weight-unit'),
  weightConvert: document.getElementById('weight-convert'),
  repsInput: document.getElementById('reps-input'),
  setsInput: document.getElementById('sets-input'),
  scheduleHint: document.getElementById('schedule-hint'),
  scheduleList: document.getElementById('schedule-list'),
  calendarButtons: document.querySelectorAll('.calendar__btn[data-action]'),
};

const state = {
  viewDate: new Date(),
  selectedDate: new Date(),
  exercises: [],
  entries: [],
  presetVersionApplied: null,
  activePage: 'home',
};

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
    state.presetVersionApplied = typeof parsed.presetVersionApplied === 'string'
      ? parsed.presetVersionApplied
      : null;
    if (parsed.selectedDate) {
      const storedDate = new Date(parsed.selectedDate);
      if (!Number.isNaN(storedDate.getTime())) {
        state.selectedDate = storedDate;
        state.viewDate = new Date(storedDate.getFullYear(), storedDate.getMonth(), 1);
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

function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth()
    && dateA.getDate() === dateB.getDate()
  );
}

function buildCalendarDates(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDayIndex = firstDay.getDay();
  const dates = [];

  for (let i = startDayIndex - 1; i >= 0; i -= 1) {
    const date = new Date(year, month, -i);
    dates.push({ date, outside: true });
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    dates.push({ date: new Date(year, month, day), outside: false });
  }

  const cellsToFill = 42 - dates.length;
  for (let day = 1; day <= cellsToFill; day += 1) {
    dates.push({ date: new Date(year, month + 1, day), outside: true });
  }

  return dates;
}

function setActivePage(page) {
  state.activePage = page;
  DOM.pages.forEach((section) => {
    section.classList.toggle('page--active', section.dataset.page === page);
  });
  DOM.navItems.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.page === page);
  });

  if (page === 'schedule') {
    renderSchedule();
  }
  if (page === 'tasks') {
    renderTaskList();
  }
}

function setSelectedDate(date) {
  state.selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  persistState();
  renderCalendar();
  renderScheduleHeader();
}

function focusDate(date) {
  state.viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
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
  const monthName = monthFormatter.format(state.viewDate);
  DOM.month.textContent = monthName;
  DOM.year.textContent = state.viewDate.getFullYear();

  const counts = state.entries.reduce((acc, entry) => {
    acc[entry.dateKey] = (acc[entry.dateKey] || 0) + 1;
    return acc;
  }, {});

  DOM.days.innerHTML = '';
  const dates = buildCalendarDates(state.viewDate);
  dates.forEach(({ date, outside }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar__day';
    if (outside) button.classList.add('calendar__day--outside');
    if (isSameDay(date, new Date())) button.classList.add('calendar__day--today');
    if (isSameDay(date, state.selectedDate)) button.classList.add('calendar__day--selected');

    const key = dateKey(date);
    if (counts[key]) {
      button.classList.add('calendar__day--workout');
    }

    button.innerHTML = `
      <span>${dayFormatter.format(date)}</span>
      ${counts[key] ? `<span class="calendar__day-count">${counts[key]}x</span>` : ''}
    `;
    button.addEventListener('click', () => {
      if (outside) {
        focusDate(date);
      } else {
        setSelectedDate(date);
      }
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
          <button class="workout-card__edit" type="button">Edit name</button>
          <button class="workout-card__delete" type="button">Delete</button>
        </div>
      </div>
      <p class="workout-card__category">${displayCategory}</p>
      <div class="workout-card__grid">
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
      </div>
    `;

    card.querySelector('.workout-card__delete').addEventListener('click', () => {
      state.entries = state.entries.filter((item) => item.id !== entry.id);
      persistState();
      renderSchedule();
      renderCalendar();
    });

    card.querySelector('.workout-card__edit').addEventListener('click', () => {
      const nextName = window.prompt('Exercise name', displayName);
      if (nextName === null) return;
      const trimmed = nextName.trim();
      if (!trimmed) return;

      const linkedExercise = state.exercises.find((item) => item.id === entry.exerciseId);
      if (linkedExercise) {
        const renamed = applyExerciseRename(linkedExercise.id, trimmed);
        if (!renamed) return;
      } else {
        entry.exerciseName = trimmed;
      }

      persistState();
      renderTaskList();
      renderScheduleFormOptions();
      renderScheduleList();
    });

    const fields = card.querySelectorAll('[data-field]');
    fields.forEach((field) => {
      const handler = (event) => {
        const target = event.target;
        const keyName = target.dataset.field;
        const current = state.entries.find((item) => item.id === entry.id);
        if (!current) return;
        if (keyName === 'unit') {
          current.unit = target.value;
        } else {
          const value = target.value;
          current[keyName] = value === '' ? 0 : Number(value);
        }
        persistState();
        if (keyName === 'weight' || keyName === 'unit') {
          const convertEl = card.querySelector('.workout-card__convert');
          updateWeightConversion(current.weight, current.unit, convertEl);
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
  renderScheduleFormOptions();
  renderScheduleList();
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
}

function addEntry() {
  if (state.exercises.length === 0) return;
  const exerciseId = DOM.exerciseSelect.value;
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  const weight = DOM.weightInput.value === '' ? 0 : Number(DOM.weightInput.value);
  const reps = DOM.repsInput.value === '' ? 0 : Number(DOM.repsInput.value);
  const sets = DOM.setsInput.value === '' ? 0 : Number(DOM.setsInput.value);
  const unit = DOM.weightUnit.value;

  state.entries.push({
    id: crypto.randomUUID(),
    dateKey: dateKey(state.selectedDate),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    exerciseCategory: exercise.category,
    weight,
    unit,
    reps,
    sets,
    createdAt: new Date().toISOString(),
  });

  persistState();
  DOM.weightInput.value = '';
  DOM.repsInput.value = '';
  DOM.setsInput.value = '';
  updateWeightConversion('', unit, DOM.weightConvert);
  renderScheduleList();
  renderCalendar();
}

function bindEvents() {
  DOM.calendarButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      const next = new Date(state.viewDate);
      if (action === 'prev') {
        next.setMonth(next.getMonth() - 1);
      } else if (action === 'next') {
        next.setMonth(next.getMonth() + 1);
      }
      state.viewDate = new Date(next.getFullYear(), next.getMonth(), 1);
      renderCalendar();
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

  DOM.weightInput.addEventListener('input', () => {
    updateWeightConversion(DOM.weightInput.value, DOM.weightUnit.value, DOM.weightConvert);
  });

  DOM.weightUnit.addEventListener('change', () => {
    updateWeightConversion(DOM.weightInput.value, DOM.weightUnit.value, DOM.weightConvert);
  });

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
}

loadState();
seedPresetExercises();
renderCategorySelect(DOM.taskCategory);
renderCategorySelect(DOM.exerciseCategoryFilter, { includeAll: true });
renderCalendar();
renderSchedule();
renderTaskList();
bindEvents();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
