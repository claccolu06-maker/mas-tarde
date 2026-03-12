const STORAGE_KEY = 'smartTimeHub.cards';

let cards = [];

const elements = {
  form: document.getElementById('cardForm'),
  urlInput: document.getElementById('urlInput'),
  titleInput: document.getElementById('titleInput'),
  categorySelect: document.getElementById('categorySelect'),
  timeInput: document.getElementById('timeInput'),
  cardsGrid: document.getElementById('cardsGrid'),
  cardTemplate: document.getElementById('cardTemplate'),
  pendingCount: document.getElementById('pendingCount'),
  completedCount: document.getElementById('completedCount'),
  totalTime: document.getElementById('totalTime'),
  footerSummary: document.getElementById('footerSummary'),
  cardsSubtitle: document.getElementById('cardsSubtitle'),
  searchInput: document.getElementById('searchInput'),
  clearCompletedBtn: document.getElementById('clearCompletedBtn'),
  themeToggle: document.getElementById('themeToggle'),
  addCardBtn: document.getElementById('addCardBtn'),
  emptyState: document.getElementById('emptyState'),

  // Focus mode
  focusTaskSelect: document.getElementById('focusTaskSelect'),
  focusTaskCard: document.getElementById('focusTaskCard'),
  focusTaskContent: document.getElementById('focusTaskContent'),
  focusTaskTitle: document.getElementById('focusTaskTitle'),
  focusTaskUrl: document.getElementById('focusTaskUrl'),
  focusTaskCategory: document.getElementById('focusTaskCategory'),
  focusTaskTime: document.getElementById('focusTaskTime'),
  focusOpenBtn: document.getElementById('focusOpenBtn'),
  focusTimerDisplay: document.getElementById('focusTimerDisplay'),
  focusStartPauseBtn: document.getElementById('focusStartPauseBtn'),
  focusResetBtn: document.getElementById('focusResetBtn'),
  focusResultPanel: document.getElementById('focusResultPanel'),
  focusMarkDoneBtn: document.getElementById('focusMarkDoneBtn'),
  focusAnotherBtn: document.getElementById('focusAnotherBtn'),
  focusNowLabel: document.getElementById('focusNowLabel'),
  focusNowTitle: document.getElementById('focusNowTitle'),

  // Historial
  historyTableBody: document.getElementById('historyTableBody'),
  historySubtitle: document.getElementById('historySubtitle'),
  historySessionsCount: document.getElementById('historySessionsCount'),
  historyMinutesTotal: document.getElementById('historyMinutesTotal'),
};

const viewElements = {
  inbox: document.getElementById('view-inbox'),
  focus: document.getElementById('view-focus'),
  history: document.getElementById('view-history'),
};

const navButtons = document.querySelectorAll('.nav-item[data-view]');

/* ===== STORAGE ===== */

function loadCards() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    cards = [];
    return;
  }
  try {
    cards = JSON.parse(raw);
  } catch (e) {
    console.error('Error al parsear LocalStorage:', e);
    cards = [];
  }
}

function saveCards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

/* ===== HELPERS GENERALES ===== */

function categoryLabel(cat) {
  switch (cat) {
    case 'video':
      return 'Video';
    case 'article':
      return 'Artículo';
    case 'course':
      return 'Curso';
    case 'project':
      return 'Proyecto';
    default:
      return 'Otro';
  }
}

function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const date = d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const time = d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

/* ===== RENDER TARJETAS ===== */

function createCard({ id, url, title, category, estimatedTime, completed }) {
  const node = elements.cardTemplate.content.firstElementChild.cloneNode(true);

  const titleEl = node.querySelector('.card-title');
  const urlEl = node.querySelector('.card-url');
  const categoryPill = node.querySelector('.pill-category');
  const timePill = node.querySelector('.pill-time');
  const completeBtn = node.querySelector('.card-complete-btn');
  const openBtn = node.querySelector('.card-open-btn');
  const deleteBtn = node.querySelector('.card-delete-btn');
  const focusBtn = node.querySelector('.card-focus-btn');

  titleEl.textContent = title || '(Sin título)';
  urlEl.textContent = url;

  categoryPill.textContent = categoryLabel(category);
  categoryPill.dataset.category = category;

  timePill.textContent = `${estimatedTime} min`;

  if (completed) {
    node.classList.add('completed');
  }

  // Marcar tarjeta activa en Focus
  if (focusSelectedId && focusSelectedId === id) {
    node.classList.add('focus-active');
  }

  completeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleCompleted(id);
  });

  openBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    window.open(url, '_blank', 'noopener');
  });

  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    confirmDelete(id);
  });

  focusBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    startFocusSessionFromCard(id);
  });

  node.addEventListener('click', () => {
    window.open(url, '_blank', 'noopener');
  });

  return node;
}

function render() {
  elements.cardsGrid.innerHTML = '';

  const term = elements.searchInput.value.trim().toLowerCase();
  const filtered = cards.filter((c) => {
    if (!term) return true;
    return (
      (c.title && c.title.toLowerCase().includes(term)) ||
      c.category.toLowerCase().includes(term)
    );
  });

  if (filtered.length === 0 && cards.length === 0 && elements.emptyState) {
    elements.cardsSubtitle.textContent =
      'Tu mente está libre. Guarda algo que quieras hacer cuando tengas tiempo ✨';
  } else if (filtered.length === 0 && cards.length > 0) {
    elements.cardsSubtitle.textContent =
      'No hay resultados para ese filtro. Prueba con otra palabra o categoría.';
  } else {
    elements.cardsSubtitle.textContent = `Tienes ${filtered.length} elemento(s) en tu bolsa de enlaces y tareas.`;
  }

  filtered
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((card) => {
      const cardNode = createCard(card);
      elements.cardsGrid.appendChild(cardNode);
    });

  updateEmptyState(filtered);
  updateSummary();
  updateFocusTaskOptions();
  updateHistoryView();
}

/* Estado vacío */

function updateEmptyState(filteredCards) {
  if (!elements.emptyState) return;

  const hasAnyCard = cards.length > 0;
  const hasFilteredCards = filteredCards.length > 0;

  if (!hasAnyCard) {
    elements.emptyState.style.display = 'block';
    elements.emptyState.setAttribute('aria-hidden', 'false');
  } else if (!hasFilteredCards) {
    elements.emptyState.style.display = 'none';
    elements.emptyState.setAttribute('aria-hidden', 'true');
  } else {
    elements.emptyState.style.display = 'none';
    elements.emptyState.setAttribute('aria-hidden', 'true');
  }
}

function updateSummary() {
  const pending = cards.filter((c) => !c.completed);
  const completed = cards.filter((c) => c.completed);
  const totalTime = pending.reduce(
    (sum, c) => sum + (c.estimatedTime || 0),
    0
  );

  elements.pendingCount.textContent = pending.length;
  elements.completedCount.textContent = completed.length;
  elements.totalTime.textContent = `${totalTime} min`;

  if (cards.length === 0) {
    elements.footerSummary.textContent =
      'Aún no has añadido tareas. Empieza con algo pequeño de 10 minutos.';
  } else if (pending.length === 0) {
    elements.footerSummary.textContent =
      '¡Nice! Has usado bien tu tiempo. Tu bandeja está vacía por ahora. 👌';
  } else {
    elements.footerSummary.textContent = `Tienes ${pending.length} tarea(s) pendiente(s). Elige una corta y empieza.`;
  }
}

/* ===== HISTORIAL ===== */

function isThisWeek(timestamp) {
  if (!timestamp) return false;
  const d = new Date(timestamp);
  const now = new Date();

  const currentDay = now.getDay();
  const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diffToMonday
  );
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  return d >= monday && d < sunday;
}

function updateHistoryView() {
  if (!elements.historyTableBody || !elements.historySubtitle) return;

  const completed = cards
    .filter((c) => c.completed && c.completedAt)
    .sort((a, b) => b.completedAt - a.completedAt);

  elements.historyTableBody.innerHTML = '';

  if (completed.length === 0) {
    elements.historySubtitle.textContent =
      'Aún no has completado ninguna tarea. Cuando marques tareas como hechas aparecerán aquí.';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'history-table-empty';
    cell.textContent = 'Sin tareas completadas todavía.';
    row.appendChild(cell);
    elements.historyTableBody.appendChild(row);
  } else {
    elements.historySubtitle.textContent = `Has completado ${completed.length} tarea(s) en total.`;
    completed.forEach((card) => {
      const tr = document.createElement('tr');

      const tdTitle = document.createElement('td');
      tdTitle.className = 'history-table-title';
      tdTitle.textContent = card.title || card.url || '(Sin título)';

      const tdCategory = document.createElement('td');
      tdCategory.textContent = categoryLabel(card.category);

      const tdDate = document.createElement('td');
      tdDate.textContent = formatDateTime(card.completedAt);

      const tdTime = document.createElement('td');
      tdTime.textContent = `${card.estimatedTime || 0} min`;

      tr.appendChild(tdTitle);
      tr.appendChild(tdCategory);
      tr.appendChild(tdDate);
      tr.appendChild(tdTime);

      elements.historyTableBody.appendChild(tr);
    });
  }

  updateHistorySummary(completed);
}

function updateHistorySummary(completedCards) {
  if (!elements.historySessionsCount || !elements.historyMinutesTotal) return;

  const totalMinutes = completedCards.reduce(
    (sum, c) => sum + (c.estimatedTime || 0),
    0
  );

  const sessionsThisWeek = completedCards.filter((c) =>
    isThisWeek(c.completedAt)
  ).length;

  elements.historySessionsCount.textContent = sessionsThisWeek;
  elements.historyMinutesTotal.textContent = `${totalMinutes} min`;
}

/* ===== CRUD ===== */

function addCardFromForm(event) {
  event.preventDefault();

  const url = elements.urlInput.value.trim();
  const title = elements.titleInput.value.trim();
  const category = elements.categorySelect.value;
  const time = parseInt(elements.timeInput.value, 10);

  if (!url || !category || !time) {
    return;
  }

  const newCard = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    url,
    title,
    category,
    estimatedTime: time,
    createdAt: Date.now(),
    completed: false,
    completedAt: null,
  };

  cards.push(newCard);
  saveCards();
  render();
  elements.form.reset();

  const firstCard = elements.cardsGrid.firstElementChild;
  if (firstCard) {
    firstCard.classList.add('just-added');
    setTimeout(() => {
      firstCard.classList.remove('just-added');
    }, 400);
  }
}

function toggleCompleted(id) {
  const card = cards.find((c) => c.id === id);
  if (!card) return;

  card.completed = !card.completed;
  card.completedAt = card.completed ? Date.now() : null;
  saveCards();
  render();
}

function confirmDelete(id) {
  const ok = confirm('¿Seguro que quieres borrar esta tarjeta?');
  if (!ok) return;
  cards = cards.filter((c) => c.id !== id);
  saveCards();
  render();
}

function clearCompleted() {
  const hasCompleted = cards.some((c) => c.completed);
  if (!hasCompleted) return;
  const ok = confirm('Esto eliminará todas las tareas completadas. ¿Continuar?');
  if (!ok) return;
  cards = cards.filter((c) => !c.completed);
  saveCards();
  render();
}

/* ===== BÚSQUEDA ===== */

function handleSearch() {
  render();
}

/* ===== TEMA ===== */

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.contains('theme-dark');
  if (isDark) {
    root.classList.remove('theme-dark');
    root.classList.add('theme-light');
  } else {
    root.classList.remove('theme-light');
    root.classList.add('theme-dark');
  }
}

function initTheme() {
  const root = document.documentElement;
  if (
    !root.classList.contains('theme-dark') &&
    !root.classList.contains('theme-light')
  ) {
    root.classList.add('theme-dark');
  }
}

/* ===== NAVEGACIÓN ENTRE VISTAS ===== */

function switchView(target) {
  Object.values(viewElements).forEach((section) => {
    section.classList.remove('view-active');
  });
  navButtons.forEach((btn) => btn.classList.remove('nav-item-active'));

  const section = viewElements[target];
  if (section) {
    section.classList.add('view-active');
  }

  navButtons.forEach((btn) => {
    if (btn.dataset.view === target) {
      btn.classList.add('nav-item-active');
    }
  });
}

function initNavigation() {
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      switchView(target);
    });
  });

  switchView('inbox');
}

/* ===== MODO FOCUS (30 MIN) ===== */

const FOCUS_DURATION_SECONDS = 30 * 60;
let focusSelectedId = null;
let focusRemainingSeconds = FOCUS_DURATION_SECONDS;
let focusIntervalId = null;
let focusRunning = false;

function updateFocusTaskOptions() {
  if (!elements.focusTaskSelect) return;

  const pending = cards.filter((c) => !c.completed);
  const currentValue = elements.focusTaskSelect.value;

  elements.focusTaskSelect.innerHTML =
    '<option value="">Selecciona una tarea pendiente…</option>';

  pending.forEach((card) => {
    const option = document.createElement('option');
    option.value = card.id;
    option.textContent = card.title || card.url;
    elements.focusTaskSelect.appendChild(option);
  });

  if (pending.some((c) => c.id === currentValue)) {
    elements.focusTaskSelect.value = currentValue;
  } else {
    focusSelectedId = null;
    clearFocusTaskDetails();
    resetFocusTimer();
  }
}

function updateFocusNowLabel(card) {
  if (!elements.focusNowLabel || !elements.focusNowTitle) return;

  if (!card) {
    elements.focusNowLabel.hidden = true;
    elements.focusNowTitle.textContent = '';
    return;
  }

  elements.focusNowTitle.textContent = card.title || card.url || '(Sin título)';
  elements.focusNowLabel.hidden = false;
}

function handleFocusTaskChange() {
  const id = elements.focusTaskSelect.value;
  focusSelectedId = id || null;
  if (!focusSelectedId) {
    clearFocusTaskDetails();
    resetFocusTimer();
    render();
    return;
  }

  const card = cards.find((c) => c.id === focusSelectedId && !c.completed);
  if (!card) {
    clearFocusTaskDetails();
    resetFocusTimer();
    render();
    return;
  }

  elements.focusTaskContent.hidden = false;
  const emptyText = elements.focusTaskCard.querySelector('.focus-empty');
  if (emptyText) emptyText.style.display = 'none';

  elements.focusTaskTitle.textContent = card.title || '(Sin título)';
  elements.focusTaskUrl.textContent = card.url;
  elements.focusTaskCategory.textContent = categoryLabel(card.category);
  elements.focusTaskTime.textContent = `${card.estimatedTime} min`;

  elements.focusOpenBtn.onclick = () => {
    window.open(card.url, '_blank', 'noopener');
  };

  updateFocusNowLabel(card);
  resetFocusTimer();
  render();
}

function clearFocusTaskDetails() {
  if (!elements.focusTaskContent) return;
  elements.focusTaskContent.hidden = true;
  const emptyText = elements.focusTaskCard.querySelector('.focus-empty');
  if (emptyText) emptyText.style.display = 'block';
  elements.focusTaskTitle.textContent = '';
  elements.focusTaskUrl.textContent = '';
  elements.focusTaskCategory.textContent = '';
  elements.focusTaskTime.textContent = '';
  updateFocusNowLabel(null);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateFocusTimerDisplay() {
  if (!elements.focusTimerDisplay) return;
  elements.focusTimerDisplay.textContent = formatTime(focusRemainingSeconds);
}

function hideFocusResultPanel() {
  if (!elements.focusResultPanel) return;
  elements.focusResultPanel.hidden = true;
}

function showFocusResultPanel() {
  if (!elements.focusResultPanel) return;
  elements.focusResultPanel.hidden = false;
}

function setFocusRunningVisual(isRunning) {
  if (!elements.focusTimerDisplay) return;
  const card = elements.focusTimerDisplay.closest('.focus-timer-card');
  if (isRunning) {
    if (card) card.classList.add('focus-running');
    elements.focusTimerDisplay.classList.add('focus-running');
  } else {
    if (card) card.classList.remove('focus-running');
    elements.focusTimerDisplay.classList.remove('focus-running');
  }
}

function resetFocusTimer() {
  stopFocusTimer();
  focusRemainingSeconds = FOCUS_DURATION_SECONDS;
  updateFocusTimerDisplay();
  if (elements.focusStartPauseBtn) {
    elements.focusStartPauseBtn.textContent = 'Iniciar sesión';
  }
  hideFocusResultPanel();
}

function tickFocusTimer() {
  if (focusRemainingSeconds <= 0) {
    stopFocusTimer();
    focusRemainingSeconds = 0;
    updateFocusTimerDisplay();
    if (elements.focusStartPauseBtn) {
      elements.focusStartPauseBtn.textContent = 'Iniciar sesión';
    }
    handleFocusSessionEnd();
    return;
  }
  focusRemainingSeconds -= 1;
  updateFocusTimerDisplay();
}

function startFocusTimer() {
  if (focusRunning || !focusSelectedId) return;
  focusRunning = true;
  focusIntervalId = setInterval(tickFocusTimer, 1000);
  if (elements.focusStartPauseBtn) {
    elements.focusStartPauseBtn.textContent = 'Pausar';
  }
  hideFocusResultPanel();
  setFocusRunningVisual(true);
}

function stopFocusTimer() {
  focusRunning = false;
  if (focusIntervalId) {
    clearInterval(focusIntervalId);
    focusIntervalId = null;
  }
  setFocusRunningVisual(false);
}

function toggleFocusTimer() {
  if (!focusSelectedId) {
    alert('Primero elige una tarea para esta sesión.');
    return;
  }
  if (focusRunning) {
    stopFocusTimer();
    if (elements.focusStartPauseBtn) {
      elements.focusStartPauseBtn.textContent = 'Reanudar';
    }
  } else {
    startFocusTimer();
  }
}

function handleFocusSessionEnd() {
  if (!focusSelectedId) return;
  const card = cards.find((c) => c.id === focusSelectedId);
  if (!card) return;
  showFocusResultPanel();
}

function handleFocusMarkDone() {
  if (!focusSelectedId) return;
  const card = cards.find((c) => c.id === focusSelectedId);
  if (!card) return;

  card.completed = true;
  card.completedAt = Date.now();
  saveCards();
  render();
  updateFocusTaskOptions();
  clearFocusTaskDetails();
  resetFocusTimer();
}

function handleFocusAnotherSession() {
  resetFocusTimer();
  startFocusTimer();
}

/* Iniciar Focus desde una tarjeta de la bandeja */

function startFocusSessionFromCard(id) {
  const card = cards.find((c) => c.id === id && !c.completed);
  if (!card) return;

  focusSelectedId = id;

  switchView('focus');

  if (elements.focusTaskSelect) {
    elements.focusTaskSelect.value = id;
  }

  handleFocusTaskChange();
  resetFocusTimer();

  if (elements.focusStartPauseBtn) {
    elements.focusStartPauseBtn.focus();
  }
}

/* ===== INIT ===== */

function init() {
  initTheme();
  loadCards();
  render();

  elements.form.addEventListener('submit', addCardFromForm);
  elements.searchInput.addEventListener('input', handleSearch);
  elements.clearCompletedBtn.addEventListener('click', clearCompleted);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.addCardBtn.addEventListener('click', () => {
    elements.urlInput.focus();
  });

  initNavigation();

  if (elements.focusTaskSelect) {
    elements.focusTaskSelect.addEventListener('change', handleFocusTaskChange);
  }
  if (elements.focusStartPauseBtn) {
    elements.focusStartPauseBtn.addEventListener('click', toggleFocusTimer);
  }
  if (elements.focusResetBtn) {
    elements.focusResetBtn.addEventListener('click', resetFocusTimer);
  }
  if (elements.focusMarkDoneBtn) {
    elements.focusMarkDoneBtn.addEventListener('click', handleFocusMarkDone);
  }
  if (elements.focusAnotherBtn) {
    elements.focusAnotherBtn.addEventListener('click', handleFocusAnotherSession);
  }

  updateFocusTimerDisplay();
  updateFocusTaskOptions();
  updateHistoryView();
}

document.addEventListener('DOMContentLoaded', init);
