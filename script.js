(function () {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function initTheme() {
    const stored = localStorage.getItem('dvd.theme');
    if (stored === 'dark' || stored === 'light') {
      applyTheme(stored);
      return;
    }
    if (prefersDark && prefersDark.matches) {
      applyTheme('dark');
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('dvd.theme', next);
  }

  const state = {
    data: {
      // DVD collection data (kept for potential reuse)
      // collection: [],
      wantlist: []
    },
    // For the book site we only expose the Wishlist view.
    currentView: 'wantlist',
    pageSize: 100,
    currentPage: 1,
    searchQuery: ''
  };

  const statusEl = document.getElementById('status');
  const tablesContainer = document.getElementById('tables-container');
  const viewSelect = document.getElementById('view-select');
  const pageSizeSelect = document.getElementById('page-size');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');
  const lastUpdatedEl = document.getElementById('last-updated');
  const searchInput = document.getElementById('search');
  const countEl = document.getElementById('count');

  function setView(view) {
    // For books we always show the Wishlist; keep the old
    // collection/wantlist switching logic commented for reuse.

    // state.currentView = view === 'wantlist' ? 'wantlist' : 'collection';
    state.currentView = 'wantlist';
    state.currentPage = 1;

    if (viewSelect) {
      viewSelect.value = 'wantlist';
    }

    const desktopToggle = document.querySelectorAll('.view-toggle-button');
    desktopToggle.forEach((btn) => {
      const btnView = btn.getAttribute('data-view');
      btn.classList.toggle('is-active', btnView === 'wantlist');
    });

    try {
      // Kept for backward compatibility; value is now always 'wantlist'.
      localStorage.setItem('dvd.view', 'wantlist');
    } catch (e) {
      // ignore storage errors
    }

    render();
  }

  function initView() {
    // Force initial view to the Wishlist.
    state.currentView = 'wantlist';

    if (viewSelect) {
      viewSelect.value = 'wantlist';
    }

    const desktopToggle = document.querySelectorAll('.view-toggle-button');
    desktopToggle.forEach((btn) => {
      const btnView = btn.getAttribute('data-view');
      btn.classList.toggle('is-active', btnView === 'wantlist');
    });

    // Previous DVD implementation (kept for future reuse):
    // let initial = 'collection';
    // try {
    //   const stored = localStorage.getItem('dvd.view');
    //   if (stored === 'wantlist' || stored === 'collection') {
    //     initial = stored;
    //   }
    // } catch (e) {
    //   // ignore storage errors
    // }
    // state.currentView = initial;
    // if (viewSelect) {
    //   viewSelect.value = initial;
    // }
    // const desktopToggle = document.querySelectorAll('.view-toggle-button');
    // desktopToggle.forEach((btn) => {
    //   const btnView = btn.getAttribute('data-view');
    //   btn.classList.toggle('is-active', btnView === state.currentView);
    // });
  }

  function setupViewSwitch() {
    if (viewSelect) {
      viewSelect.addEventListener('change', () => {
        // Original DVD version allowed switching between collection and wantlist:
        // const next = viewSelect.value === 'wantlist' ? 'wantlist' : 'collection';
        const next = 'wantlist';
        setView(next);
      });
    }

    const desktopButtons = document.querySelectorAll('.view-toggle-button');
    desktopButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        // setView(view === 'wantlist' ? 'wantlist' : 'collection');
        setView('wantlist');
      });
    });
  }

  function initSiteSwitcher() {
    const switcher = document.querySelector('.site-switcher');
    if (!switcher) return;

    const toggle = switcher.querySelector('.site-title-toggle');
    const menu = switcher.querySelector('.site-menu');
    if (!toggle || !menu) return;

    function openMenu() {
      switcher.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      switcher.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    function toggleMenu() {
      if (switcher.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMenu();
    });

    toggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu();
      } else if (event.key === 'Escape') {
        closeMenu();
      }
    });

    document.addEventListener('click', (event) => {
      if (!switcher.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('error', !!isError);
  }

  async function loadData() {
    try {
      setStatus('Loading data…');
      // DVD version also loaded the collection here:
      // const [collectionRes, wantlistRes] = await Promise.all([
      //   fetch('collection.json', { cache: 'no-store' }),
      //   fetch('wantlist.json', { cache: 'no-store' })
      // ]);

      const wantlistRes = await fetch('wantlist.json', { cache: 'no-store' });

      if (!wantlistRes.ok) {
        setStatus('No data yet. Make sure wantlist.json exists.', true);
        return;
      }

      state.data.wantlist = await wantlistRes.json();
      if (!Array.isArray(state.data.wantlist)) {
        state.data.wantlist = [];
      }

      state.currentPage = 1;

      render();
      setStatus('');
    } catch (err) {
      console.error(err);
      setStatus('Error loading data. Please try again later.', true);
    }
  }

  function getCurrentDataset() {
    // For the book site we always work from the Wishlist data.
    const base = state.data.wantlist || [];
    const q = (state.searchQuery || '').trim().toLowerCase();

    if (!q) {
      if (countEl) {
        const n = base.length;
        const label = n === 1 ? 'livre' : 'livres';
        countEl.textContent = `${n} ${label}`;
      }
      return base;
    }

    const filtered = base.filter((item) => {
      const author = (item.author || '').toLowerCase();
      const title = (item.title || '').toLowerCase();
      const location = (item.location || '').toLowerCase();
      return author.includes(q) || title.includes(q) || location.includes(q);
    });

    if (countEl) {
      const n = filtered.length;
      const label = n === 1 ? 'livre' : 'livres';
      countEl.textContent = `${n} ${label} found`;
    }

    return filtered;
  }

  function getPageItems(dataset) {
    if (state.pageSize === 'all') {
      return dataset;
    }

    const size = Number(state.pageSize) || 100;
    if (size <= 0) {
      return dataset;
    }

    const start = (state.currentPage - 1) * size;
    const end = start + size;
    return dataset.slice(start, end);
  }

  function renderTables() {
    const dataset = getCurrentDataset();
    const totalItems = dataset.length;

    if (totalItems === 0) {
      tablesContainer.innerHTML = '<p class="placeholder">No matching items.</p>';
      pageInfo.textContent = 'Page 1 of 1';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      if (lastUpdatedEl) {
        lastUpdatedEl.textContent = '';
      }
      return;
    }

    const pageItems = getPageItems(dataset);

    const table = document.createElement('table');
    table.className = 'book-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Auteur', 'Titre', 'Format/Provenance'].forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    pageItems.forEach((item) => {
      const tr = document.createElement('tr');

      if (item.priority) {
        tr.classList.add('is-priority');
      }

      const authorTd = document.createElement('td');
      authorTd.textContent = item.author || '';
      tr.appendChild(authorTd);

      const titleTd = document.createElement('td');
      titleTd.textContent = item.title || '';
      tr.appendChild(titleTd);

      const locationTd = document.createElement('td');
      locationTd.textContent = item.location || '';
      tr.appendChild(locationTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tablesContainer.innerHTML = '';
    tablesContainer.appendChild(table);

    updatePaginationControls(totalItems);

    if (lastUpdatedEl) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      lastUpdatedEl.textContent = `Dernière synchronisation: ${formatter.format(now)}`;
    }
  }

  function updatePaginationControls(totalItems) {
    if (state.pageSize === 'all' || totalItems === 0) {
      pageInfo.textContent = 'Page 1 of 1';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    const size = Number(state.pageSize) || 100;
    const totalPages = Math.max(1, Math.ceil(totalItems / size));

    if (state.currentPage > totalPages) {
      state.currentPage = totalPages;
    }

    pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    prevBtn.disabled = state.currentPage <= 1;
    nextBtn.disabled = state.currentPage >= totalPages;
  }

  function render() {
    renderTables();
  }

  function onPageSizeChange(event) {
    const value = event.target.value;
    state.pageSize = value === 'all' ? 'all' : Number(value) || 100;
    state.currentPage = 1;
    render();
  }

  function onPrevPage() {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      render();
    }
  }

  function onNextPage() {
    const dataset = getCurrentDataset();
    const totalItems = dataset.length;
    const size = state.pageSize === 'all' ? totalItems : Number(state.pageSize) || 100;
    const totalPages = state.pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / size));

    if (state.currentPage < totalPages) {
      state.currentPage += 1;
      render();
    }
  }

  function initEventListeners() {
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', onPageSizeChange);
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', onPrevPage);
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', onNextPage);
    }
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        state.searchQuery = event.target.value || '';
        state.currentPage = 1;
        render();
      });
    }

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTheme);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initView();
    setupViewSwitch();
    initSiteSwitcher();
    initEventListeners();
    loadData();
  });
})();
