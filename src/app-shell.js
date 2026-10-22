export function startAppShell() {
  const panel = document.getElementById('settings-panel');
  const open = () => { if (!panel.open) panel.showModal(); };
  document.getElementById('open-settings').onclick = open;
  document.getElementById('close-settings').onclick = () => panel.close();
  document.getElementById('update-shortcut').onclick = () => { open(); document.getElementById('update-panel').open = true; };
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); panel.close(); } });
  const navigation = document.getElementById('app-navigation');
  const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--navigation-height', `${navigation.getBoundingClientRect().height}px`));
  observer.observe(navigation);
  return { open, isOpen: () => panel.open, freeze: value => { panel.inert = value; } };
}
