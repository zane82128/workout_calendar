// Draft wheels only change the visible month after confirmation.
export function startMonthPicker({ getMonth, apply }) {
  const $ = id => document.getElementById(id);
  const panel = $('calendar-month-picker'), heading = $('calendar-month');
  const wheels = [$('calendar-year-wheel'), $('calendar-month-wheel')];
  let draft = [];
  const selectedIndices = [-1, -1];
  const values = [Array.from({ length: 201 }, (_, i) => 1900 + i), Array.from({ length: 12 }, (_, i) => i + 1)];
  function selected(index) {
    const wheel = wheels[index];
    const item = Math.max(0, Math.min(values[index].length - 1, Math.round(wheel.scrollTop / 44)));
    draft[index] = values[index][item];
    if (selectedIndices[index] !== item) {
      wheel.children[selectedIndices[index]]?.setAttribute('aria-selected', 'false');
      wheel.children[item].setAttribute('aria-selected', 'true');
      wheel.setAttribute('aria-activedescendant', wheel.children[item].id);
      selectedIndices[index] = item;
    }
  }
  function position(index, value, behavior = 'auto') {
    wheels[index].scrollTo({ top: values[index].indexOf(value) * 44, behavior });
    if (behavior === 'auto') selected(index);
  }
  function close() {
    panel.hidden = true; $('calendar-date-grid').hidden = false;
    heading.setAttribute('aria-expanded', 'false');
  }
  wheels.forEach((wheel, index) => {
    wheel.tabIndex = 0;
    values[index].forEach(value => {
      const option = document.createElement('button');
      option.type = 'button'; option.tabIndex = -1;
      option.id = `wheel-${index}-${value}`; option.textContent = `${value}${index ? '月' : '年'}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.onclick = () => position(index, value, 'smooth');
      wheel.append(option);
    });
    // Let native scroll-snap settle touch inertia. A debounce scrollTo here can
    // interrupt a finger still on the wheel or an in-progress smooth scroll.
    wheel.addEventListener('scroll', () => selected(index), { passive: true });
    wheel.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const list = values[index], current = list.indexOf(draft[index]);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : Math.max(0, Math.min(list.length - 1, current + (event.key === 'ArrowUp' ? -1 : 1)));
      position(index, list[next]);
    });
  });
  heading.onclick = () => {
    if (!panel.hidden) { close(); return; }
    draft = getMonth().split('-').map(Number);
    // Clamp only the wheel draft; never change the selected record date here.
    if (!values[0].includes(draft[0])) draft[0] = Math.max(1900, Math.min(2100, draft[0]));
    panel.hidden = false; $('calendar-date-grid').hidden = true;
    heading.setAttribute('aria-expanded', 'true');
    wheels.forEach((_, i) => position(i, draft[i])); wheels[0].focus({ preventScroll: true });
  };
  $('calendar-month-cancel').onclick = () => { close(); heading.focus(); };
  $('calendar-month-confirm').onclick = () => {
    wheels.forEach((_, i) => selected(i));
    const month = `${draft[0]}-${String(draft[1]).padStart(2, '0')}`;
    close(); apply(month); heading.focus();
  };
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); heading.focus(); }
  });
  $('calendar-panel').addEventListener('toggle', () => { if (!$('calendar-panel').open) close(); });
  return { close };
}
