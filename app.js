// app.js COMPLETO

// --------------------------
// Estado y constantes
// --------------------------

const STORAGE_KEY = 'focus_board_v5';

const DEFAULT_SETTINGS = {
  focusDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
};

const CATEGORY_LABELS = {
  deep_work: 'Deep work',
  admin: 'Administrativo',
  learning: 'Aprender',
  personal: 'Personal',
  quick_win: 'Golpe rápido',
};

let state = {
  tasks: [],
  history: [],
  focusSessions: [],
  streak: {
    current: 0,
    best: 0,
    lastDate: null,
  },
  settings: { ...DEFAULT_SETTINGS },
  survivalMode: {
    enabled: false,
    view: 'all', // all | survival
  },
};

let currentFocus = {
  taskId: null,
  phase: 'idle', // idle | focus | short_break | long_break
  startTime: null,
  remainingSeconds: 0,
  cycleCount: 0,
  timerId: null,
};

let currentTetrisMinutes = 25;

// --------------------------
// Utilidades
// --------------------------

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state = {
      ...state,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch (e) {
    console.error('Error loading state', e);
  }
}

function generateId() {
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatMinutes(minutes) {
  if (!minutes || minutes < 60) return `${minutes || 0} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function isSameDay(ts1, ts2) {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || 'Sin categoría';
}

// --------------------------
// Referencias DOM
// --------------------------

const elements = {
  // Columnas
  inboxColumn: document.getElementById('inboxColumn'),
  todayColumn: document.getElementById('todayColumn'),
  weekColumn: document.getElementById('weekColumn'),
  doneColumn: document.getElementById('doneColumn'),

  // Formularios
  addTaskForm: document.getElementById('addTaskForm'),
  taskTitleInput: document.getElementById('taskTitle'),
  taskUrlInput: document.getElementById('taskUrl'),
  taskCategorySelect: document.getElementById('taskCategory'),
  taskEstimateInput: document.getElementById('taskEstimate'),
  taskDueDateInput: document.getElementById('taskDueDate'),

  // Focus
  focusOverlay: document.getElementById('focusOverlay'),
  focusTaskTitle: document.getElementById('focusTaskTitle'),
  focusCategoryLabel: document.getElementById('focusCategoryLabel'),
  focusColumnLabel: document.getElementById('focusColumnLabel'),
  focusTimerLabel: document.getElementById('focusTimerLabel'),
  focusPhaseLabel: document.getElementById('focusPhaseLabel'),
  focusPrimaryBtn: document.getElementById('focusPrimaryBtn'),
  focusSecondaryBtn: document.getElementById('focusSecondaryBtn'),
  focusCloseBtn: document.getElementById('focusCloseBtn'),
  focusProgressBar: document.getElementById('focusProgressBar'),

  // Ajustes focus
  focusSettingsForm: document.getElementById('focusSettingsForm'),
  focusDurationInput: document.getElementById('focusDuration'),
  shortBreakInput: document.getElementById('shortBreak'),
  longBreakInput: document.getElementById('longBreak'),
  longBreakIntervalInput: document.getElementById('longBreakInterval'),

  // Racha
  streakCurrentLabel: document.getElementById('streakCurrent'),
  streakBestLabel: document.getElementById('streakBest'),

  // Historial
  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),

  // Tetris del tiempo
  timeTetrisBtn: document.getElementById('timeTetrisBtn'),
  timeTetrisMenu: document.getElementById('timeTetrisMenu'),
  tetrisOverlay: document.getElementById('tetrisOverlay'),
  tetrisTitle: document.getElementById('tetrisTitle'),
  tetrisDescription: document.getElementById('tetrisDescription'),
  tetrisList: document.getElementById('tetrisList'),
  tetrisEmptyMessage: document.getElementById('tetrisEmptyMessage'),
  tetrisStartBtn: document.getElementById('tetrisStartBtn'),
  tetrisCloseBtn: document.getElementById('tetrisCloseBtn'),

  // Modo Supervivencia
  survivalToggle: document.getElementById('survivalToggle'),
  survivalSummary: document.getElementById('survivalSummary'),
  survivalFilters: document.getElementById('survivalFilters'),
  survivalChips: document.getElementById('survivalChips'),
};

// --------------------------
// Render de tareas
// --------------------------

function renderBoard() {
  const columns = {
    inbox: elements.inboxColumn.querySelector('.task-list'),
    today: elements.todayColumn.querySelector('.task-list'),
    week: elements.weekColumn.querySelector('.task-list'),
    done: elements.doneColumn.querySelector('.task-list'),
  };

  Object.values(columns).forEach((col) => (col.innerHTML = ''));

  const now = Date.now();

  state.tasks.forEach((task) => {
    if (state.survivalMode.enabled && state.survivalMode.view === 'survival') {
      // Lógica de filtrado en modo supervivencia: solo urgentes y que aportan
      const isUrgent =
        task.dueDate &&
        new Date(task.dueDate).getTime() - now < 1000 * 60 * 60 * 24 * 2;
      const isValuable = task.category === 'deep_work' || task.category === 'learning';
      if (!isUrgent && !isValuable && task.bucket !== 'done') {
        return;
      }
    }

    const col = columns[task.bucket];
    if (!col) return;

    const li = document.createElement('li');
    li.className = 'task';
    li.draggable = true;
    li.dataset.id = task.id;

    const metaBits = [];
    if (task.category) metaBits.push(categoryLabel(task.category));
    if (task.estimate) metaBits.push(formatMinutes(task.estimate));
    if (task.dueDate) {
      const due = new Date(task.dueDate);
      const diff = due.getTime() - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days < 0) {
        metaBits.push('Vencida');
      } else if (days === 0) {
        metaBits.push('Caduca hoy');
      } else if (days === 1) {
        metaBits.push('Caduca mañana');
      } else {
        metaBits.push(`En ${days} días`);
      }
    }

    li.innerHTML = `
      <div class="task-header">
        <span class="task-title">${task.title || 'Sin título'}</span>
        ${
          task.url
            ? `<a href="${task.url}" class="task-link" target="_blank" rel="noopener noreferrer">Abrir</a>`
            : ''
        }
      </div>
      <div class="task-meta">${metaBits.join(' · ') || 'Sin meta'}</div>
      <div class="task-footer">
        <button class="btn btn-xs btn-focus" type="button">Enfocarme</button>
        <button class="btn btn-xs btn-done" type="button">${
          task.bucket === 'done' ? 'Reabrir' : 'Marcar lista'
        }</button>
      </div>
    `;

    col.appendChild(li);
  });

  attachTaskEvents();
  updateSurvivalSummary();
}

function attachTaskEvents() {
  const tasksEls = document.querySelectorAll('.task');

  tasksEls.forEach((el) => {
    const id = el.dataset.id;
    const focusBtn = el.querySelector('.btn-focus');
    const doneBtn = el.querySelector('.btn-done');

    focusBtn.addEventListener('click', () => startFocusFromTask(id));
    doneBtn.addEventListener('click', () => toggleTaskDone(id));

    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
  });

  const columns = document.querySelectorAll('.task-column .task-list');
  columns.forEach((col) => {
    col.addEventListener('dragover', handleDragOver);
    col.addEventListener('drop', handleDrop);
    col.addEventListener('dragleave', handleDragLeave);
  });
}

// --------------------------
// Drag & Drop
// --------------------------

let draggedTaskId = null;

function handleDragStart(e) {
  const el = e.currentTarget;
  draggedTaskId = el.dataset.id;
  el.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedTaskId);
}

function handleDragEnd(e) {
  const el = e.currentTarget;
  el.classList.remove('dragging');
  draggedTaskId = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget;
  col.classList.add('drag-over');
}

function handleDragLeave(e) {
  const col = e.currentTarget;
  if (!col.contains(e.relatedTarget)) {
    col.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drag-over');

  const id = e.dataTransfer.getData('text/plain') || draggedTaskId;
  if (!id) return;

  const columnElement = col.closest('.task-column');
  const bucket = columnElement.dataset.bucket;

  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  task.bucket = bucket;

  if (bucket === 'done' && !task.completedAt) {
    task.completedAt = Date.now();
    addHistoryEntry({
      type: 'completed',
      taskId: task.id,
      title: task.title,
      timestamp: Date.now(),
      bucket,
    });
  } else if (bucket !== 'done') {
    task.completedAt = null;
  }

  saveState();
  renderBoard();
}

// --------------------------
// Historial
// --------------------------

function addHistoryEntry(entry) {
  state.history.unshift({ id: generateId(), ...entry });
  state.history = state.history.slice(0, 200);
  saveState();
  renderHistory();
}

function renderHistory() {
  const list = elements.historyList;
  const empty = elements.historyEmpty;

  if (!state.history.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = '';

  state.history.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'history-item';

    const date = new Date(entry.timestamp);
    const timeLabel = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    let label = '';
    if (entry.type === 'focus_completed') {
      label = `Sesión completada: ${entry.title || 'Tarea sin título'}`;
    } else if (entry.type === 'completed') {
      label = `Tarea completada: ${entry.title || 'Tarea sin título'}`;
    } else if (entry.type === 'focus_cancelled') {
      label = `Sesión cancelada: ${entry.title || 'Tarea sin título'}`;
    }

    li.innerHTML = `
      <div class="history-main">${label}</div>
      <div class="history-meta">${timeLabel}</div>
    `;

    list.appendChild(li);
  });
}

// --------------------------
// Racha
// --------------------------

function updateStreakOnCompleted() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.streak.lastDate === today) return;

  if (!state.streak.lastDate) {
    state.streak.current = 1;
  } else {
    const last = new Date(state.streak.lastDate);
    const diffDays = Math.round(
      (new Date(today) - last) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 1) {
      state.streak.current += 1;
    } else if (diffDays > 1) {
      state.streak.current = 1;
    }
  }

  state.streak.lastDate = today;
  if (state.streak.current > state.streak.best) {
    state.streak.best = state.streak.current;
  }

  saveState();
  renderStreak();
}

function renderStreak() {
  elements.streakCurrentLabel.textContent = state.streak.current;
  elements.streakBestLabel.textContent = state.streak.best;
}

// --------------------------
// Focus / Pomodoro
// --------------------------

function startFocusFromTask(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;

  const duration = state.settings.focusDuration * 60;

  currentFocus = {
    taskId: task.id,
    phase: 'focus',
    startTime: Date.now(),
    remainingSeconds: duration,
    cycleCount: currentFocus.cycleCount || 0,
    timerId: null,
  };

  openFocusOverlay(task);
  startFocusTimer();
}

function openFocusOverlay(task) {
  elements.focusTaskTitle.textContent = task.title || 'Tarea sin título';
  elements.focusCategoryLabel.textContent = categoryLabel(task.category);
  elements.focusColumnLabel.textContent =
    task.bucket === 'today'
      ? 'Columna Hoy'
      : task.bucket === 'week'
      ? 'Esta semana'
      : task.bucket === 'inbox'
      ? 'Bandeja'
      : 'Hechas';

  updateFocusUI();
  elements.focusOverlay.classList.add('open');
}

function closeFocusOverlay() {
  elements.focusOverlay.classList.remove('open');
  stopFocusTimer();
  currentFocus = {
    taskId: null,
    phase: 'idle',
    startTime: null,
    remainingSeconds: 0,
    cycleCount: 0,
    timerId: null,
  };
}

function startFocusTimer() {
  stopFocusTimer();

  const totalSeconds = getPhaseTotalSeconds();
  if (!totalSeconds) return;

  if (!currentFocus.startTime) {
    currentFocus.startTime = Date.now();
  }

  currentFocus.timerId = setInterval(() => {
    const elapsed = Math.floor(
      (Date.now() - currentFocus.startTime) / 1000,
    );
    currentFocus.remainingSeconds = Math.max(
      totalSeconds - elapsed,
      0,
    );

    updateFocusTimerLabel(totalSeconds);

    if (currentFocus.remainingSeconds <= 0) {
      handlePhaseComplete();
    }
  }, 1000);

  updateFocusTimerLabel(totalSeconds);
}

function stopFocusTimer() {
  if (currentFocus.timerId) {
    clearInterval(currentFocus.timerId);
    currentFocus.timerId = null;
  }
}

function getPhaseTotalSeconds() {
  if (currentFocus.phase === 'focus') {
    return state.settings.focusDuration * 60;
  }
  if (currentFocus.phase === 'short_break') {
    return state.settings.shortBreak * 60;
  }
  if (currentFocus.phase === 'long_break') {
    return state.settings.longBreak * 60;
  }
  return 0;
}

function updateFocusTimerLabel(totalSeconds) {
  const remaining = currentFocus.remainingSeconds;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  elements.focusTimerLabel.textContent = `${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const progress =
    totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  elements.focusProgressBar.style.width = `${progress}%`;
}

function handlePhaseComplete() {
  stopFocusTimer();

  if (!currentFocus.taskId) return;
  const task = state.tasks.find((t) => t.id === currentFocus.taskId);
  if (!task) return;

  if (currentFocus.phase === 'focus') {
    // Marcar tarea como hecha al terminar un bloque de foco
    task.bucket = 'done';
    task.completedAt = Date.now();

    addHistoryEntry({
      type: 'focus_completed',
      taskId: task.id,
      title: task.title,
      timestamp: Date.now(),
    });

    updateStreakOnCompleted();
    saveState();
    renderBoard();

    // Decidir descanso
    currentFocus.cycleCount += 1;
    const needsLongBreak =
      currentFocus.cycleCount % state.settings.longBreakInterval === 0;

    currentFocus.phase = needsLongBreak ? 'long_break' : 'short_break';
    currentFocus.startTime = null;
    currentFocus.remainingSeconds = getPhaseTotalSeconds();

    updateFocusUI();
  } else {
    // Fin de descanso -> próximo foco
    currentFocus.phase = 'focus';
    currentFocus.startTime = null;
    currentFocus.remainingSeconds = getPhaseTotalSeconds();
    updateFocusUI();
  }

  startFocusTimer();
}

function updateFocusUI() {
  if (currentFocus.phase === 'focus') {
    elements.focusPhaseLabel.textContent = 'Bloque de foco';
    elements.focusPrimaryBtn.textContent = 'Pausar';
    elements.focusSecondaryBtn.textContent = 'Cancelar sesión';
  } else if (currentFocus.phase === 'short_break') {
    elements.focusPhaseLabel.textContent = 'Descanso corto';
    elements.focusPrimaryBtn.textContent = 'Pausar';
    elements.focusSecondaryBtn.textContent = 'Saltar descanso';
  } else if (currentFocus.phase === 'long_break') {
    elements.focusPhaseLabel.textContent = 'Descanso largo';
    elements.focusPrimaryBtn.textContent = 'Pausar';
    elements.focusSecondaryBtn.textContent = 'Saltar descanso';
  } else {
    elements.focusPhaseLabel.textContent = 'Sin sesión activa';
    elements.focusPrimaryBtn.textContent = 'Iniciar';
    elements.focusSecondaryBtn.textContent = 'Cerrar';
  }

  const total = getPhaseTotalSeconds();
  if (!currentFocus.remainingSeconds && total) {
    currentFocus.remainingSeconds = total;
  }
  updateFocusTimerLabel(total || 0);
}

// --------------------------
// Tetris del tiempo
// --------------------------

function openTimeTetris(minutes) {
  currentTetrisMinutes = minutes;

  elements.tetrisTitle.textContent = `Tengo ${minutes} min`;
  elements.tetrisDescription.textContent =
    minutes === 15
      ? 'Te preparo una mini playlist para un sprint de 15 minutos.'
      : minutes === 25
      ? 'Te propongo una playlist para un pomodoro clásico de 25 minutos.'
      : 'Te armo una playlist para un bloque de 45 minutos sin distracciones.';

  const candidates = state.tasks.filter(
    (t) =>
      t.bucket === 'today' ||
      t.bucket === 'week' ||
      t.bucket === 'inbox',
  );

  // Estrategia simple: tareas cuya estimate <= minutos
  const fitting = candidates
    .filter((t) => t.estimate && t.estimate <= minutes)
    .sort((a, b) => {
      // Priorizar urgente y deep work
      const score = (task) => {
        let s = 0;
        if (task.category === 'deep_work') s += 3;
        if (task.category === 'learning') s += 2;
        if (task.dueDate) {
          const diff =
            new Date(task.dueDate).getTime() - Date.now();
          const days = diff / (1000 * 60 * 60 * 24);
          if (days <= 0) s += 3;
          else if (days <= 1) s += 2;
          else if (days <= 2) s += 1;
        }
        return -s;
      };
      return score(a) - score(b);
    });

  elements.tetrisList.innerHTML = '';

  if (!fitting.length) {
    elements.tetrisEmptyMessage.hidden = false;
  } else {
    elements.tetrisEmptyMessage.hidden = true;
    fitting.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'tetris-task';
      li.dataset.id = task.id;
      li.innerHTML = `
        <div class="tetris-task-title">${task.title || task.url}</div>
        <div class="tetris-task-meta">
          ${categoryLabel(task.category)} · ${task.estimate || '?'} min · ${
        task.bucket === 'today'
          ? 'Columna Hoy'
          : task.bucket === 'week'
          ? 'Esta semana'
          : 'Bandeja'
      }
        </div>
      `;
      elements.tetrisList.appendChild(li);
    });
  }

  elements.tetrisOverlay.classList.add('open');
}

function closeTimeTetris() {
  elements.tetrisOverlay.classList.remove('open');
}

// --------------------------
// Modo Supervivencia
// --------------------------

function toggleSurvivalMode(enabled) {
  state.survivalMode.enabled = enabled;
  state.survivalMode.view = enabled ? 'survival' : 'all';
  saveState();
  renderBoard();
  updateSurvivalSummary();
  updateSurvivalUI();
}

function updateSurvivalUI() {
  if (state.survivalMode.enabled) {
    elements.survivalToggle.classList.add('active');
    elements.survivalFilters.hidden = false;
  } else {
    elements.survivalToggle.classList.remove('active');
    elements.survivalFilters.hidden = true;
  }
}

function updateSurvivalSummary() {
  const now = Date.now();
  const tasksToday = state.tasks.filter(
    (t) =>
      t.bucket !== 'done' &&
      t.dueDate &&
      isSameDay(new Date(t.dueDate), now),
  );
  const tasksThisWeek = state.tasks.filter((t) => {
    if (!t.dueDate || t.bucket === 'done') return false;
    const due = new Date(t.dueDate);
    const day = due.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(due);
    monday.setDate(due.getDate() - diffToMonday);
    const today = new Date(now);
    const todayDay = today.getDay();
    const todayDiffToMonday = (todayDay + 6) % 7;
    const todayMonday = new Date(today);
    todayMonday.setDate(today.getDate() - todayDiffToMonday);
    return isSameDay(monday, todayMonday);
  });

  const critical = tasksToday.filter(
    (t) =>
      t.category === 'deep_work' ||
      t.category === 'learning' ||
      t.category === 'quick_win',
  );

  elements.survivalSummary.textContent = `
Tienes ${tasksToday.length} tareas que caducan hoy y ${
    tasksThisWeek.length
  } esta semana. De ellas, ${
    critical.length
  } parecen realmente importantes para tu yo de dentro de 3 meses.
`.trim();
}

// --------------------------
// Formularios y settings
// --------------------------

function handleAddTask(e) {
  e.preventDefault();
  const title = elements.taskTitleInput.value.trim();
  const url = elements.taskUrlInput.value.trim();
  const category = elements.taskCategorySelect.value || null;
  const estimate = parseInt(elements.taskEstimateInput.value, 10) || null;
  const dueDate = elements.taskDueDateInput.value || null;

  if (!title && !url) return;

  const task = {
    id: generateId(),
    title,
    url: url || null,
    category,
    estimate,
    dueDate,
    bucket: 'inbox',
    createdAt: Date.now(),
    completedAt: null,
  };

  state.tasks.push(task);
  saveState();
  renderBoard();

  elements.addTaskForm.reset();
}

function handleFocusSettingsSubmit(e) {
  e.preventDefault();
  const focusDuration = parseInt(elements.focusDurationInput.value, 10);
  const shortBreak = parseInt(elements.shortBreakInput.value, 10);
  const longBreak = parseInt(elements.longBreakInput.value, 10);
  const longBreakInterval = parseInt(
    elements.longBreakIntervalInput.value,
    10,
  );

  if (focusDuration > 0) state.settings.focusDuration = focusDuration;
  if (shortBreak > 0) state.settings.shortBreak = shortBreak;
  if (longBreak > 0) state.settings.longBreak = longBreak;
  if (longBreakInterval > 0)
    state.settings.longBreakInterval = longBreakInterval;

  saveState();
  updateFocusUI();
}

// --------------------------
// Tareas done / reopen
// --------------------------

function toggleTaskDone(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;

  if (task.bucket === 'done') {
    task.bucket = 'today';
    task.completedAt = null;
  } else {
    task.bucket = 'done';
    task.completedAt = Date.now();
    addHistoryEntry({
      type: 'completed',
      taskId: task.id,
      title: task.title,
      timestamp: Date.now(),
    });
    updateStreakOnCompleted();
  }

  saveState();
  renderBoard();
}

// --------------------------
// Init
// --------------------------

function init() {
  loadState();

  // Valores iniciales ajustes foco
  elements.focusDurationInput.value = state.settings.focusDuration;
  elements.shortBreakInput.value = state.settings.shortBreak;
  elements.longBreakInput.value = state.settings.longBreak;
  elements.longBreakIntervalInput.value =
    state.settings.longBreakInterval;

  renderBoard();
  renderHistory();
  renderStreak();
  updateSurvivalUI();

  // Eventos formulario
  elements.addTaskForm.addEventListener('submit', handleAddTask);
  elements.focusSettingsForm.addEventListener(
    'submit',
    handleFocusSettingsSubmit,
  );

  // Botones overlay focus
  elements.focusPrimaryBtn.addEventListener('click', () => {
    if (!currentFocus.taskId || currentFocus.phase === 'idle') return;

    if (currentFocus.timerId) {
      // Pausar
      stopFocusTimer();
      elements.focusPrimaryBtn.textContent = 'Reanudar';
    } else {
      // Reanudar
      startFocusTimer();
      elements.focusPrimaryBtn.textContent = 'Pausar';
    }
  });

  elements.focusSecondaryBtn.addEventListener('click', () => {
    if (!currentFocus.taskId || currentFocus.phase === 'idle') {
      closeFocusOverlay();
      return;
    }

    if (
      currentFocus.phase === 'focus' ||
      currentFocus.phase === 'short_break' ||
      currentFocus.phase === 'long_break'
    ) {
      addHistoryEntry({
        type: 'focus_cancelled',
        taskId: currentFocus.taskId,
        title:
          state.tasks.find((t) => t.id === currentFocus.taskId)?.title ||
          '',
        timestamp: Date.now(),
      });
    }
    closeFocusOverlay();
  });

  elements.focusCloseBtn.addEventListener('click', () => {
    closeFocusOverlay();
  });

  // Tetris del tiempo: menú desplegable 15/25/45
  elements.timeTetrisBtn.addEventListener('click', () => {
    elements.timeTetrisMenu.classList.toggle('open');
    elements.timeTetrisMenu.setAttribute(
      'aria-hidden',
      !elements.timeTetrisMenu.classList.contains('open'),
    );
  });

  elements.timeTetrisMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-minutes]');
    if (!btn) return;
    const minutes = parseInt(btn.dataset.minutes, 10);
    currentTetrisMinutes = minutes;
    elements.timeTetrisBtn.textContent = `Tengo ${minutes} min`;
    elements.timeTetrisMenu.classList.remove('open');
    elements.timeTetrisMenu.setAttribute('aria-hidden', 'true');
    openTimeTetris(minutes);
  });

  document.addEventListener('click', (e) => {
    if (
      !elements.timeTetrisMenu.contains(e.target) &&
      e.target !== elements.timeTetrisBtn
    ) {
      elements.timeTetrisMenu.classList.remove('open');
      elements.timeTetrisMenu.setAttribute('aria-hidden', 'true');
    }
  });

  elements.tetrisCloseBtn.addEventListener('click', () => {
    closeTimeTetris();
  });

  elements.tetrisStartBtn.addEventListener('click', () => {
    // Empieza sesión de foco con la primera tarea de la playlist
    const first = elements.tetrisList.querySelector('.tetris-task');
    if (!first) {
      closeTimeTetris();
      return;
    }
    const id = first.dataset.id;
    closeTimeTetris();
    startFocusFromTask(id);
  });

  // Modo Supervivencia
  elements.survivalToggle.addEventListener('click', () => {
    toggleSurvivalMode(!state.survivalMode.enabled);
  });

  elements.survivalChips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-view]');
    if (!chip) return;
    const view = chip.dataset.view;
    state.survivalMode.view = view;
    saveState();

    const chips = elements.survivalChips.querySelectorAll('[data-view]');
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    renderBoard();
  });
}

document.addEventListener('DOMContentLoaded', init);
