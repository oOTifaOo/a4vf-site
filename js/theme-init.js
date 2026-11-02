/* Runs before first paint so the page never flashes the wrong theme.
   Keeps Bootstrap's data-bs-theme in step with data-theme or the system setting. */
(function () {
  var root = document.documentElement;
  var darkQuery = matchMedia('(prefers-color-scheme: dark)');

  try {
    var saved = localStorage.getItem('a4v-theme');
    if (saved) root.dataset.theme = saved;
  } catch (error) { /* Storage can be blocked; the system theme still applies. */ }

  function sync() {
    root.setAttribute('data-bs-theme', root.dataset.theme || (darkQuery.matches ? 'dark' : 'light'));
  }

  sync();
  darkQuery.addEventListener('change', sync);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
