const STORAGE_KEY = 'smartTimeHub.cards';
const THEME_KEY = 'smartTimeHub.theme';

let cards = [];

// DOM Elements cache
const elements = {
  // Inbox Form
  form: document.getElementById('cardForm'), urlInput: document.getElementById('urlInput'),
  titleInput: document.getElementById('titleInput'), categorySelect: document.getElementById('categorySelect'),
  timeInput: document.getElementById('timeInput'), cardsGrid: document.getElementById('cardsGrid'),
  cardTemplate: document.getElementById('cardTemplate'), pendingCount: document.getElementById('pendingCount'),
  completedCount: document.getElementById('completedCount'), totalTime: document.getElementById('totalTime'),
  footerSummary: document.getElementById('footerSummary'), cardsSubtitle: document.getElementById('cardsSubtitle'),
  searchInput: document.getElementById('searchInput'), clearCompletedBtn: document.getElementById('clearCompletedBtn'),
  themeToggle: document.getElementById('themeToggle'), addCardBtn: document.getElementById('addCardBtn'),
  emptyState: document.getElementById('emptyState'),
  
  // Focus Mode
  focusTaskSelect: document.getElementById('focusTaskSelect'), focusTaskCard: document.getElementById('focusTaskCard'),
  focusTaskContent: document.getElementById('focusTaskContent'), focusTaskTitle: document.getElementById('focusTaskTitle'),
  focusTaskUrl: document.getElementById('focusTaskUrl'), focusTaskCategory: document.getElementById('focusTaskCategory'),
  focusTaskTime: document.getElementById('focusTaskTime'), focusOpenBtn: document.getElementById('focusOpenBtn'),
  focusTimerDisplay: document.getElementById('focusTimerDisplay'), focusStartPauseBtn: document.getElementById('focusStartPauseBtn'),
  focusResetBtn: document.getElementById('focusResetBtn'), focusResultPanel: document.getElementById('focusResultPanel'),
  focusMarkDoneBtn: document.getElementById('focusMarkDoneBtn'), focusAnotherBtn: document.getElementById('focusAnotherBtn'),
  focusNowLabel: document.getElementById('focusNowLabel'), focusNowTitle: document.getElementById('focusNowTitle'),

  // History & Board
  historyTableBody: document.getElementById('historyTableBody'), historySubtitle: document.getElementById('historySubtitle'),
  historySessionsCount: document.getElementById('historySessionsCount'), historyMinutesTotal: document.getElementById('historyMinutesTotal'),
  boardSomeday: document.getElementById('boardSomeday'), boardWeek: document.getElementById('boardWeek'),
  boardToday: document.getElementById('boardToday'), boardDone: document.getElementById('boardDone'),
  boardCountSomeday: document.getElementById('boardCountSomeday'), boardCountWeek: document.getElementById('boardCountWeek'),
  boardCountToday: document.getElementById('boardCountToday'), boardCountDone: document.getElementById('boardCountDone'),
};

const viewElements = {
  inbox: document.getElementById('view-inbox'), focus: document.getElementById('view-focus'),
  board: document.getElementById('view-board'), history: document.getElementById('view-history'),
};
const navButtons = document.querySelectorAll('.nav-item[data-view]');

/* ===== MEJORAS DE HELPERS ===== */
// Generador seguro de IDs si crypto falla
const generateId = () => crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2));

// Corrector inteligente de URLs
const normalizeUrl = (url) => /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

const categoryLabel = (cat) => ({ video: 'Video', article: 'Artículo', course: 'Curso', project: 'Proyecto' })[cat] || 'Otro';

const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
};

/* ===== STORAGE ===== */
function loadCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Reparada redundancia de destructuring
    cards = raw ? JSON.parse(raw).map(c => ({ ...c, bucket: c.bucket || 'inbox' })) : [];
  } catch (e) {
    console.error('Error al parsear LocalStorage:', e);
    cards = [];
  }
}
const saveCards = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));

/* ===== BANDEJA (INBOX) ===== */
function createCard(card) {
  const node = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  
  node.querySelector('.card-title').textContent = card.title || '(Sin título)';
  node.querySelector('.card-url').textContent = card.url;
  
  const catPill = node.querySelector('.pill-category');
  catPill.textContent = categoryLabel(card.category);
  catPill.dataset.category = card.category;
  
  node.querySelector('.pill-time').textContent = `${card.estimatedTime} min`;
  
  if (card.completed) node.classList.add('completed');
  if (focusSelectedId === card.id) node.classList.add('focus-active');

  // Integración perfecta con la Pizarra
  const moveSelect = node.querySelector('.card-move-select');
  if (moveSelect) {
    moveSelect.value = card.bucket;
    moveSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      moveCardToBucket(card.id, e.target.value);
    });
  }

  node.querySelector('.card-complete-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleCompleted(card.id); });
  node.querySelector('.card-open-btn').addEventListener('click', (e) => { e.stopPropagation(); window.open(card.url, '_blank', 'noopener'); });
  node.querySelector('.card-delete-btn').addEventListener('click', (e) => { e.stopPropagation(); confirmDelete(card.id); });
  node.querySelector('.card-focus-btn').addEventListener('click', (e) => { e.stopPropagation(); startFocusSessionFromCard(card.id); });
  node.addEventListener('click', () => window.open(card.url, '_blank', 'noopener'));

  return node;
}

function render() {
  const term = elements.searchInput.value.trim().toLowerCase();
  
  // Mostramos en bandeja solo los que están en 'inbox' o según quieras (yo asumo bandeja pura o todo si es búsqueda)
  const filtered = cards.filter(c => 
    (c.bucket === 'inbox') &&
    (!term || (c.title?.toLowerCase().includes(term) || c.category.toLowerCase().includes(term)))
  );

  elements.cardsGrid.innerHTML = '';
  filtered.sort((a, b) => b.createdAt - a.createdAt).forEach(c => elements.cardsGrid.appendChild(createCard(c)));

  updateEmptyState(filtered);
  updateSummary();
  updateFocusTaskOptions();
  updateHistoryView();
  renderBoard();
}

function updateEmptyState(filteredCards) {
  const inboxEmpty = cards.filter(c => c.bucket === 'inbox').length === 0;
  elements.emptyState.style.display = inboxEmpty ? 'block' : 'none';
  elements.cardsSubtitle.textContent = inboxEmpty ? 'Guarda algo que quieras hacer.' : `Tienes ${filteredCards.length} elementos en la bandeja.`;
}

function updateSummary() {
  const pending = cards.filter(c => !c.completed);
  elements.pendingCount.textContent = pending.length;
  elements.completedCount.textContent = cards.filter(c => c.completed).length;
  elements.totalTime.textContent = `${pending.reduce((sum, c) => sum + (c.estimatedTime || 0), 0)} min`;
}

/* ===== ACCIONES DE TARJETA ===== */
function addCardFromForm(e) {
  e.preventDefault();
  const rawUrl = elements.urlInput.value;
  if (!rawUrl) return;

  const newCard = {
    id: generateId(),
    url: normalizeUrl(rawUrl),
    title: elements.titleInput.value.trim(),
    category: elements.categorySelect.value,
    estimatedTime: parseInt(elements.timeInput.value, 10),
    createdAt: Date.now(),
    completed: false,
    completedAt: null,
    bucket: 'inbox',
  };

  cards.push(newCard);
  saveCards();
  render();
  elements.form.reset();
}

function toggleCompleted(id) {
  const card = cards.find(c => c.id === id);
  if (!card) return;
  card.completed = !card.completed;
  card.completedAt = card.completed ? Date.now() : null;
  card.bucket = card.completed ? 'done' : 'inbox';
  saveCards();
  render();
}

function confirmDelete(id) {
  if (confirm('¿Borrar esta tarjeta?')) {
    cards = cards.filter(c => c.id !== id);
    saveCards();
    render();
  }
}

function clearCompleted() {
  if (confirm('Se borrarán todas las completadas. ¿Continuar?')) {
    cards = cards.filter(c => !c.completed);
    saveCards();
    render();
  }
}

/* ===== TEMA Y NAVEGACIÓN ===== */
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('theme-dark');
  document.documentElement.classList.toggle('theme-light', !isDark);
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.classList.toggle('theme-dark', saved === 'dark');
  document.documentElement.classList.toggle('theme-light', saved === 'light');
}

function switchView(target) {
  Object.values(viewElements).forEach(s => s && s.classList.remove('view-active'));
  navButtons.forEach(btn => btn.classList.remove('nav-item-active'));
  viewElements[target]?.classList.add('view-active');
  document.querySelector(`.nav-item[data-view="${target}"]`)?.classList.add('nav-item-active');
}

/* ===== MODO FOCUS (Timestamps para precisión) ===== */
const FOCUS_DURATION_SECONDS = 30 * 60;
let focusSelectedId = null;
let focusRemainingSeconds = FOCUS_DURATION_SECONDS;
let focusIntervalId = null;
let focusEndTime = null; 
let focusRunning = false;

function updateFocusTaskOptions() {
  const pending = cards.filter(c => !c.completed);
  elements.focusTaskSelect.innerHTML = '<option value="">Selecciona una tarea…</option>';
  pending.forEach(c => elements.focusTaskSelect.appendChild(new Option(c.title || c.url, c.id)));
  
  if (pending.some(c => c.id === focusSelectedId)) {
    elements.focusTaskSelect.value = focusSelectedId;
  } else {
    focusSelectedId = null;
    clearFocusTaskDetails();
    resetFocusTimer();
  }
}

function handleFocusTaskChange() {
  focusSelectedId = elements.focusTaskSelect.value || null;
  const card = cards.find(c => c.id === focusSelectedId && !c.completed);
  
  if (!card) return clearFocusTaskDetails();

  elements.focusTaskContent.hidden = false;
  elements.focusTaskCard.querySelector('.focus-empty').style.display = 'none';
  elements.focusTaskTitle.textContent = card.title || '(Sin título)';
  elements.focusTaskUrl.textContent = card.url;
  elements.focusTaskCategory.textContent = categoryLabel(card.category);
  elements.focusTaskTime.textContent = `${card.estimatedTime} min`;
  elements.focusOpenBtn.onclick = () => window.open(card.url, '_blank', 'noopener');
  
  elements.focusNowTitle.textContent = card.title;
  elements.focusNowLabel.hidden = false;
  
  resetFocusTimer();
  render();
}

function clearFocusTaskDetails() {
  elements.focusTaskContent.hidden = true;
  elements.focusTaskCard.querySelector('.focus-empty').style.display = 'block';
  elements.focusNowLabel.hidden = true;
  elements.focusNowTitle.textContent = '';
  resetFocusTimer();
}

// Reloj a prueba de cambios de pestaña
function tickFocusTimer() {
  if (!focusRunning) return;
  const now = Date.now();
  focusRemainingSeconds = Math.max(0, Math.ceil((focusEndTime - now) / 1000));
  
  const m = Math.floor(focusRemainingSeconds / 60).toString().padStart(2, '0');
  const s = (focusRemainingSeconds % 60).toString().padStart(2, '0');
  elements.focusTimerDisplay.textContent = `${m}:${s}`;

  if (focusRemainingSeconds <= 0) {
    stopFocusTimer();
    elements.focusStartPauseBtn.textContent = 'Iniciar sesión';
    elements.focusResultPanel.hidden = false;
  }
}

function toggleFocusTimer() {
  if (!focusSelectedId) return alert('Elige una tarea.');
  if (focusRunning) stopFocusTimer();
  else startFocusTimer();
}

function startFocusTimer() {
  focusRunning = true;
  focusEndTime = Date.now() + (focusRemainingSeconds * 1000); // Sincronización absoluta
  focusIntervalId = setInterval(tickFocusTimer, 500); // Chequea cada medio segundo
  elements.focusStartPauseBtn.textContent = 'Pausar';
  elements.focusResultPanel.hidden = true;
  elements.focusTimerDisplay.classList.add('focus-running');
}

function stopFocusTimer() {
  focusRunning = false;
  clearInterval(focusIntervalId);
  elements.focusStartPauseBtn.textContent = 'Reanudar';
  elements.focusTimerDisplay.classList.remove('focus-running');
}

function resetFocusTimer() {
  stopFocusTimer();
  focusRemainingSeconds = FOCUS_DURATION_SECONDS;
  elements.focusTimerDisplay.textContent = '30:00';
  elements.focusStartPauseBtn.textContent = 'Iniciar sesión';
  elements.focusResultPanel.hidden = true;
}

function handleFocusMarkDone() {
  if (!focusSelectedId) return;
  toggleCompleted(focusSelectedId);
  focusSelectedId = null;
  clearFocusTaskDetails();
}

function startFocusSessionFromCard(id) {
  focusSelectedId = id;
  switchView('focus');
  elements.focusTaskSelect.value = id;
  handleFocusTaskChange();
}

/* ===== PIZARRA (BOARD) ===== */
function moveCardToBucket(id, bucket) {
  const card = cards.find(c => c.id === id);
  if (!card) return;
  if (bucket === 'today' && cards.filter(c => c.bucket === 'today' && !c.completed).length >= 3) {
    return alert('Límite de 3 tareas en Hoy.');
  }
  card.bucket = bucket;
  saveCards();
  render();
}

function createBoardCard(card) {
  const node = document.createElement('article');
  node.className = `board-card ${card.completed ? 'board-card-done' : ''}`;
  node.innerHTML = `
    <div class="board-card-header">
      <h4 class="board-card-title">${card.title || card.url}</h4>
      <span class="pill pill-time">${card.estimatedTime}m</span>
    </div>
    <div class="board-card-meta">
      <span class="pill pill-category">${categoryLabel(card.category)}</span>
    </div>
    <div class="board-card-footer">
      <div class="board-card-actions prev-next-actions">
        <button class="btn-prev">←</button>
        <button class="btn-next">→</button>
      </div>
      <button class="board-card-focus-btn">Focus</button>
    </div>
  `;

  // Lógica de movimiento en pizarra mejorada
  const order = ['inbox', 'someday', 'week', 'today', 'done'];
  const idx = order.indexOf(card.bucket);
  
  node.querySelector('.btn-prev').onclick = (e) => { e.stopPropagation(); moveCardToBucket(card.id, order[Math.max(0, idx - 1)]); };
  node.querySelector('.btn-next').onclick = (e) => { e.stopPropagation(); moveCardToBucket(card.id, order[Math.max(0, Math.min(order.length - 1, idx + 1))]); };
  node.querySelector('.board-card-focus-btn').onclick = (e) => { e.stopPropagation(); startFocusSessionFromCard(card.id); };
  node.onclick = () => window.open(card.url, '_blank', 'noopener');

  return node;
}

function renderBoard() {
  ['someday', 'week', 'today', 'done'].forEach(bucket => {
    const el = elements[`board${bucket.charAt(0).toUpperCase() + bucket.slice(1)}`];
    const countEl = elements[`boardCount${bucket.charAt(0).toUpperCase() + bucket.slice(1)}`];
    if (!el) return;
    
    el.innerHTML = '';
    const bucketCards = cards.filter(c => c.bucket === bucket);
    bucketCards.forEach(c => el.appendChild(createBoardCard(c)));
    if (countEl) countEl.textContent = bucketCards.length;
  });
}

/* ===== HISTORIAL ===== */
function updateHistoryView() {
  const completed = cards.filter(c => c.completed).sort((a, b) => b.completedAt - a.completedAt);
  elements.historyTableBody.innerHTML = completed.map(c => `
    <tr>
      <td>${c.title || c.url}</td>
      <td>${categoryLabel(c.category)}</td>
      <td>${formatDateTime(c.completedAt)}</td>
      <td>${c.estimatedTime} min</td>
    </tr>
  `).join('');

  elements.historySubtitle.textContent = completed.length ? `Has completado ${completed.length} tareas.` : 'Sin tareas completadas.';
  elements.historyMinutesTotal.textContent = `${completed.reduce((s, c) => s + c.estimatedTime, 0)} min`;
  
  // Cuenta tareas de los últimos 7 días
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  elements.historySessionsCount.textContent = completed.filter(c => c.completedAt > weekAgo).length;
}

/* ===== INIT ===== */
function init() {
  initTheme();
  loadCards();
  
  elements.form.addEventListener('submit', addCardFromForm);
  elements.searchInput.addEventListener('input', render);
  elements.clearCompletedBtn.addEventListener('click', clearCompleted);
  elements.themeToggle.addEventListener('click', toggleTheme);
  navButtons.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  
  elements.focusTaskSelect.addEventListener('change', handleFocusTaskChange);
  elements.focusStartPauseBtn.addEventListener('click', toggleFocusTimer);
  elements.focusResetBtn.addEventListener('click', resetFocusTimer);
  elements.focusMarkDoneBtn.addEventListener('click', handleFocusMarkDone);
  elements.focusAnotherBtn.addEventListener('click', () => { resetFocusTimer(); startFocusTimer(); });

  switchView('inbox');
  render();
}

document.addEventListener('DOMContentLoaded', init);
