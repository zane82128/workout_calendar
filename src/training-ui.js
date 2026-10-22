import { exerciseOrder, exerciseLabel, saveSet, importSet } from './training.js';
import { dateKey } from './records.js';
import { allRecords } from './cardio.js';
import { renderExerciseGroups } from './exercise-groups.js';

export function startTraining({ getData, getDate, selectDate, transact, refresh, choose }) {
  const $ = id => document.getElementById(id);
  let editing = null, selected = [], dirty = false;
  const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
  const action = (text, handler) => { const b = el('button', text); b.type = 'button'; b.onclick = handler; return b; };
  const say = text => { $('set-status').textContent = text; };
  function clear() { editing = null; selected = []; dirty = false; $('set-name').value = ''; $('set-save').textContent = '儲存組合'; render(); }
  function renderChoices() {
    const active = getData().exercises.filter(e => !e.archived).sort(exerciseOrder);
    renderExerciseGroups($('set-choices'), active, { prefix: 'set-group', selected, renderRow: e => {
      const row = el('label'); const input = el('input'); input.type = 'checkbox'; input.value = e.id; input.checked = selected.includes(e.id);
      input.onchange = () => {
        dirty = true; selected = input.checked ? [...selected, e.id] : selected.filter(id => id !== e.id); renderSequence();
        const group = input.closest('.exercise-group');
        group.querySelector('.group-count').textContent = `${group.querySelectorAll('input').length} 個${group.querySelectorAll('input:checked').length ? ` · 已選 ${group.querySelectorAll('input:checked').length}` : ''}`;
      };
      row.append(input, el('span', e.name)); return row;
    } });
    renderSequence();
  }
  function renderSequence() {
    $('set-order').replaceChildren();
    selected.forEach((id, index) => {
      const e = getData().exercises.find(e => e.id === id);
      const row = el('div'); row.className = 'row set-order-row';
      row.append(el('span', `${index + 1}. ${e ? exerciseLabel(e) : '不存在的動作'}${e?.archived ? '（已封存）' : ''}`));
      const buttons = el('div'); buttons.className = 'links';
      const up = action('上移', () => { [selected[index - 1], selected[index]] = [selected[index], selected[index - 1]]; dirty = true; renderSequence(); }); up.disabled = index === 0;
      buttons.append(up, action('移除', () => { selected = selected.filter(value => value !== id); dirty = true; renderChoices(); }));
      row.append(buttons); $('set-order').append(row);
    });
  }
  function render() {
    const data = getData();
    renderChoices(); $('set-list').replaceChildren();
    for (const s of data.trainingSets || []) {
      const row = el('article'); row.className = 'task-item'; row.dataset.id = s.id;
      row.append(el('h2', s.name), el('p', s.exerciseIds.map(id => { const e = data.exercises.find(e => e.id === id); return e ? exerciseLabel(e) + (e.archived ? '（已封存）' : '') : '不存在的動作'; }).join(' → ')));
      const buttons = el('div'); buttons.className = 'links';
      buttons.append(action('編輯', () => { editing = s.id; selected = [...s.exerciseIds]; $('set-name').value = s.name; dirty = true; $('set-save').textContent = '儲存修改'; renderChoices(); $('set-name').focus(); }), action('刪除組合', () => {
        const confirm = el('div'); confirm.className = 'confirm-box';
        confirm.append(el('p', '只刪除組合，已加入的待做與完成紀錄會保留。'), action('取消', () => confirm.remove()), action('確認刪除', () => {
          if (transact(d => { d.trainingSets = (d.trainingSets || []).filter(set => set.id !== s.id); })) { if (editing === s.id) clear(); refresh(); }
        })); row.append(confirm);
      })); row.append(buttons); $('set-list').append(row);
    }
    if (!$('set-list').childElementCount) $('set-list').append(el('p', '尚無訓練組合'));
    const chosen = $('daily-set-select').value; $('daily-set-select').replaceChildren();
    for (const s of data.trainingSets || []) { const option = el('option', s.name); option.value = s.id; $('daily-set-select').append(option); }
    if ((data.trainingSets || []).some(s => s.id === chosen)) $('daily-set-select').value = chosen;
    $('daily-set-add').disabled = !(data.trainingSets || []).length;
    $('daily-set-select').disabled = !(data.trainingSets || []).length;
    $('daily-set-hint').hidden = Boolean((data.trainingSets || []).length);
    renderPending();
  }
  function renderPending() {
    const data = getData(), date = getDate();
    const items = (data.plannedExercises || []).filter(p => p.dateKey === date && !allRecords(data).some(r => r.dateKey === date && r.exerciseId === p.exerciseId));
    $('pending-list').replaceChildren(); $('pending-section').hidden = !items.length;
    for (const p of items) {
      const e = data.exercises.find(e => e.id === p.exerciseId);
      const row = el('div'); row.className = 'record-item'; row.dataset.id = p.exerciseId;
      row.append(el('span', `${p.category} · ${p.exerciseName}${!e || e.archived ? '（已封存，需先恢復）' : ''}`));
      const buttons = el('div'); buttons.className = 'links';
      const record = action('記錄', () => choose(p.exerciseId)); record.disabled = !e || Boolean(e.archived);
      buttons.append(record, action('移除待做', () => { if (transact(d => { d.plannedExercises = (d.plannedExercises || []).filter(item => item.dateKey !== date || item.exerciseId !== p.exerciseId); })) refresh(); }));
      row.append(buttons); $('pending-list').append(row);
    }
  }
  $('set-name').oninput = () => { dirty = true; say(''); };
  $('set-cancel').onclick = clear;
  $('set-form').onsubmit = event => {
    event.preventDefault();
    if (transact(d => saveSet(d, editing, $('set-name').value, selected))) { clear(); refresh(); say('已儲存組合'); }
  };
  $('daily-set-form').onsubmit = event => {
    event.preventDefault(); let result;
    const today = dateKey();
    if (transact(d => { result = importSet(d, $('daily-set-select').value, today, today); })) {
      if (getDate() !== today) selectDate(today);
      refresh(); $('daily-set-status').textContent = `已加入今天 ${result.added} 個待做動作${result.skipped ? `，略過 ${result.skipped} 個已封存或不存在的動作` : ''}；不重複加入已有動作。`;
    }
  };
  $('manage-exercises').onclick = () => show('exercises'); $('manage-sets').onclick = () => show('sets');
  function show(mode) { $('exercise-management').hidden = mode === 'sets'; $('set-management').hidden = mode !== 'sets'; $('manage-exercises').setAttribute('aria-pressed', String(mode !== 'sets')); $('manage-sets').setAttribute('aria-pressed', String(mode === 'sets')); }
  return { render, renderPending, dirty: () => dirty, snapshot: () => ({ editing, selected, name: $('set-name').value, mode: $('set-management').hidden ? 'exercises' : 'sets' }), restore: draft => {
    if (!draft) return; editing = draft.editing || null; selected = draft.selected || []; $('set-name').value = draft.name || ''; $('set-save').textContent = editing ? '儲存修改' : '儲存組合'; dirty = Boolean(editing || selected.length || draft.name); show(draft.mode); render();
  } };
}
