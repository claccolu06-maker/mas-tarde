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
};

const viewElements = {
  inbox: document.getElementById('view-inbox'),
  focus: document.getElementById('view-focus'),
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

/* ===== RENDERIZADO DE TARJETAS ===== */

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

function createCard({ id, url, title, category, estimatedTime, completed }) {
  const node = elements.cardTemplate.content.firstElementChild.cloneNode(true);

  const titleEl = node.querySelector('.card-title');
  const urlEl = node.querySelector('.card-url');
  const categoryPill = node.querySelector('.pill-category');
  const timePill = node.querySelector('.pill-time');
  const completeBtn = node.querySelector('.card-complete-btn');
  const openBtn = node.querySelector('.card-open-btn');
  const deleteBtn = node.querySelector('.card-delete-btn');

  titleEl.textContent = title || '(Sin título)';
  urlEl.textContent = url;

  categoryPill.textContent = categoryLabel(category);
  categoryPill.dataset.category = category;

  timePill.textContent = `${estimatedTime} min`;

  if (completed) {
    node.classList.add('completed');
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

  if (filtered.length === 0) {
    elements.cardsSubtitle.textContent =
      'Tu mente está libre. Guarda algo que quieras hacer cuando tengas tiempo ✨';
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

  updateSummary();
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
}

document.addEventListener('DOMContentLoaded', init);
