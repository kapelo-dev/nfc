document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    });
  });
});
