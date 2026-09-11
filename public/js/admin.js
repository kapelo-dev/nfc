document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    const eventName = el.tagName === 'FORM' ? 'submit' : 'click';
    el.addEventListener(eventName, function (e) {
      if (!window.confirm(el.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    });
  });

  const printForm = document.getElementById('print_form');
  const selectAll = document.querySelector('[data-print-select-all]');
  const printCount = document.querySelector('[data-print-count]');
  const printSubmit = document.getElementById('print_submit');

  if (printForm) {
    const checkboxes = () => Array.from(printForm.querySelectorAll('[data-print-select]'));

    function updatePrintUi() {
      const checked = checkboxes().filter((cb) => cb.checked);
      if (printCount) printCount.textContent = checked.length + ' carte(s) sélectionnée(s)';
      if (printSubmit) printSubmit.disabled = checked.length === 0;
    }

    if (selectAll) {
      selectAll.addEventListener('change', function () {
        checkboxes().forEach((cb) => { cb.checked = selectAll.checked; });
        updatePrintUi();
      });
    }

    printForm.addEventListener('change', function (e) {
      if (e.target.matches('[data-print-select]')) updatePrintUi();
    });

    updatePrintUi();
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
