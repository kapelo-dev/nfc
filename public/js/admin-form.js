document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('card_form');
  const frame = document.getElementById('tpl-preview-frame');
  const openLink = document.getElementById('preview-open');
  const colorPicker = document.getElementById('theme_color');
  const colorText = document.getElementById('theme_color_text');
  if (!form || !frame) return;

  function formParams() {
    const params = new URLSearchParams(new FormData(form));
    const existingPhoto = form.querySelector('[name="existing_photo_url"]');
    if (existingPhoto && existingPhoto.value) {
      params.set('photo_url', existingPhoto.value);
    }
    return params;
  }

  async function refreshPreview() {
    const params = formParams();
    if (openLink) openLink.href = '/admin/preview?' + params.toString();
    const res = await fetch('/admin/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    if (!res.ok) return;
    frame.srcdoc = await res.text();
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  const refreshSoon = debounce(refreshPreview, 280);

  if (colorPicker && colorText) {
    colorPicker.addEventListener('input', function (e) {
      colorText.value = e.target.value;
      refreshPreview();
    });
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'template' || e.target.type === 'color') refreshPreview();
  });
  form.addEventListener('input', function (e) {
    if (e.target.type === 'color' || e.target.name === 'template') return;
    refreshSoon();
  });

  refreshPreview();

  const nameInput = document.getElementById('name');
  const titleInput = document.getElementById('title');
  const previewNameEls = document.querySelectorAll('[data-preview-name]');
  const previewTitleEls = document.querySelectorAll('[data-preview-title]');

  function syncCardPreviewText() {
    const name = (nameInput && nameInput.value.trim()) || 'Votre nom';
    const title = titleInput ? titleInput.value.trim() : '';
    previewNameEls.forEach(function (el) { el.textContent = name; });
    previewTitleEls.forEach(function (el) {
      el.textContent = title;
      el.classList.toggle('hidden', !title);
    });
  }

  if (nameInput) nameInput.addEventListener('input', syncCardPreviewText);
  if (titleInput) titleInput.addEventListener('input', syncCardPreviewText);
  syncCardPreviewText();

  const photoInput = document.getElementById('photo');
  if (photoInput) {
    photoInput.addEventListener('change', function () {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      const img = document.querySelector('[data-profile-photo-preview]');
      const placeholder = document.querySelector('[data-profile-photo-placeholder]');
      if (img) {
        img.src = URL.createObjectURL(file);
        img.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    });
  }

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

  const customDesignBackInput = document.querySelector('[data-custom-design-back-input]');
  if (customDesignBackInput && customDesignRadio) {
    customDesignBackInput.addEventListener('change', function () {
      const file = customDesignBackInput.files && customDesignBackInput.files[0];
      if (!file) return;
      const tile = customDesignRadio.closest('label').querySelector('[data-card-flip]');
      const face = tile && tile.querySelector('[data-custom-design-back-preview]');
      if (face) {
        face.style.backgroundImage = 'url(' + URL.createObjectURL(file) + ')';
        face.style.backgroundSize = 'cover';
        face.style.backgroundPosition = 'center';
      }
    });
  }
});
