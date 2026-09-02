document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('form');
  const frame = document.getElementById('tpl-preview-frame');
  const openLink = document.getElementById('preview-open');
  const colorPicker = document.getElementById('theme_color');
  const colorText = document.getElementById('theme_color_text');
  if (!form || !frame) return;

  function formParams() {
    return new URLSearchParams(new FormData(form));
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
});
