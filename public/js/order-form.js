document.addEventListener('DOMContentLoaded', function () {
  const colorPicker = document.getElementById('theme_color');
  const colorText = document.getElementById('theme_color_text');
  if (colorPicker && colorText) {
    colorPicker.addEventListener('input', function (e) {
      colorText.value = e.target.value;
    });
  }

  document.querySelectorAll('[data-flip-trigger]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const flip = btn.closest('[data-card-flip]');
      const inner = flip && flip.querySelector('[data-card-inner]');
      if (!inner) return;
      const flipped = inner.style.transform === 'rotateY(180deg)';
      inner.style.transform = flipped ? '' : 'rotateY(180deg)';
    });
  });

  document.querySelectorAll('[data-social-block]').forEach(function (block) {
    const toggle = block.querySelector('[data-social-toggle]');
    const details = block.querySelector('[data-social-details]');
    const usernameInput = block.querySelector('[data-social-username]');
    const photoInput = block.querySelector('[data-social-photo]');
    const modeInputs = block.querySelectorAll('[data-social-mode]');

    function syncMode() {
      const mode = block.querySelector('[data-social-mode]:checked');
      const isPhoto = mode && mode.value === 'photo';
      usernameInput.classList.toggle('hidden', isPhoto);
      photoInput.classList.toggle('hidden', !isPhoto);
    }

    function syncEnabled() {
      const on = toggle.checked;
      details.classList.toggle('hidden', !on);
      details.classList.toggle('flex', on);
      if (!on) {
        usernameInput.value = '';
        photoInput.value = '';
      }
    }

    toggle.addEventListener('change', syncEnabled);
    modeInputs.forEach(function (input) {
      input.addEventListener('change', syncMode);
    });

    syncEnabled();
    syncMode();
  });

  const customUploadBlock = document.querySelector('[data-custom-design-upload]');
  const customDesignInput = document.querySelector('[data-custom-design-input]');
  const physicalOptions = document.querySelectorAll('[data-physical-option]');

  function syncCustomDesignVisibility() {
    if (!customUploadBlock) return;
    const checked = document.querySelector('[data-physical-option]:checked');
    const isCustom = checked && checked.value === 'custom';
    customUploadBlock.classList.toggle('hidden', !isCustom);
    customUploadBlock.classList.toggle('flex', isCustom);
  }

  physicalOptions.forEach(function (input) {
    input.addEventListener('change', syncCustomDesignVisibility);
  });
  syncCustomDesignVisibility();

  const customDesignRadio = document.querySelector('[data-custom-design-radio]');
  if (customDesignInput && customDesignRadio) {
    customDesignInput.addEventListener('change', function () {
      const file = customDesignInput.files && customDesignInput.files[0];
      if (!file) return;
      const tile = customDesignRadio.closest('label').querySelector('[data-card-flip]');
      const img = tile && tile.querySelector('[data-custom-design-preview]');
      const placeholder = tile && tile.querySelector('[data-custom-design-placeholder]');
      if (img) {
        img.src = URL.createObjectURL(file);
        img.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    });
  }

  const nameInput = document.getElementById('name');
  const titleInput = document.getElementById('title');
  const previewNameEls = document.querySelectorAll('[data-preview-name]');
  const previewTitleEls = document.querySelectorAll('[data-preview-title]');

  function syncCardPreviewText() {
    const name = (nameInput && nameInput.value.trim()) || 'Votre nom';
    const title = (titleInput && titleInput.value.trim()) || 'Titre du poste';
    previewNameEls.forEach(function (el) { el.textContent = name; });
    previewTitleEls.forEach(function (el) { el.textContent = title; });
  }

  if (nameInput) nameInput.addEventListener('input', syncCardPreviewText);
  if (titleInput) titleInput.addEventListener('input', syncCardPreviewText);
  syncCardPreviewText();

  const form = document.getElementById('order_form');
  const previewFrame = document.getElementById('tpl-preview-frame');
  let refreshPreview = function () {};

  if (form && previewFrame) {
    function debounce(fn, ms) {
      let t;
      return function () {
        clearTimeout(t);
        t = setTimeout(fn, ms);
      };
    }

    refreshPreview = async function () {
      const params = new URLSearchParams(new FormData(form));
      const res = await fetch('/commander/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      if (!res.ok) return;
      previewFrame.srcdoc = await res.text();
    };

    const refreshSoon = debounce(refreshPreview, 280);

    form.addEventListener('change', function (e) {
      if (e.target.name === 'template' || e.target.type === 'color') refreshPreview();
    });
    form.addEventListener('input', function (e) {
      if (e.target.type === 'color') return;
      refreshSoon();
    });

    refreshPreview();
  }

  function validateStep1() {
    const name = document.getElementById('name');
    const phone = document.getElementById('contact_phone');
    if (name && !name.value.trim()) {
      alert('Merci de renseigner votre nom.');
      name.focus();
      return false;
    }
    if (phone && !phone.value.trim()) {
      alert('Merci de renseigner votre numéro WhatsApp.');
      phone.focus();
      return false;
    }
    return true;
  }

  const step1 = document.querySelector('[data-step="1"]');
  const step2 = document.querySelector('[data-step="2"]');
  const nextBtn = document.querySelector('[data-step-next]');
  const backBtn = document.querySelector('[data-step-back]');
  const stepLabel = document.querySelector('[data-step-label]');
  const stepDots = document.querySelectorAll('[data-step-dot]');

  function goToStep(n) {
    if (step1) step1.hidden = n !== 1;
    if (step2) step2.hidden = n !== 2;
    stepDots.forEach(function (dot) {
      const active = Number(dot.getAttribute('data-step-dot')) <= n;
      dot.classList.toggle('bg-primary', active);
      dot.classList.toggle('text-primary-foreground', active);
      dot.classList.toggle('bg-muted', !active);
      dot.classList.toggle('text-muted-foreground', !active);
    });
    if (stepLabel) {
      stepLabel.textContent = n === 1
        ? 'Étape 1 sur 2 — Vos informations'
        : 'Étape 2 sur 2 — Style web et design physique';
    }
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (n === 2) refreshPreview();
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      if (!validateStep1()) return;
      goToStep(2);
    });
  }
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      goToStep(1);
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      if (!validateStep1()) {
        e.preventDefault();
        goToStep(1);
      }
    });
  }
});
