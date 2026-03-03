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
      wantlist: [],
      lus: []
    },
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
  const topNoteSection = document.querySelector('.top-note');

  function normalizeProvenance(value) {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower === 'médiathèque' || lower === 'mediatheque') {
      return 'médiathèque';
    }
    return trimmed;
  }

  function setView(view) {
    const nextView = view === 'lus' ? 'lus' : 'wantlist';
    state.currentView = nextView;
    state.currentPage = 1;

    if (viewSelect) {
      viewSelect.value = nextView;
    }

    const desktopToggle = document.querySelectorAll('.view-toggle-button');
    desktopToggle.forEach((btn) => {
      const btnView = btn.getAttribute('data-view');
      btn.classList.toggle('is-active', btnView === state.currentView);
    });

    try {
      localStorage.setItem('dvd.view', state.currentView);
    } catch (e) {
      // ignore storage errors
    }

    updateTopNoteVisibility();

    render();
  }

  function initView() {
    let initial = 'wantlist';
    try {
      const stored = localStorage.getItem('dvd.view');
      if (stored === 'wantlist' || stored === 'lus') {
        initial = stored;
      }
    } catch (e) {
      // ignore storage errors
    }

    state.currentView = initial;

    if (viewSelect) {
      viewSelect.value = initial;
    }

    const desktopToggle = document.querySelectorAll('.view-toggle-button');
    desktopToggle.forEach((btn) => {
      const btnView = btn.getAttribute('data-view');
      btn.classList.toggle('is-active', btnView === state.currentView);
    });

    updateTopNoteVisibility();
  }

  function updateTopNoteVisibility() {
    if (!topNoteSection) return;
    if (state.currentView === 'lus') {
      topNoteSection.style.display = 'none';
    } else {
      topNoteSection.style.display = '';
    }
  }

  function setupViewSwitch() {
    if (viewSelect) {
      viewSelect.addEventListener('change', () => {
        const next = viewSelect.value === 'lus' ? 'lus' : 'wantlist';
        setView(next);
      });
    }

    const desktopButtons = document.querySelectorAll('.view-toggle-button');
    desktopButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        setView(view === 'lus' ? 'lus' : 'wantlist');
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
      const [wantlistRes, lusRes] = await Promise.all([
        fetch('wantlist.json', { cache: 'no-store' }),
        fetch('lus.json', { cache: 'no-store' })
      ]);

      if (!wantlistRes.ok && !lusRes.ok) {
        setStatus('No data yet. Make sure wantlist.json and lus.json exist.', true);
        return;
      }

      if (wantlistRes.ok) {
        state.data.wantlist = await wantlistRes.json();
      } else {
        state.data.wantlist = [];
      }

      if (lusRes.ok) {
        state.data.lus = await lusRes.json();
      } else {
        state.data.lus = [];
      }

      if (!Array.isArray(state.data.wantlist)) {
        state.data.wantlist = [];
      }
      if (!Array.isArray(state.data.lus)) {
        state.data.lus = [];
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
    const base =
      state.currentView === 'lus'
        ? state.data.lus || []
        : state.data.wantlist || [];
    const q = (state.searchQuery || '').trim().toLowerCase();

    if (!q) {
      if (countEl) {
        const n = base.length;
        let label;
        if (state.currentView === 'lus') {
          label = n === 1 ? 'livre lu' : 'livres lus';
        } else {
          label = n === 1 ? 'livre' : 'livres';
        }
        countEl.textContent = `${n} ${label}`;
      }
      return base;
    }

    const filtered = base.filter((item) => {
      const author = (item.author || '').toLowerCase();
      const title = (item.title || '').toLowerCase();
      const provenance = (item.provenance || item.location || '').toLowerCase();
      const format = (item.format || '').toLowerCase();
      return (
        author.includes(q) ||
        title.includes(q) ||
        provenance.includes(q) ||
        format.includes(q)
      );
    });

    if (countEl) {
      const n = filtered.length;
      let label;
      if (state.currentView === 'lus') {
        label = n === 1 ? 'livre lu' : 'livres lus';
      } else {
        label = n === 1 ? 'livre' : 'livres';
      }
      countEl.textContent = `${n} ${label} found`;
    }

    return filtered;
  }

  function getPageItems(dataset) {
    if (state.pageSize === 'all') {
      return dataset;
    }
    if (state.currentView === 'lus') {
      const size = Number(state.pageSize) || 100;
      if (size <= 0) {
        return dataset;
      }
      const start = (state.currentPage - 1) * size;
      const end = start + size;
      return dataset.slice(start, end);
    }

    const pages = buildProvenancePages(dataset);
    if (pages.length === 0) {
      return [];
    }

    const pageIndex = Math.max(0, Math.min(state.currentPage - 1, pages.length - 1));
    return pages[pageIndex];
  }

  function buildProvenancePages(dataset) {
    if (!dataset || dataset.length === 0) {
      return [];
    }

    const size = Number(state.pageSize) || 100;
    if (state.pageSize === 'all' || size <= 0) {
      return [dataset];
    }

    const byKey = new Map();
    const orderIndex = new Map();
    let idx = 0;

    dataset.forEach((item) => {
      const key = normalizeProvenance(item.provenance || '');
      if (!byKey.has(key)) {
        byKey.set(key, []);
        orderIndex.set(key, idx++);
      }
      byKey.get(key).push(item);
    });

    const emptyKey = '';
    const mediaKey = 'médiathèque';
    const allKeys = Array.from(byKey.keys());
    const otherKeys = allKeys.filter((k) => k !== emptyKey && k !== mediaKey);
    otherKeys.sort((a, b) => (orderIndex.get(a) || 0) - (orderIndex.get(b) || 0));

    const orderedKeys = [];
    if (byKey.has(emptyKey)) orderedKeys.push(emptyKey);
    orderedKeys.push(...otherKeys);
    if (byKey.has(mediaKey)) orderedKeys.push(mediaKey);

    const pages = [];
    let currentPageItems = [];
    let currentCount = 0;

    orderedKeys.forEach((key) => {
      const items = byKey.get(key) || [];
      const groupSize = items.length;

      if (currentPageItems.length === 0) {
        currentPageItems = items.slice();
        currentCount = groupSize;
        pages.push(currentPageItems);
        return;
      }

      if (currentCount + groupSize > size) {
        currentPageItems = items.slice();
        currentCount = groupSize;
        pages.push(currentPageItems);
      } else {
        currentPageItems = currentPageItems.concat(items);
        currentCount += groupSize;
        pages[pages.length - 1] = currentPageItems;
      }
    });

    return pages;
  }

  function groupByProvenance(items) {
    const byKey = new Map();
    const orderIndex = new Map();
    let idx = 0;

    items.forEach((item) => {
      const key = normalizeProvenance(item.provenance || '');
      if (!byKey.has(key)) {
        byKey.set(key, []);
        orderIndex.set(key, idx++);
      }
      byKey.get(key).push(item);
    });

    const emptyKey = '';
    const mediaKey = 'médiathèque';
    const allKeys = Array.from(byKey.keys());
    const otherKeys = allKeys.filter((k) => k !== emptyKey && k !== mediaKey);
    otherKeys.sort((a, b) => (orderIndex.get(a) || 0) - (orderIndex.get(b) || 0));

    const orderedKeys = [];
    if (byKey.has(emptyKey)) orderedKeys.push(emptyKey);
    orderedKeys.push(...otherKeys);
    if (byKey.has(mediaKey)) orderedKeys.push(mediaKey);

    return orderedKeys.map((key) => ({
      provenance: key,
      // No visible label for empty provenance groups.
      label: key || '',
      items: byKey.get(key) || []
    }));
  }

  function renderTables() {
    const dataset = getCurrentDataset();
    const totalItems = dataset.length;

    if (totalItems === 0) {
      tablesContainer.innerHTML = '<p class="placeholder">No matching items.</p>';
      pageInfo.textContent = 'Page 1 sur 1';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      if (lastUpdatedEl) {
        lastUpdatedEl.textContent = '';
      }
      return;
    }

    const pageItems = getPageItems(dataset);

    const containerFrag = document.createDocumentFragment();

    if (state.currentView === 'lus') {
      const table = document.createElement('table');
      table.className = 'book-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      ['Auteur', 'Titre'].forEach((col) => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      pageItems.forEach((item) => {
        const tr = document.createElement('tr');

        const authorTd = document.createElement('td');
        authorTd.textContent = item.author || '';
        tr.appendChild(authorTd);

        const titleTd = document.createElement('td');
        titleTd.textContent = item.title || '';
        tr.appendChild(titleTd);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      containerFrag.appendChild(table);
    } else {
      const groups = groupByProvenance(pageItems);

      groups.forEach((group) => {
        if (!group.items.length) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'provenance-wrapper';

        const section = document.createElement('section');
        section.className = 'provenance-section';

        if (group.label) {
          const heading = document.createElement('h2');
          heading.textContent = group.label;
          section.appendChild(heading);
        }

        const table = document.createElement('table');
        table.className = 'book-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Auteur', 'Titre', 'Format'].forEach((col) => {
          const th = document.createElement('th');
          th.textContent = col;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        group.items.forEach((item) => {
          const tr = document.createElement('tr');

          if (item.priority) {
            tr.classList.add('is-priority');
          }

          const authorTd = document.createElement('td');
          if (item.priority) {
            const starSpan = document.createElement('span');
            starSpan.className = 'priority-star';

            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');

            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', 'M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.4l1.1-6.5-4.7-4.6 6.5-.9L12 2.5z');

            svg.appendChild(path);
            starSpan.appendChild(svg);
            authorTd.appendChild(starSpan);
          }

          const authorText = document.createTextNode(item.author || '');
          authorTd.appendChild(authorText);
          tr.appendChild(authorTd);

          const titleTd = document.createElement('td');
          titleTd.textContent = item.title || '';
          tr.appendChild(titleTd);

          const formatTd = document.createElement('td');
          const formatValue = (item.format && String(item.format).trim()) || item.location || '';
          formatTd.textContent = formatValue;
          tr.appendChild(formatTd);

          tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        section.appendChild(table);
        wrapper.appendChild(section);
        containerFrag.appendChild(wrapper);
      });
    }

    tablesContainer.innerHTML = '';
    tablesContainer.appendChild(containerFrag);

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
      pageInfo.textContent = 'Page 1 sur 1';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    const dataset = getCurrentDataset();
    let totalPages;

    if (state.currentView === 'lus') {
      const size = Number(state.pageSize) || 100;
      totalPages = Math.max(1, Math.ceil(totalItems / size));
    } else {
      const pages = buildProvenancePages(dataset);
      totalPages = pages.length || 1;
    }

    if (state.currentPage > totalPages) {
      state.currentPage = totalPages;
    }

    pageInfo.textContent = `Page ${state.currentPage} sur ${totalPages}`;
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
    if (state.pageSize === 'all') {
      return;
    }

    let totalPages;
    if (state.currentView === 'lus') {
      const size = Number(state.pageSize) || 100;
      totalPages = Math.max(1, Math.ceil(totalItems / size));
    } else {
      const pages = buildProvenancePages(dataset);
      totalPages = pages.length || 1;
    }

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
