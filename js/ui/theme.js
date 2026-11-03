/* Light/dark toggle. js/theme-init.js applies the saved choice on load. */

export function initThemeToggle() {
  const root = document.documentElement;
  const button = document.querySelector('#theme-toggle');
  const isDark = () => root.getAttribute('data-bs-theme') === 'dark';

  // Mục menu ghi việc sẽ làm khi bấm, và đổi theo cả khi hệ điều hành đổi nền.
  const syncLabel = () => {
    button.querySelector('.icon').dataset.icon = isDark() ? 'light_mode' : 'dark_mode';
    button.querySelector('#theme-toggle-label').textContent = isDark() ? 'Nền sáng' : 'Nền tối';
  };
  new MutationObserver(syncLabel).observe(root, { attributes: true, attributeFilter: ['data-bs-theme'] });
  syncLabel();

  button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('a4v-theme', next);
    } catch { /* The toggle still works for this visit. */ }
  });
}
