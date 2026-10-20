// Appearance is independent of workout data and may fail without blocking recording.
const key = 'workoutCalendar.theme';
const select = document.getElementById('theme-select');
const status = document.getElementById('theme-status');
const system = matchMedia('(prefers-color-scheme: dark)');
let preference = 'system';
try { const saved = localStorage.getItem(key); if (['system', 'light', 'dark'].includes(saved)) preference = saved; } catch { /* Use system if storage is unavailable. */ }
function apply() {
  const mode = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]').content = mode === 'dark' ? '#171e29' : '#f5e7c9';
  select.value = preference;
}
select.addEventListener('change', () => {
  preference = select.value; apply();
  try { localStorage.setItem(key, preference); status.hidden = true; }
  catch { status.textContent = '外觀已切換，但無法記住設定。'; status.hidden = false; }
});
system.addEventListener('change', apply);
window.addEventListener('storage', (event) => {
  if (event.key !== key && event.key !== null) return;
  preference = ['light', 'dark'].includes(event.newValue) ? event.newValue : 'system'; apply();
});
apply();
