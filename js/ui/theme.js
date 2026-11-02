/* Light/dark toggle. js/theme-init.js applies the saved choice on load. */

export function initThemeToggle() {
  const root = document.documentElement;

  document.querySelector('#theme-toggle').addEventListener('click', () => {
    const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('a4v-theme', next);
    } catch { /* The toggle still works for this visit. */ }
  });
}
