/* ===========================================================
   IXRI Lab — Publications search & year filter
   - Tags each .pub-item with its year (from preceding header)
   - Search input filters by title / venue / authors (substring, case-insensitive)
   - Year chips filter by year (single-select; "All" resets)
   - Year sections with no visible items are hidden
   - Empty state appears when nothing matches
   =========================================================== */
(function () {
  'use strict';

  var doc = document;
  var container = doc.querySelector('.pub-container');
  var toolbar  = doc.querySelector('[data-pubs-toolbar]');
  if (!container || !toolbar) return;

  var input    = toolbar.querySelector('input[type="search"]');
  var chipBox  = toolbar.querySelector('[data-pubs-years]');
  var clearBtn = toolbar.querySelector('[data-pubs-clear]');

  /* --- Index pub items by year, build a flat list of haystacks --- */
  var headers = Array.prototype.slice.call(
    container.querySelectorAll('.pub-year-header')
  );
  var sections = []; // [{ year, header, list, items: [{el, hay, year}] }]
  headers.forEach(function (h) {
    var year = (h.textContent || '').trim();
    var list = h.nextElementSibling;
    while (list && list.tagName !== 'UL') list = list.nextElementSibling;
    if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll('.pub-item'))
      .map(function (el) {
        var title   = (el.querySelector('.pub-title-text') || {}).textContent || '';
        var venue   = (el.querySelector('.pub-venue')      || {}).textContent || '';
        var authors = (el.querySelector('.pub-authors')    || {}).textContent || '';
        el.setAttribute('data-year', year);
        return {
          el: el,
          year: year,
          hay: (title + ' ' + venue + ' ' + authors).toLowerCase(),
        };
      });
    sections.push({ year: year, header: h, list: list, items: items });
  });

  /* --- Build year chips ('All' + each year, newest first) --- */
  var years = sections.map(function (s) { return s.year; });
  if (chipBox && !chipBox.children.length) {
    var chipsHtml = '<button type="button" class="pub-chip is-active" data-year="all">All</button>';
    years.forEach(function (y) {
      chipsHtml += '<button type="button" class="pub-chip" data-year="' + y + '">' + y + '</button>';
    });
    chipBox.innerHTML = chipsHtml;
  }
  var chips = Array.prototype.slice.call(chipBox.querySelectorAll('.pub-chip'));

  /* --- Empty state --- */
  var empty = doc.createElement('div');
  empty.className = 'pub-empty';
  empty.hidden = true;
  empty.innerHTML = '<p>No publications match your search.</p>';
  container.appendChild(empty);

  /* --- State --- */
  var state = { q: '', year: 'all' };

  function apply() {
    var q = state.q.trim().toLowerCase();
    var sel = state.year;
    var totalShown = 0;
    sections.forEach(function (s) {
      var sectionMatches = sel === 'all' || sel === s.year;
      var sectionVisibleCount = 0;
      s.items.forEach(function (it) {
        var visible = sectionMatches && (q === '' || it.hay.indexOf(q) !== -1);
        it.el.hidden = !visible;
        if (visible) sectionVisibleCount++;
      });
      var sectionVisible = sectionMatches && sectionVisibleCount > 0;
      s.header.hidden = !sectionVisible;
      s.list.hidden = !sectionVisible;
      totalShown += sectionVisibleCount;
    });
    empty.hidden = totalShown > 0;
    // Toggle chip active states
    chips.forEach(function (c) {
      c.classList.toggle('is-active', c.getAttribute('data-year') === sel);
    });
    // Show/hide clear button
    if (clearBtn) clearBtn.hidden = (q === '' && sel === 'all');
  }

  /* --- Wire events --- */
  if (input) {
    var debounce = null;
    input.addEventListener('input', function () {
      clearTimeout(debounce);
      var v = input.value;
      debounce = setTimeout(function () {
        state.q = v;
        apply();
      }, 60);
    });
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      state.year = c.getAttribute('data-year') || 'all';
      apply();
      // Smooth-scroll to that year (or top if 'all')
      if (state.year !== 'all') {
        var target = sections.find(function (s) { return s.year === state.year; });
        if (target && typeof target.header.scrollIntoView === 'function') {
          target.header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      state.q = '';
      state.year = 'all';
      if (input) input.value = '';
      apply();
      if (input) input.focus();
    });
  }

  /* --- Keyboard: '/' focuses the search --- */
  doc.addEventListener('keydown', function (e) {
    if (e.key === '/' && doc.activeElement !== input &&
        !(doc.activeElement && /^(INPUT|TEXTAREA)$/.test(doc.activeElement.tagName))) {
      e.preventDefault();
      input && input.focus();
    }
    if (e.key === 'Escape' && doc.activeElement === input) {
      if (input.value) {
        input.value = '';
        state.q = '';
        apply();
      } else {
        input.blur();
      }
    }
  });

  // Initial render
  apply();
})();
