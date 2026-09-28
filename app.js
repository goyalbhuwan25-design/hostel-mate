const STORAGE_KEY = 'hostelmate-data-v1';
const CATEGORY_OPTIONS = [
  'Food',
  'Groceries',
  'Travel',
  'Electricity',
  'Internet',
  'Rent',
  'Study',
  'Entertainment',
  'Other'
];

const state = {
  data: loadData(),
  activeView: 'dashboard',
  chartInstances: {},
  pendingExpenseEntryId: null,
  chartResizeTimeout: null,
  editingExpenseId: null,
  historyMonthKey: getCurrentMonthKey()
};

init();

function init() {
  if (window.Chart) {
    Chart.defaults.animation.duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
    Chart.defaults.animation.easing = 'easeOutQuart';
  }
  bindGlobalEvents();
  renderCategoryOptions();
  renderRoommateOptions();
  applyTheme(state.data.settings.darkMode);
  renderAll();
}

function bindGlobalEvents() {
  window.addEventListener('resize', () => {
    window.clearTimeout(state.chartResizeTimeout);
    state.chartResizeTimeout = window.setTimeout(() => {
      refreshActiveCharts();
    }, 120);
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      if (view) {
        setActiveView(view);
      }
    });
  });

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('mobileMenu').addEventListener('click', toggleSidebar);
  document.getElementById('resetExpenseForm').addEventListener('click', resetExpenseForm);
  document.getElementById('cancelExpenseForm').addEventListener('click', cancelExpenseForm);
  document.getElementById('expenseForm').addEventListener('submit', handleAddExpense);
  document.getElementById('roommateForm').addEventListener('submit', handleAddRoommate);
  document.getElementById('cancelRoommateEdit').addEventListener('click', resetRoommateForm);
  document.getElementById('settingsForm').addEventListener('submit', handleSettingsSave);
  document.getElementById('resetAllDataBtn').addEventListener('click', resetAllData);
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', importData);
  document.getElementById('closeExpenseDetails').addEventListener('click', closeExpenseDetails);
  document.getElementById('clearExpenseFilters').addEventListener('click', clearExpenseFilters);
  document.getElementById('roommateSearch').addEventListener('input', renderRoommates);
  document.getElementById('historyPreviousMonth').addEventListener('click', () => shiftHistoryMonth(-1));
  document.getElementById('historyNextMonth').addEventListener('click', () => shiftHistoryMonth(1));
  document.getElementById('exportMonthlyReportBtn').addEventListener('click', exportMonthlyReport);
  document.getElementById('recentExpensesList').addEventListener('click', (event) => {
    const item = event.target.closest('[data-expense-id]');
    if (item) showExpenseDetails(item.dataset.expenseId);
  });
  document.getElementById('expensesTableBody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'view-expense') showExpenseDetails(button.dataset.id);
    if (button.dataset.action === 'edit-expense') editExpense(button.dataset.id);
    if (button.dataset.action === 'delete-expense') deleteExpense(button.dataset.id);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSidebar();
      closeExpenseDetails();
    }
  });
  document.getElementById('expenseDetailsModal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeExpenseDetails();
  });
  document.getElementById('expenseDetailsModal').addEventListener('cancel', (event) => {
    event.preventDefault();
    closeExpenseDetails();
  });
  document.addEventListener('click', (event) => {
    const sidebar = document.getElementById('sidebar');
    const menuButton = document.getElementById('mobileMenu');
    if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !menuButton.contains(event.target)) {
      closeSidebar();
    }
  });

  document.getElementById('expenseSearch').addEventListener('input', renderExpenses);
  document.getElementById('expenseCategoryFilter').addEventListener('change', renderExpenses);
  document.getElementById('expenseDateFilter').addEventListener('change', renderExpenses);
  document.getElementById('expensePersonFilter').addEventListener('change', renderExpenses);
  document.getElementById('expenseSort').addEventListener('change', renderExpenses);
  document.getElementById('historyMonthSelect').addEventListener('change', (event) => {
    state.historyMonthKey = event.target.value;
    renderMonthlyHistory();
  });
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const demoData = buildDemoData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoData));
    return demoData;
  }

  try {
    const parsed = JSON.parse(saved);
    return normalizeData(parsed);
  } catch (error) {
    console.error('Data parsing failed:', error);
    const demoData = buildDemoData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoData));
    return demoData;
  }
}

function normalizeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const defaults = buildDemoData();
  const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
  const profile = data.userProfile && typeof data.userProfile === 'object' ? data.userProfile : {};
  const profileName = String(profile.name || defaults.userProfile.name).trim();
  const roommateIds = new Set();
  const roommateNames = new Set([profileName.toLowerCase()]);
  const roommates = (Array.isArray(data.roommates) ? data.roommates : defaults.roommates)
    .filter((roommate) => roommate && String(roommate.name || '').trim() && String(roommate.id || '').trim())
    .map((roommate) => ({ id: String(roommate.id), name: String(roommate.name).trim(), email: String(roommate.email || '').trim() }))
    .filter((roommate) => {
      const name = roommate.name.toLowerCase();
      if (roommateIds.has(roommate.id) || roommateNames.has(name)) return false;
      roommateIds.add(roommate.id);
      roommateNames.add(name);
      return true;
    });
  const expenseIds = new Set();
  const expenses = (Array.isArray(data.expenses) ? data.expenses : defaults.expenses)
    .filter((expense) => expense && String(expense.id || '').trim() && String(expense.title || '').trim()
      && Number.isFinite(Number(expense.amount)) && Number(expense.amount) > 0 && isValidDateInput(expense.date))
    .map((expense) => ({
      ...expense,
      id: String(expense.id),
      title: String(expense.title).trim(),
      amount: Number(expense.amount),
      category: String(expense.category || 'Other'),
      paidBy: String(expense.paidBy || profileName),
      date: String(expense.date),
      notes: String(expense.notes || ''),
      splitBetween: [...new Set((Array.isArray(expense.splitBetween) ? expense.splitBetween : [expense.paidBy])
        .map((person) => String(person || '').trim()).filter(Boolean))]
    }))
    .filter((expense) => {
      if (expenseIds.has(expense.id)) return false;
      expenseIds.add(expense.id);
      return true;
    });
  const settlementIds = new Set();
  const settlements = (Array.isArray(data.settlements) ? data.settlements : [])
    .filter((item) => item && ['paid', 'received'].includes(item.type) && String(item.person || '').trim()
      && Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 && isValidDateInput(item.date))
    .map((item) => ({
      ...item,
      id: String(item.id || crypto.randomUUID()),
      person: String(item.person).trim(),
      amount: Number(item.amount),
      date: String(item.date)
    }))
    .filter((item) => {
      if (settlementIds.has(item.id)) return false;
      settlementIds.add(item.id);
      return true;
    });
  return {
    userProfile: {
      ...defaults.userProfile,
      ...profile,
      name: profileName,
      hostelName: String(profile.hostelName || defaults.userProfile.hostelName),
      currency: String(profile.currency || defaults.userProfile.currency)
    },
    roommates,
    expenses,
    settlements,
    settings: {
      ...defaults.settings,
      ...settings,
      monthlyBudget: Number.isFinite(Number(settings.monthlyBudget)) && Number(settings.monthlyBudget) > 0
        ? Number(settings.monthlyBudget)
        : 600
    }
  };
}

function createEmptyData() {
  return {
    userProfile: { name: 'Bhuwan Goyal', hostelName: 'My Hostel', currency: '₹', darkMode: true, notifications: false },
    roommates: [],
    expenses: [],
    settlements: [],
    settings: { darkMode: true, notifications: false, currency: '₹', monthlyBudget: 600 }
  };
}

function saveData(data = state.data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function updateData(mutator) {
  const nextData = mutator({ ...state.data });
  state.data = normalizeData(nextData);
  saveData(state.data);
  renderAll();
}

function deleteData() {
  state.data = createEmptyData();
  saveData(state.data);
}

function buildDemoData() {
  const roommates = [
    { id: 'roommate-1', name: 'Roommate 1', email: 'roommate1@hostel.com' },
    { id: 'roommate-2', name: 'Roommate 2', email: 'roommate2@hostel.com' },
    { id: 'roommate-3', name: 'Roommate 3', email: 'roommate3@hostel.com' },
    { id: 'roommate-4', name: 'Roommate 4', email: 'roommate4@hostel.com' }
  ];

  const now = new Date();
  const seedExpenses = [
    {
      id: crypto.randomUUID(),
      title: 'Milk',
      amount: 30,
      category: 'Food',
      paidBy: 'Bhuwan Goyal',
      date: formatDateForInput(subtractDays(now, 1)),
      splitBetween: ['Bhuwan Goyal', 'Roommate 1', 'Roommate 2'],
      notes: 'Milk for morning breakfast.'
    },
    {
      id: crypto.randomUUID(),
      title: 'Groceries',
      amount: 420,
      category: 'Groceries',
      paidBy: 'Roommate 2',
      date: formatDateForInput(subtractDays(now, 3)),
      splitBetween: ['Bhuwan Goyal', 'Roommate 1', 'Roommate 2', 'Roommate 3'],
      notes: 'Monthly grocery run.'
    },
    {
      id: crypto.randomUUID(),
      title: 'Dinner',
      amount: 260,
      category: 'Food',
      paidBy: 'Roommate 3',
      date: formatDateForInput(subtractDays(now, 4)),
      splitBetween: ['Bhuwan Goyal', 'Roommate 1', 'Roommate 2'],
      notes: 'Shared dinner and snacks.'
    },
    {
      id: crypto.randomUUID(),
      title: 'Internet',
      amount: 450,
      category: 'Internet',
      paidBy: 'Bhuwan Goyal',
      date: formatDateForInput(subtractDays(now, 7)),
      splitBetween: ['Bhuwan Goyal', 'Roommate 1', 'Roommate 2', 'Roommate 3'],
      notes: 'Monthly hostel internet bill.'
    },
    {
      id: crypto.randomUUID(),
      title: 'Auto Travel',
      amount: 180,
      category: 'Travel',
      paidBy: 'Roommate 4',
      date: formatDateForInput(subtractDays(now, 8)),
      splitBetween: ['Bhuwan Goyal', 'Roommate 1', 'Roommate 4'],
      notes: 'Travel to market.'
    },
    {
      id: crypto.randomUUID(),
      title: 'Electricity',
      amount: 620,
      category: 'Electricity',
      paidBy: 'Bhuwan Goyal',
      date: formatDateForInput(subtractDays(now, 12)),
      splitBetween: ['Bhuwan Goyal', 'Roommate 1', 'Roommate 2', 'Roommate 3'],
      notes: 'Monthly power bill.'
    }
  ];

  return {
    userProfile: {
      name: 'Bhuwan Goyal',
      hostelName: 'Block C Room 104',
      currency: '₹',
      darkMode: true,
      notifications: true
    },
    roommates,
    expenses: seedExpenses,
    settlements: [],
    settings: {
      darkMode: true,
      notifications: true,
      currency: '₹',
      monthlyBudget: 600
    }
  };
}

function renderAll() {
  renderThemeControls();
  renderHeader();
  populateFilterControls();
  populateHistorySelect();
  renderDashboard();
  renderExpenses();
  renderRoommates();
  renderSettlements();
  renderAnalytics();
  renderMonthlyHistory();
  renderSettings();
  renderExpenseForm();
}

function renderHeader() {
  const userName = state.data.userProfile.name || 'Bhuwan Goyal';
  const hour = new Date().getHours();
  let greeting = 'Good Evening';
  if (hour < 12) greeting = 'Good Morning';
  if (hour >= 12 && hour < 18) greeting = 'Good Afternoon';

  document.getElementById('greeting').textContent = `${greeting}, ${userName} 👋`;
  document.getElementById('pageTitle').textContent = getPageTitle();
}

function getPageTitle() {
  const titles = {
    dashboard: 'Dashboard',
    expenses: 'Expenses',
    'add-expense': 'Add Expense',
    roommates: 'Roommates',
    settlements: 'Settlements',
    analytics: 'Analytics',
    'monthly-history': 'Monthly History',
    settings: 'Settings',
    about: 'About HostelMate'
  };
  return titles[state.activeView] || 'Dashboard';
}

function setActiveView(view) {
  state.activeView = view;
  document.querySelectorAll('.view').forEach((section) => {
    section.classList.toggle('active', section.id === `${view}-view`);
  });

  document.querySelectorAll('.nav-item').forEach((navItem) => {
    navItem.classList.toggle('active', navItem.dataset.view === view);
  });

  document.getElementById('pageTitle').textContent = getPageTitle();
  closeSidebar();
  refreshActiveCharts();
}

function refreshActiveCharts() {
  if (state.activeView === 'dashboard') renderDashboardChart();
  if (state.activeView === 'analytics') renderAnalytics();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  document.getElementById('mobileMenu').setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileMenu').setAttribute('aria-expanded', 'false');
}

function renderDashboard() {
  const stats = getDashboardStats();
  const cards = [
    {
      title: 'Total Expenses',
      icon: 'fa-solid fa-wallet',
      value: formatCurrency(stats.totalExpenses),
      trend: `${stats.expenseCount} transactions`,
      tone: 'positive'
    },
    {
      title: 'You Owe',
      icon: 'fa-solid fa-arrow-down',
      value: formatCurrency(stats.youOwe),
      trend: 'Pending balance',
      tone: 'negative'
    },
    {
      title: 'You’ll Receive',
      icon: 'fa-solid fa-arrow-up',
      value: formatCurrency(stats.youReceive),
      trend: 'Incoming amount',
      tone: 'positive'
    },
    {
      title: 'Group Expenses',
      icon: 'fa-solid fa-chart-line',
      value: formatCurrency(stats.groupExpenses),
      trend: 'Shared spend',
      tone: 'warning'
    }
  ];

  document.getElementById('dashboardStats').innerHTML = cards
    .map(
      (card) => `
        <div class="stats-card">
          <div class="meta">
            <span>${card.title}</span>
            <span class="icon-box" style="background:${getToneBackground(card.tone)}; color:${getToneColor(card.tone)};">
              <i class="${card.icon}"></i>
            </span>
          </div>
          <h4 data-count-up="${card.title}" data-value="${stats[{
            'Total Expenses': 'totalExpenses',
            'You Owe': 'youOwe',
            'You’ll Receive': 'youReceive',
            'Group Expenses': 'groupExpenses'
          }[card.title]]}">${card.value}</h4>
          <div class="trend ${card.tone}">${card.trend}</div>
        </div>
      `
    )
    .join('');

  animateDashboardTotals();

  renderRecentExpenses();
  renderUpcomingSettlements();
  renderMonthlyBudget();
  renderDashboardChart();
}

function renderMonthlyBudget() {
  const budget = Number(state.data.settings.monthlyBudget) || 600;
  const spent = getUserMonthlySpend(getCurrentMonthKey());
  const remaining = budget - spent;
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const progress = document.getElementById('budgetProgressBar');
  const track = progress.parentElement;

  document.getElementById('budgetLimitLabel').textContent = formatCurrency(budget);
  document.getElementById('budgetSpentLabel').textContent = `Spent ${formatCurrency(spent)}`;
  document.getElementById('budgetRemainingLabel').textContent = remaining >= 0
    ? `${formatCurrency(remaining)} remaining`
    : `${formatCurrency(Math.abs(remaining))} over budget`;
  document.getElementById('budgetStatus').textContent = percentage >= 100
    ? 'Monthly spending limit reached. Track new spending carefully.'
    : `${Math.max(0, 100 - percentage).toFixed(0)}% of your monthly budget remains.`;
  progress.style.width = `${Math.min(100, percentage)}%`;
  progress.classList.toggle('over-budget', remaining < 0);
  track.setAttribute('aria-valuenow', String(Math.min(100, Math.round(percentage))));
}

function animateDashboardTotals() {
  if (state.activeView !== 'dashboard') return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('#dashboardStats [data-count-up]').forEach((element) => {
    const target = Number(element.dataset.value || 0);
    if (reduceMotion) {
      element.textContent = formatCurrency(target);
      return;
    }

    const start = performance.now();
    const duration = 650;
    const update = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = formatCurrency(target * eased);
      if (progress < 1) window.requestAnimationFrame(update);
    };
    window.requestAnimationFrame(update);
  });
}

function getDashboardStats() {
  const expenses = state.data.expenses;
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const balances = getUserBalanceSummary();
  return {
    totalExpenses,
    youOwe: balances.owe,
    youReceive: balances.receive,
    groupExpenses: totalExpenses,
    expenseCount: expenses.length
  };
}

function renderRecentExpenses() {
  const recent = [...state.data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const html = recent.length
    ? recent
        .map(
          (expense) => `
            <button type="button" class="list-item recent-expense-item" data-expense-id="${escapeHTML(expense.id)}">
              <div class="list-item-main">
                <h4>${escapeHTML(expense.title)}</h4>
                <p>${escapeHTML(expense.category)} • ${escapeHTML(expense.paidBy)}</p>
              </div>
              <div style="text-align:right;">
                <div class="amount-badge">${formatCurrency(expense.amount)}</div>
                <p>${formatDateDisplay(expense.date)}</p>
              </div>
            </button>
          `
        )
        .join('')
    : `<div class="empty-state">No recent expenses yet. Add your first hostel cost.</div>`;

  document.getElementById('recentExpensesList').innerHTML = html;
}

function renderUpcomingSettlements() {
  const entries = getUserSettlementEntries();
  const list = entries.slice(0, 4);

  const html = list.length
    ? list
        .map(
          (entry) => `
            <div class="list-item">
              <div class="list-item-main">
                <h4>${entry.direction === 'owe' ? 'You owe' : `${escapeHTML(entry.person)} owes you`}</h4>
                <p>${escapeHTML(entry.person)}</p>
              </div>
              <div style="text-align:right;">
                <div class="amount-badge">${formatCurrency(entry.amount)}</div>
              </div>
            </div>
          `
        )
        .join('')
    : `<div class="empty-state">No pending settlements. All settled.</div>`;

  document.getElementById('upcomingSettlementsList').innerHTML = html;
}

function renderDashboardChart() {
  if (!window.Chart) return;
  const categories = CATEGORY_OPTIONS;
  const data = categories.map((category) => getCategoryTotal(category));

  const ctx = document.getElementById('dashboardChart');
  if (ctx) {
    if (state.chartInstances.dashboard) {
      state.chartInstances.dashboard.destroy();
    }

    state.chartInstances.dashboard = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Spending',
            data,
            backgroundColor: [
              '#2563eb',
              '#8b5cf6',
              '#10b981',
              '#f59e0b',
              '#ef4444',
              '#14b8a6',
              '#ec4899',
              '#84cc16',
              '#64748b'
            ],
            borderRadius: 10
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (value) => formatCurrencyShort(value) } }
        }
      }
    });
  }
}

function renderExpenses() {
  const search = document.getElementById('expenseSearch').value.toLowerCase();
  const selectedCategory = document.getElementById('expenseCategoryFilter').value;
  const selectedDate = document.getElementById('expenseDateFilter').value;
  const selectedPerson = document.getElementById('expensePersonFilter').value;
  const sortValue = document.getElementById('expenseSort').value;

  let filtered = [...state.data.expenses];

  if (search) {
    filtered = filtered.filter((expense) => {
      const haystack = `${expense.title} ${expense.category} ${expense.paidBy} ${(expense.splitBetween || []).join(' ')} ${expense.notes}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  if (selectedCategory !== 'all') {
    filtered = filtered.filter((expense) => expense.category === selectedCategory);
  }

  if (selectedDate) {
    filtered = filtered.filter((expense) => expense.date === selectedDate);
  }

  if (selectedPerson !== 'all') {
    filtered = filtered.filter(
      (expense) => expense.paidBy === selectedPerson || expense.splitBetween.includes(selectedPerson)
    );
  }

  filtered.sort((a, b) => {
    if (sortValue === 'highest') return Number(b.amount) - Number(a.amount);
    if (sortValue === 'lowest') return Number(a.amount) - Number(b.amount);
    if (sortValue === 'oldest') return new Date(a.date) - new Date(b.date);
    return new Date(b.date) - new Date(a.date);
  });

  const tbody = document.getElementById('expensesTableBody');

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">No expenses match your filters.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (expense) => `
        <tr class="${expense.id === state.pendingExpenseEntryId ? 'expense-enter' : ''}">
          <td>
            <strong>${escapeHTML(expense.title)}</strong>
          </td>
          <td>${escapeHTML(expense.category)}</td>
          <td>${formatCurrency(expense.amount)}</td>
          <td>${escapeHTML(expense.paidBy)}</td>
          <td>${formatDateDisplay(expense.date)}</td>
          <td>${(expense.splitBetween || []).map(escapeHTML).join(', ')}</td>
          <td>
            <div class="actions-group">
              <button class="action-btn" data-action="view-expense" data-id="${escapeHTML(expense.id)}">View</button>
              <button class="action-btn" data-action="edit-expense" data-id="${escapeHTML(expense.id)}">Edit</button>
              <button class="action-btn danger" data-action="delete-expense" data-id="${escapeHTML(expense.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');
  state.pendingExpenseEntryId = null;
}

function renderExpenseForm() {
  const form = document.getElementById('expenseForm');
  const select = form.querySelector('select[name="category"]');
  const paidBy = form.querySelector('select[name="paidBy"]');
  const splitBox = document.getElementById('splitCheckboxes');

  select.innerHTML = CATEGORY_OPTIONS.map((category) => `<option value="${category}">${category}</option>`).join('');
  paidBy.innerHTML = getParticipants()
    .map((person) => `<option value="${escapeHTML(person)}">${escapeHTML(person)}</option>`)
    .join('');

  const defaultSplit = getParticipants();
  splitBox.innerHTML = defaultSplit
    .map(
      (name) => `
        <label class="checkbox-pill">
          <input type="checkbox" name="splitBetween" value="${escapeHTML(name)}" checked />
          ${escapeHTML(name)}
        </label>
      `
    )
    .join('');

  if (!form.querySelector('input[name="date"]').value) {
    form.querySelector('input[name="date"]').value = formatDateForInput(new Date());
  }
}

function renderRoommates() {
  const list = document.getElementById('roommatesList');
  const search = document.getElementById('roommateSearch').value.trim().toLowerCase();
  const entries = state.data.roommates.filter((roommate) => `${roommate.name} ${roommate.email || ''}`.toLowerCase().includes(search));

  if (!state.data.roommates.length) {
    list.innerHTML = '<div class="empty-state">No roommates added yet.</div>';
    return;
  }
  if (!entries.length) {
    list.innerHTML = '<div class="empty-state">No roommates match your search.</div>';
    return;
  }
  list.innerHTML = entries
    .map((roommate) => {
      const balance = calculateRoommateBalance(roommate.name);
      const status = balance > 0 ? 'You owe' : balance < 0 ? 'Owes you' : 'Settled';
      const tone = balance > 0 ? 'owe' : balance < 0 ? 'receive' : 'settled';
      const absolute = Math.abs(balance);

      return `
        <div class="roommate-card">
          <div class="top">
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <div class="avatar">${escapeHTML(getInitials(roommate.name))}</div>
              <div>
                <strong>${escapeHTML(roommate.name)}</strong>
                <div class="muted">${escapeHTML(roommate.email || 'No email provided')}</div>
              </div>
            </div>
            <span class="status-pill ${tone}">${status}</span>
          </div>

          <div>
            <strong>${formatCurrency(absolute)}</strong>
            <div class="muted">${balance > 0 ? 'You owe' : balance < 0 ? 'Owes you' : 'Settled ✓'}</div>
          </div>

          <div class="actions-group">
            <button class="action-btn" data-action="edit-roommate" data-id="${escapeHTML(roommate.id)}">Edit</button>
            <button class="action-btn danger" data-action="delete-roommate" data-id="${escapeHTML(roommate.id)}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('[data-action="delete-roommate"]').forEach((button) => {
    button.addEventListener('click', () => deleteRoommate(button.dataset.id));
  });
  list.querySelectorAll('[data-action="edit-roommate"]').forEach((button) => {
    button.addEventListener('click', () => editRoommate(button.dataset.id));
  });
}

function renderSettlements() {
  const settlementEntries = getUserSettlementEntries();
  const summary = document.getElementById('settlementsSummary');

  summary.innerHTML = `
    <div class="summary-box">
      <h4>Money You Owe</h4>
      <strong class="negative">${formatCurrency(settlementEntries.filter((entry) => entry.direction === 'owe').reduce((sum, item) => sum + item.amount, 0))}</strong>
      <p>Total outstanding debt</p>
    </div>
    <div class="summary-box">
      <h4>Money Others Owe You</h4>
      <strong class="positive">${formatCurrency(settlementEntries.filter((entry) => entry.direction === 'receive').reduce((sum, item) => sum + item.amount, 0))}</strong>
      <p>Total awaiting collection</p>
    </div>
  `;

  const list = document.getElementById('settlementList');
  if (!settlementEntries.length) {
    list.innerHTML = '<div class="empty-state">✓ All Settled</div>';
  } else {
    list.innerHTML = settlementEntries
      .map(
        (entry) => `
          <div class="settlement-item">
            <div>
              <strong>${entry.direction === 'owe' ? `${escapeHTML(entry.person)} → You` : `You → ${escapeHTML(entry.person)}`}</strong>
              <p>${entry.direction === 'owe' ? 'Money you owe' : 'Money others owe you'}</p>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <div class="settlement-amount ${entry.direction === 'owe' ? 'negative' : 'positive'}">${formatCurrency(entry.amount)}</div>
              <button class="primary-btn" data-settlement-type="${entry.direction}" data-person="${escapeHTML(entry.person)}">
                ${entry.direction === 'owe' ? 'Mark as Paid' : 'Mark as Received'}
              </button>
            </div>
          </div>
        `
      )
      .join('');

    document.querySelectorAll('[data-settlement-type]').forEach((button) => {
      button.addEventListener('click', () => markSettlement(button.dataset.settlementType, button.dataset.person));
    });
  }

  renderSettlementHistory();
}

function renderSettlementHistory() {
  const history = [...(state.data.settlements || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const container = document.getElementById('settlementHistory');
  container.innerHTML = history.length
    ? history.map((item) => `
      <div class="settlement-item">
        <div>
          <strong>${item.type === 'paid' ? `Paid to ${escapeHTML(item.person)}` : `Received from ${escapeHTML(item.person)}`}</strong>
          <p>${formatDateDisplay(item.date)} · Settled</p>
        </div>
        <strong class="settlement-amount">${formatCurrency(item.amount)}</strong>
      </div>
    `).join('')
    : '<div class="empty-state">No settlements recorded yet.</div>';
}

function renderAnalytics() {
  const currentMonth = getCurrentMonthKey();
  const monthExpenses = state.data.expenses.filter((expense) => getMonthKey(expense.date) === currentMonth);
  const categoryData = CATEGORY_OPTIONS.map((category) => ({ label: category, total: getCategoryTotal(category, currentMonth) }));
  const filtered = categoryData.filter((entry) => entry.total > 0);

  const analyticsStats = document.getElementById('analyticsStats');
  const totalSpent = getMonthlyTotal(currentMonth);
  const averageDaily = totalSpent / Math.max(1, new Date().getDate());
  const highestCategory = filtered.reduce((max, item) => (item.total > max.total ? item : max), { label: 'None', total: 0 });
  const highestExpense = monthExpenses.reduce((max, expense) => (Number(expense.amount) > Number(max.amount) ? expense : max), { amount: 0, title: 'No expense' });

  analyticsStats.innerHTML = [
    { title: 'Total Monthly Spending', value: formatCurrency(totalSpent), icon: 'fa-solid fa-wallet', tone: 'positive' },
    { title: 'Average Daily Spending', value: formatCurrency(averageDaily), icon: 'fa-solid fa-calendar-days', tone: 'warning' },
    { title: 'Highest Spending Category', value: highestCategory.label === 'None' ? 'N/A' : highestCategory.label, icon: 'fa-solid fa-chart-column', tone: 'positive' },
    { title: 'Total Number of Expenses', value: String(monthExpenses.length), icon: 'fa-solid fa-list-ul', tone: 'secondary' },
    { title: 'Highest Single Expense', value: highestExpense.title === 'No expense' ? 'N/A' : formatCurrency(highestExpense.amount), icon: 'fa-solid fa-star', tone: 'warning' }
  ]
    .map(
      (item) => `
        <div class="stats-card">
          <div class="meta">
            <span>${item.title}</span>
            <span class="icon-box" style="background:${item.tone === 'warning' ? 'rgba(245,158,11,0.12)' : item.tone === 'secondary' ? 'rgba(148,163,184,0.12)' : 'rgba(37,99,235,0.12)'}; color:${item.tone === 'warning' ? '#d97706' : item.tone === 'secondary' ? '#64748b' : '#2563eb'};">
              <i class="${item.icon}"></i>
            </span>
          </div>
          <h4>${item.value}</h4>
        </div>
      `
    )
    .join('');

  renderCategoryChart(filtered);
  renderMonthlyChart();
  renderTrendChart();
}

function renderCategoryChart(filteredData) {
  if (!window.Chart) return;
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  if (state.chartInstances.categoryChart) state.chartInstances.categoryChart.destroy();

  state.chartInstances.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: filteredData.map((item) => item.label),
      datasets: [{
        data: filteredData.map((item) => item.total),
        backgroundColor: ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#84cc16', '#64748b']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderMonthlyChart() {
  if (!window.Chart) return;
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;

  const months = getLastSixMonths();
  const values = months.map((monthKey) => getMonthlyTotal(monthKey));

  if (state.chartInstances.monthlyChart) state.chartInstances.monthlyChart.destroy();

  state.chartInstances.monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map((month) => month.replace('-', ' ')),
      datasets: [{
        data: values,
        backgroundColor: '#60a5fa',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderTrendChart() {
  if (!window.Chart) return;
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const labels = getLastSevenDays();
  const values = labels.map((day) => getDailyTotal(day));

  if (state.chartInstances.trendChart) state.chartInstances.trendChart.destroy();

  state.chartInstances.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderMonthlyHistory() {
  const select = document.getElementById('historyMonthSelect');
  const selectedMonth = state.historyMonthKey || select.value || getCurrentMonthKey();
  const monthExpenses = state.data.expenses.filter((expense) => getMonthKey(expense.date) === selectedMonth);

  const stats = [
    { label: 'Total Expense', value: formatCurrency(monthExpenses.reduce((sum, item) => sum + Number(item.amount), 0)) },
    { label: 'Total Paid', value: formatCurrency(monthExpenses.filter((e) => e.paidBy === state.data.userProfile.name).reduce((sum, item) => sum + Number(item.amount), 0)) },
    { label: 'Total Owed', value: formatCurrency(monthExpenses.filter((e) => (e.splitBetween || []).includes(state.data.userProfile.name) && e.paidBy !== state.data.userProfile.name).reduce((sum, item) => sum + Number(item.amount / Math.max(1, item.splitBetween.length)), 0)) },
    { label: 'Total Received', value: formatCurrency(monthExpenses.filter((e) => e.paidBy === state.data.userProfile.name && (e.splitBetween || []).length > 1).reduce((sum, item) => sum + Number(item.amount / item.splitBetween.length) * (item.splitBetween.length - 1), 0)) },
    { label: 'Transactions', value: String(monthExpenses.length) }
  ];

  document.getElementById('historyStats').innerHTML = stats
    .map(
      (stat) => `
        <div class="stats-card">
          <div class="meta">
            <span>${stat.label}</span>
          </div>
          <h4>${stat.value}</h4>
        </div>
      `
    )
    .join('');

  const tbody = document.getElementById('historyTableBody');
  if (!monthExpenses.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No transactions for this month.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = monthExpenses
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(
      (expense) => `
        <tr>
          <td>${escapeHTML(expense.title)}</td>
          <td>${escapeHTML(expense.category)}</td>
          <td>${escapeHTML(expense.paidBy)}</td>
          <td>${formatCurrency(expense.amount)}</td>
          <td>${(expense.splitBetween || []).map(escapeHTML).join(', ')}</td>
          <td>${formatDateDisplay(expense.date)}</td>
        </tr>
      `
    )
    .join('');
}

function renderSettings() {
  const form = document.getElementById('settingsForm');
  form.querySelector('[name="userName"]').value = state.data.userProfile.name || 'Bhuwan Goyal';
  form.querySelector('[name="hostelName"]').value = state.data.userProfile.hostelName || 'Block C';
  form.querySelector('[name="currency"]').value = state.data.settings.currency || state.data.userProfile.currency || '₹';
  form.querySelector('[name="monthlyBudget"]').value = Number(state.data.settings.monthlyBudget) || 600;
  form.querySelector('[name="monthlyBudget"]').value = Number(state.data.settings.monthlyBudget) || 600;
  document.getElementById('darkModeToggle').checked = !!state.data.settings.darkMode;
  document.getElementById('notificationToggle').checked = !!state.data.settings.notifications;
}

function renderThemeControls() {
  const theme = state.data.settings.darkMode ? 'dark' : 'light';
  document.body.classList.toggle('dark', theme === 'dark');
  const icon = document.getElementById('themeToggle').querySelector('i');
  icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function populateFilterControls() {
  const categorySelect = document.getElementById('expenseCategoryFilter');
  const personSelect = document.getElementById('expensePersonFilter');

  categorySelect.innerHTML = ['<option value="all">All Categories</option>']
    .concat(CATEGORY_OPTIONS.map((category) => `<option value="${category}">${category}</option>`))
    .join('');

  personSelect.innerHTML = ['<option value="all">All Roommates</option>']
    .concat(getParticipants().map((person) => `<option value="${escapeHTML(person)}">${escapeHTML(person)}</option>`))
    .join('');
}

function populateHistorySelect() {
  const select = document.getElementById('historyMonthSelect');
  const months = getAvailableHistoryMonths();
  select.innerHTML = months.map((month) => `<option value="${month}">${formatMonthLabel(month)}</option>`).join('');
  if (!months.includes(state.historyMonthKey)) state.historyMonthKey = getCurrentMonthKey();
  select.value = state.historyMonthKey;
}

function handleAddExpense(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const title = String(form.get('title') || '').trim();
  const amount = Number(form.get('amount'));
  const category = String(form.get('category') || '').trim();
  const paidBy = String(form.get('paidBy') || '').trim();
  const date = String(form.get('date') || '').trim();
  const notes = String(form.get('notes') || '').trim();
  const splitBetween = [...document.querySelectorAll('input[name="splitBetween"]:checked')].map((item) => item.value);

  if (!title) return showToast('Expense title is required.');
  if (!Number.isFinite(amount) || amount <= 0) return showToast('Enter a valid amount greater than zero.');
  if (!CATEGORY_OPTIONS.includes(category)) return showToast('Please choose a valid category.');
  if (!getParticipants().includes(paidBy)) return showToast('Choose a valid payer.');
  if (!isValidDateInput(date)) return showToast('Choose a valid expense date.');
  const allowedPeople = new Set(getParticipants());
  const validSplit = [...new Set(splitBetween)].filter((person) => allowedPeople.has(person));
  if (!validSplit.length || validSplit.length !== splitBetween.length) return showToast('Select at least one valid roommate to split between.');

  const isEditing = Boolean(state.editingExpenseId);
  const expense = {
    id: state.editingExpenseId || crypto.randomUUID(),
    title,
    amount,
    category,
    paidBy,
    date,
    notes,
    splitBetween: validSplit
  };

  if (!isEditing) state.pendingExpenseEntryId = expense.id;
  updateData((data) => {
    if (isEditing) data.expenses = data.expenses.map((item) => item.id === expense.id ? expense : item);
    else data.expenses.unshift(expense);
    return data;
  });

  state.editingExpenseId = null;
  showToast(isEditing ? '✓ Expense updated successfully' : '✓ Expense added successfully');
  event.target.reset();
  resetExpenseForm();
  setActiveView('expenses');
}

function resetExpenseForm() {
  state.editingExpenseId = null;
  const form = document.getElementById('expenseForm');
  form.reset();
  form.querySelector('button[type="submit"]').textContent = 'Save Expense';
  form.querySelector('input[name="date"]').value = formatDateForInput(new Date());
  document.querySelectorAll('input[name="splitBetween"]').forEach((check) => {
    check.checked = true;
  });
}

function editExpense(id) {
  const expense = state.data.expenses.find((item) => item.id === id);
  if (!expense) return;
  state.editingExpenseId = id;
  setActiveView('add-expense');
  const form = document.getElementById('expenseForm');
  form.querySelector('[name="title"]').value = expense.title;
  form.querySelector('[name="amount"]').value = expense.amount;
  form.querySelector('[name="category"]').value = expense.category;
  form.querySelector('[name="paidBy"]').value = expense.paidBy;
  form.querySelector('[name="date"]').value = expense.date;
  form.querySelector('[name="notes"]').value = expense.notes || '';
  const split = new Set(expense.splitBetween || []);
  form.querySelectorAll('[name="splitBetween"]').forEach((input) => { input.checked = split.has(input.value); });
  form.querySelector('button[type="submit"]').textContent = 'Update Expense';
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && formatDateForInput(date) === value;
}

function handleAddRoommate(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const id = String(form.get('roommateId') || '').trim();
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim();

  if (!name) return showToast('Roommate name is required.');
  if (name === state.data.userProfile.name) return showToast('Roommate name must be different from your profile name.');

  const duplicate = state.data.roommates.some((roommate) => roommate.name.toLowerCase() === name.toLowerCase() && roommate.id !== id);
  if (duplicate) return showToast('A roommate with this name already exists.');

  if (id) {
    updateData((data) => {
      const index = data.roommates.findIndex((roommate) => roommate.id === id);
      if (index >= 0) {
        const oldName = data.roommates[index].name;
        data.roommates[index] = { ...data.roommates[index], name, email };
        data.expenses = data.expenses.map((expense) => {
          const newSplit = (expense.splitBetween || []).map((person) => person === oldName ? name : person);
          return { ...expense, splitBetween: [...new Set(newSplit)], paidBy: expense.paidBy === oldName ? name : expense.paidBy };
        });
        data.settlements = data.settlements.map((item) => item.person === oldName ? { ...item, person: name } : item);
      }
      return data;
    });
    showToast('✓ Roommate updated');
  } else {
    updateData((data) => {
      data.roommates.push({ id: crypto.randomUUID(), name, email });
      return data;
    });
    showToast('✓ Roommate added');
  }

  event.target.reset();
  resetRoommateForm();
}

function resetRoommateForm() {
  const form = document.getElementById('roommateForm');
  form.reset();
  form.querySelector('[name="roommateId"]').value = '';
  form.querySelector('button[type="submit"]').textContent = 'Save Roommate';
  form.closest('.panel').querySelector('h4').textContent = 'Add Roommate';
}

function editRoommate(id) {
  const roommate = state.data.roommates.find((item) => item.id === id);
  if (!roommate) return;

  const form = document.getElementById('roommateForm');
  form.querySelector('[name="roommateId"]').value = roommate.id;
  form.querySelector('[name="name"]').value = roommate.name;
  form.querySelector('[name="email"]').value = roommate.email || '';
  form.querySelector('button[type="submit"]').textContent = 'Update Roommate';
  form.closest('.panel').querySelector('h4').textContent = 'Edit Roommate';
}

function deleteRoommate(id) {
  const roommate = state.data.roommates.find((item) => item.id === id);
  if (!roommate) return;

  const confirmed = window.confirm(`Delete ${roommate.name} from the list?`);
  if (!confirmed) return;

  updateData((data) => {
    data.roommates = data.roommates.filter((item) => item.id !== id);
    return data;
  });

  showToast('✓ Roommate removed');
}

function handleSettingsSave(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const userName = String(form.get('userName') || '').trim();
  const hostelName = String(form.get('hostelName') || '').trim();
  const darkMode = document.getElementById('darkModeToggle').checked;
  const notifications = document.getElementById('notificationToggle').checked;
  const currency = String(form.get('currency') || '₹');
  const monthlyBudget = Number(form.get('monthlyBudget'));

  if (!userName || !hostelName) {
    showToast('Name and hostel details are required.');
    return;
  }
  if (!Number.isFinite(monthlyBudget) || monthlyBudget <= 0) return showToast('Monthly budget must be greater than zero.');
  if (state.data.roommates.some((roommate) => roommate.name.toLowerCase() === userName.toLowerCase())) {
    return showToast('Profile name must not match a roommate name.');
  }

  updateData((data) => {
    const oldName = data.userProfile.name;
    if (oldName !== userName) {
      data.expenses = data.expenses.map((expense) => ({
        ...expense,
        paidBy: expense.paidBy === oldName ? userName : expense.paidBy,
        splitBetween: (expense.splitBetween || []).map((person) => person === oldName ? userName : person)
      }));
      data.settlements = data.settlements.map((item) => item.person === oldName ? { ...item, person: userName } : item);
    }
    data.userProfile.name = userName;
    data.userProfile.hostelName = hostelName;
    data.userProfile.currency = currency;
    data.settings.currency = currency;
    data.settings.monthlyBudget = monthlyBudget;
    data.settings.darkMode = darkMode;
    data.settings.notifications = notifications;
    data.userProfile.darkMode = darkMode;
    data.userProfile.notifications = notifications;
    return data;
  });

  applyTheme(darkMode);
  showToast('✓ Settings saved');
}

function resetAllData() {
  const confirmed = window.confirm('This clears HostelMate profile, expenses, roommates, settlements, and settings. Continue?');
  if (!confirmed) return;

  deleteData();
  renderAll();
  showToast('✓ HostelMate data cleared');
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  downloadFile('hostelmate-data.json', blob);
  showToast('✓ Data exported');
}

function downloadFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

function exportMonthlyReport() {
  const month = state.historyMonthKey;
  const expenses = state.data.expenses.filter((expense) => getMonthKey(expense.date) === month);
  const rows = [
    ['Date', 'Title', 'Category', 'Amount', 'Paid By', 'Split Between', 'Notes'],
    ...expenses.map((expense) => [expense.date, expense.title, expense.category, expense.amount, expense.paidBy, expense.splitBetween.join(', '), expense.notes || ''])
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  downloadFile(`hostelmate-report-${month}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  showToast('✓ Monthly report exported');
}

function clearExpenseFilters() {
  document.getElementById('expenseSearch').value = '';
  document.getElementById('expenseCategoryFilter').value = 'all';
  document.getElementById('expenseDateFilter').value = '';
  document.getElementById('expensePersonFilter').value = 'all';
  document.getElementById('expenseSort').value = 'newest';
  renderExpenses();
}

function cancelExpenseForm() {
  resetExpenseForm();
  setActiveView('expenses');
}

function closeExpenseDetails() {
  const dialog = document.getElementById('expenseDetailsModal');
  if (dialog.open) dialog.close();
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const normalized = validateImportData(parsed);
      state.data = normalized;
      saveData(state.data);
      renderAll();
      showToast('✓ Data imported');
    } catch (error) {
      showToast(error instanceof SyntaxError ? 'Invalid JSON file. Please choose a valid HostelMate backup.' : error.message);
    }
  };
  reader.onerror = () => showToast('The selected backup could not be read. Please try another file.');
  reader.readAsText(file);
  event.target.value = '';
}

function validateImportData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Backup must contain a HostelMate data object.');
  if (!data.userProfile || !Array.isArray(data.roommates) || !Array.isArray(data.expenses) || !Array.isArray(data.settlements) || !data.settings) {
    throw new Error('Backup is missing required profile, settings, roommate, expense, or settlement data.');
  }
  if (!String(data.userProfile.name || '').trim() || !String(data.userProfile.hostelName || '').trim()) {
    throw new Error('Backup profile name and hostel details are required.');
  }
  const roommateIds = new Set();
  const roommateNames = new Set([String(data.userProfile.name).trim().toLowerCase()]);
  data.roommates.forEach((roommate) => {
    const name = String(roommate?.name || '').trim();
    const id = String(roommate?.id || '').trim();
    const email = String(roommate?.email || '').trim();
    if (!name || !id || roommateIds.has(id) || roommateNames.has(name.toLowerCase())
      || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new Error('Backup contains an invalid or duplicate roommate.');
    }
    roommateIds.add(id);
    roommateNames.add(name.toLowerCase());
  });
  const expenseIds = new Set();
  data.expenses.forEach((expense) => {
    const amount = Number(expense?.amount);
    if (!expense || !String(expense.id || '').trim() || expenseIds.has(expense.id)
      || !String(expense.title || '').trim() || !Number.isFinite(amount) || amount <= 0
      || !CATEGORY_OPTIONS.includes(expense.category) || !String(expense.paidBy || '').trim()
      || !isValidDateInput(expense.date) || !Array.isArray(expense.splitBetween)
      || new Set(expense.splitBetween).size !== expense.splitBetween.length
      || expense.splitBetween.some((person) => !String(person || '').trim())) {
      throw new Error('Backup contains an invalid or duplicate expense.');
    }
    expenseIds.add(expense.id);
  });
  const settlementIds = new Set();
  data.settlements.forEach((item) => {
    const id = String(item?.id || '').trim();
    if (!item || !id || settlementIds.has(id) || !['paid', 'received'].includes(item.type) || !String(item.person || '').trim()
      || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0 || !isValidDateInput(item.date)) {
      throw new Error('Backup contains an invalid settlement record.');
    }
    settlementIds.add(id);
  });
  const budget = Number(data.settings.monthlyBudget);
  if (data.userProfile.currency && !['₹', '$', '€'].includes(data.userProfile.currency)) {
    throw new Error('Backup currency is not supported.');
  }
  if (data.settings.currency && !['₹', '$', '€'].includes(data.settings.currency)) {
    throw new Error('Backup settings currency is not supported.');
  }
  if ((data.settings.darkMode !== undefined && typeof data.settings.darkMode !== 'boolean')
    || (data.settings.notifications !== undefined && typeof data.settings.notifications !== 'boolean')) {
    throw new Error('Backup settings contain invalid preference values.');
  }
  if (data.settings.monthlyBudget !== undefined && (!Number.isFinite(budget) || budget <= 0)) {
    throw new Error('Backup monthly budget must be greater than zero.');
  }
  return normalizeData(data);
}

function applyTheme(darkMode) {
  state.data.settings.darkMode = darkMode;
  document.body.classList.toggle('dark', darkMode);
  const icon = document.getElementById('themeToggle')?.querySelector('i');
  if (icon) {
    icon.className = darkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
  saveData(state.data);
}

function toggleTheme() {
  const nextValue = !state.data.settings.darkMode;
  applyTheme(nextValue);
  renderSettings();
}

function deleteExpense(id) {
  const expense = state.data.expenses.find((item) => item.id === id);
  if (!expense) return;

  const confirmed = window.confirm(`Delete ${expense.title}?`);
  if (!confirmed) return;

  const row = document.querySelector(`[data-action="delete-expense"][data-id="${CSS.escape(id)}"]`)?.closest('tr');
  if (!row || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    removeExpenseFromState(id);
    return;
  }

  row.classList.add('expense-leave');
  window.setTimeout(() => removeExpenseFromState(id), 220);
}

function removeExpenseFromState(id) {
  updateData((data) => {
    data.expenses = data.expenses.filter((item) => item.id !== id);
    return data;
  });
  showToast('✓ Expense deleted');
}

function showExpenseDetails(id) {
  const expense = state.data.expenses.find((item) => item.id === id);
  if (!expense) return;

  const people = [...new Set(expense.splitBetween || [])];
  const share = people.length ? Number(expense.amount) / people.length : Number(expense.amount);
  document.getElementById('expenseDetailsContent').innerHTML = `
    <dl class="detail-list">
      <div><dt>Category</dt><dd>${escapeHTML(expense.category)}</dd></div>
      <div><dt>Amount</dt><dd>${formatCurrency(expense.amount)}</dd></div>
      <div><dt>Paid by</dt><dd>${escapeHTML(expense.paidBy)}</dd></div>
      <div><dt>Date</dt><dd>${formatDateDisplay(expense.date)}</dd></div>
      <div><dt>Notes</dt><dd>${escapeHTML(expense.notes || 'No notes')}</dd></div>
      <div><dt>Split (${people.length || 1})</dt><dd>${people.map((person) => `${escapeHTML(person)}: ${formatCurrency(share)}`).join('<br>')}</dd></div>
    </dl>
  `;
  document.getElementById('expenseDetailsTitle').textContent = String(expense.title);
  document.getElementById('expenseDetailsModal').showModal();
}

function markSettlement(direction, person) {
  const entry = getUserSettlementEntries().find((item) => item.person === person && item.direction === direction);
  const amount = entry?.amount || 0;
  if (!amount) return;

  const record = {
    id: crypto.randomUUID(),
    type: direction === 'owe' ? 'paid' : 'received',
    person,
    amount,
    date: formatDateForInput(new Date()),
    status: 'settled'
  };

  updateData((data) => {
    data.settlements = Array.isArray(data.settlements) ? data.settlements : [];
    data.settlements.push(record);
    return data;
  });

  showToast(`✓ Settlement marked as ${direction === 'owe' ? 'paid' : 'received'}`);
}

function getUserBalanceSummary() {
  const entries = getUserSettlementEntries();
  const owe = entries.filter((entry) => entry.direction === 'owe').reduce((sum, item) => sum + item.amount, 0);
  const receive = entries.filter((entry) => entry.direction === 'receive').reduce((sum, item) => sum + item.amount, 0);
  return { owe, receive };
}

function calculateRoommateBalance(name) {
  const entry = getUserSettlementEntries().find((item) => item.person === name);
  if (!entry) return 0;
  return entry.direction === 'owe' ? entry.amount : -entry.amount;
}

function getUserSettlementEntries() {
  const user = state.data.userProfile.name;
  const map = new Map();

  state.data.expenses.forEach((expense) => {
    const people = [...new Set(Array.isArray(expense.splitBetween) && expense.splitBetween.length
      ? expense.splitBetween
      : [expense.paidBy])];
    if (expense.paidBy !== user && !people.includes(user)) return;
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !people.length) return;
    const share = amount / people.length;

    if (expense.paidBy !== user) {
      const key = expense.paidBy;
      if (key) {
        const entry = map.get(key) || { person: key, owe: 0, receive: 0 };
        entry.owe += share;
        map.set(key, entry);
      }
    }

    if (expense.paidBy === user) people.filter((person) => person !== user).forEach((person) => {
      const entry = map.get(person) || { person, owe: 0, receive: 0 };
      entry.receive += share;
      map.set(person, entry);
    });
  });

  (state.data.settlements || []).forEach((item) => {
    if (!item || !item.person) return;
    const entry = map.get(item.person);
    const amount = Number(item.amount);
    if (!entry || !Number.isFinite(amount) || amount <= 0) return;
    if (item.type === 'paid') entry.owe = Math.max(0, entry.owe - amount);
    if (item.type === 'received') entry.receive = Math.max(0, entry.receive - amount);
  });

  return [...map.values()].map((entry) => {
    const net = entry.receive - entry.owe;
    return { person: entry.person, direction: net >= 0 ? 'receive' : 'owe', amount: Math.abs(net) };
  }).filter((entry) => entry.amount > 0.005);
}

function getCategoryTotal(category, monthKey = null) {
  return state.data.expenses
    .filter((expense) => expense.category === category && (!monthKey || getMonthKey(expense.date) === monthKey))
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
}

function getUserMonthlySpend(monthKey) {
  const user = state.data.userProfile.name;
  return state.data.expenses.reduce((total, expense) => {
    const people = [...new Set(Array.isArray(expense.splitBetween) && expense.splitBetween.length
      ? expense.splitBetween
      : [expense.paidBy])];
    if (getMonthKey(expense.date) !== monthKey || !people.includes(user)) return total;
    return total + Number(expense.amount) / people.length;
  }, 0);
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `${state.data.userProfile.currency || '₹'}${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatCurrencyShort(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return `${Math.round(number)}`;
}

function formatDateDisplay(dateString) {
  if (!isValidDateInput(dateString)) return 'Invalid date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateForInput(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function showToast(message, duration = 2500) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const text = document.createElement('span');
  text.textContent = String(message);
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'toast-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  dismiss.addEventListener('click', () => toast.remove());
  toast.append(text, dismiss);
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function getParticipants() {
  return [...new Set([state.data.userProfile.name, ...state.data.roommates.map((roommate) => roommate.name)].filter(Boolean))];
}

function getToneBackground(tone) {
  if (tone === 'positive') return 'rgba(22,163,74,0.12)';
  if (tone === 'negative') return 'rgba(220,38,38,0.12)';
  return 'rgba(245,158,11,0.12)';
}

function getToneColor(tone) {
  if (tone === 'positive') return '#16a34a';
  if (tone === 'negative') return '#dc2626';
  return '#d97706';
}

function getLastSixMonths() {
  const months = [];
  const d = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function getCurrentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthKey(dateString) {
  const matchedMonth = String(dateString || '').match(/^(\d{4})-(\d{2})/);
  if (matchedMonth) return `${matchedMonth[1]}-${matchedMonth[2]}`;
  if (!isValidDateInput(dateString)) return 'Invalid date';
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getAvailableHistoryMonths() {
  const months = new Set(getLastSixMonths());
  state.data.expenses.forEach((expense) => {
    const month = getMonthKey(expense.date);
    if (month) months.add(month);
  });
  months.add(state.historyMonthKey);
  return [...months].sort();
}

function shiftHistoryMonth(offset) {
  const [year, month] = state.historyMonthKey.split('-').map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  state.historyMonthKey = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
  populateHistorySelect();
  renderMonthlyHistory();
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function countDaysInCurrentMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getLastSevenDays() {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(formatDateForInput(date));
  }
  return days;
}

function getDailyTotal(dateString) {
  return state.data.expenses
    .filter((expense) => expense.date === dateString)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
}

function getMonthlyTotal(monthKey) {
  return state.data.expenses
    .filter((expense) => getMonthKey(expense.date) === monthKey)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
}

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function subtractDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function renderCategoryOptions() {
  const selects = document.querySelectorAll('select[name="category"]');
  selects.forEach((select) => {
    select.innerHTML = CATEGORY_OPTIONS.map((category) => `<option value="${category}">${category}</option>`).join('');
  });
}

function renderRoommateOptions() {
  const selects = document.querySelectorAll('select[name="paidBy"]');
  selects.forEach((select) => {
    select.innerHTML = getParticipants()
      .map((person) => `<option value="${escapeHTML(person)}">${escapeHTML(person)}</option>`)
      .join('');
  });
}
