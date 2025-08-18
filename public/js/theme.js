const THEME_KEY = 'wos-theme';
const LIGHT = 'light';
const DARK = 'dark';

function applyTheme(theme) {
  document.body.classList.toggle(LIGHT, theme === LIGHT);
}

function initTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY) || DARK;
  applyTheme(storedTheme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const newTheme = document.body.classList.contains(LIGHT) ? DARK : LIGHT;
      applyTheme(newTheme);
      localStorage.setItem(THEME_KEY, newTheme);
    });
  }
}

document.addEventListener('DOMContentLoaded', initTheme);
