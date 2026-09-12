document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    const eventName = el.tagName === 'FORM' ? 'submit' : 'click';
    el.addEventListener(eventName, function (e) {
      if (!window.confirm(el.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    });
  });

  function setupBulkSelect(formId, selectAllAttr, selectAttr, countAttr, submitId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const selectAll = document.querySelector(selectAllAttr);
    const countEl = document.querySelector(countAttr);
    const submitBtn = document.getElementById(submitId);
    const checkboxes = () => Array.from(form.querySelectorAll(selectAttr));

    function update() {
      const checked = checkboxes().filter((cb) => cb.checked);
      if (countEl) countEl.textContent = checked.length + ' carte(s) sélectionnée(s)';
      if (submitBtn) submitBtn.disabled = checked.length === 0;
    }

    if (selectAll) {
      selectAll.addEventListener('change', function () {
        checkboxes().forEach((cb) => { cb.checked = selectAll.checked; });
        update();
      });
    }

    form.addEventListener('change', function (e) {
      if (e.target.matches(selectAttr)) update();
    });

    update();
  }

  setupBulkSelect('print_form', '[data-print-select-all]', '[data-print-select]', '[data-print-count]', 'print_submit');
  setupBulkSelect('fulfillment_form', '[data-fulfillment-select-all]', '[data-fulfillment-select]', '[data-fulfillment-count]', 'fulfillment_submit');

  const sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  const shell = document.querySelector('[data-sidebar-collapsed]');
  if (sidebarToggle && shell) {
    if (localStorage.getItem('sidebarCollapsed') === '1') {
      shell.setAttribute('data-sidebar-collapsed', 'true');
    }
    sidebarToggle.addEventListener('click', function (event) {
      // At desktop width the sidebar is a static column, not KTDrawer's mobile overlay —
      // stop the click from also reaching KTDrawer's delegated handler (which would add
      // an unwanted dark backdrop). Below the lg breakpoint, let it bubble so KTDrawer
      // still handles the real off-canvas drawer as before.
      if (window.innerWidth >= 1024) {
        event.stopPropagation();
        const collapsed = shell.getAttribute('data-sidebar-collapsed') === 'true';
        shell.setAttribute('data-sidebar-collapsed', collapsed ? 'false' : 'true');
        localStorage.setItem('sidebarCollapsed', collapsed ? '0' : '1');
      }
    });
  }

  // Delegated so it also works on content injected later (e.g. the card preview modal).
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-flip-trigger]');
    if (!btn) return;
    e.preventDefault();
    const flip = btn.closest('[data-card-flip]');
    const inner = flip && flip.querySelector('[data-card-inner]');
    if (!inner) return;
    const flipped = inner.style.transform === 'rotateY(180deg)';
    inner.style.transform = flipped ? '' : 'rotateY(180deg)';
  });

  document.querySelectorAll('[data-preview-trigger]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const cardId = btn.getAttribute('data-card-id');
      const cardName = btn.getAttribute('data-card-name') || '';
      const title = document.querySelector('[data-preview-modal-title]');
      const body = document.querySelector('[data-preview-modal-body]');
      if (title) title.textContent = cardName ? 'Carte — ' + cardName : 'Aperçu de la carte';
      if (!body) return;
      body.innerHTML = '<p class="text-sm text-secondary-foreground py-10">Chargement…</p>';
      try {
        const res = await fetch('/admin/cards/' + encodeURIComponent(cardId) + '/card-preview');
        if (!res.ok) throw new Error('request failed');
        body.innerHTML = await res.text();
      } catch (err) {
        body.innerHTML = '<p class="text-sm text-destructive py-10">Erreur lors du chargement de l\'aperçu.</p>';
      }
    });
  });
});
