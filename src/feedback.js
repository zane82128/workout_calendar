const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzUthj1wxAVg1qnSs_e2tg98J0B15vNAYK-Q8LEVUeRnRDZnqex_IzqfKaIz7pyxEEcrw/exec';
const KEY = 'workoutCalendar.feedbackDraft';
const VERSION = typeof __RELEASE_INFO__ === 'undefined' ? 'development' : __RELEASE_INFO__.releaseId;

export function startFeedback() {
  const title = document.getElementById('feedback-title');
  const body = document.getElementById('feedback-body');
  const form = document.getElementById('feedback-form');
  const status = document.getElementById('feedback-status');
  const submit = document.getElementById('feedback-send');
  let pending = null, busy = false, saved = true;
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (draft) {
      if (typeof draft.title !== 'string' || typeof draft.body !== 'string') throw Error('invalid');
      title.value = draft.title; body.value = draft.body;
      if (draft.pending && typeof draft.pending.id === 'string' && typeof draft.pending.version === 'string') pending = draft.pending;
    }
  } catch { status.textContent = '無法讀取回報草稿；請確認本分頁儲存空間可用。'; saved = false; }
  function persist() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ title: title.value, body: body.value, pending })); saved = true;
    } catch { saved = false; throw Error('無法暫存回報，請保留本頁文字後再試。'); }
  }
  for (const input of [title, body]) input.addEventListener('input', () => {
    status.textContent = '';
    try { persist(); } catch (error) { status.textContent = error.message; }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy) return;
    const text = { title: title.value.trim(), body: body.value.trim() };
    if (!text.title || !text.body || title.value.length > 80 || body.value.length > 2000) {
      status.textContent = '請填寫主旨（最多 80 字）與內容（最多 2000 字）。'; return;
    }
    if (!navigator.onLine) { status.textContent = '目前離線，內容已保留，連線後請再送出。'; return; }
    // Keep original version and ID when retrying an uncertain result across an App upgrade.
    if (!pending || pending.title !== text.title || pending.body !== text.body) {
      pending = { id: crypto.randomUUID(), ...text, version: VERSION };
    }
    try { persist(); } catch (error) { status.textContent = error.message; return; }
    busy = true; submit.disabled = true; title.readOnly = true; body.readOnly = true;
    status.textContent = '送出中…';
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        signal: AbortSignal.timeout(20000), body: JSON.stringify(pending),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.id !== pending.id) throw Error('unconfirmed');
      const id = pending.id;
      // Remove the stored pending request before clearing visible text.
      sessionStorage.removeItem(KEY);
      pending = null; title.value = ''; body.value = ''; saved = true;
      status.textContent = `已送出，謝謝你的回報。編號：${id}`;
    } catch {
      status.textContent = '尚無法確認送出，內容已保留。請稍後重試；相同內容會沿用編號，避免重複收件。';
    } finally { busy = false; submit.disabled = false; title.readOnly = false; body.readOnly = false; }
  });
  return { persist, canPrepare: () => !busy && saved };
}
