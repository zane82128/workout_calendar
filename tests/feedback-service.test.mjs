import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../services/feedback/Code.gs', import.meta.url), 'utf8');
function fixture() {
  const rows = [['回報編號', '接收時間 UTC', 'App 版本', '主旨', '內容']];
  const props = new Map([['FEEDBACK_SHEET_ID', 'private-test-sheet']]);
  let locked = false, fail = false;
  const sheet = {
    getLastRow: () => rows.length,
    getRange: (r, c, nr, nc) => ({ getValues: () => rows.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)) }),
    appendRow: row => { if (fail) throw Error('private error'); rows.push(row); },
  };
  const sandbox = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k), setProperty: (k, v) => props.set(k, v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => (locked = true), hasLock: () => locked, releaseLock: () => { locked = false; } }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  };
  vm.createContext(sandbox); vm.runInContext(code, sandbox);
  const payload = { id: '12345678-1234-4123-8123-123456789012', title: '問題', body: '內容', version: '2026.10.21.1' };
  return { rows, props, payload, post: value => sandbox.doPost({ postData: { contents: typeof value === 'string' ? value : JSON.stringify(value) } }), isLocked: () => locked, fail: () => { fail = true; } };
}
test('only acknowledge after saving, retries do not duplicate and changed payload conflicts', () => {
  const f = fixture(); assert.equal(f.post(f.payload).ok, true); assert.equal(f.rows.length, 2);
  assert.equal(f.post(f.payload).id, f.payload.id); assert.equal(f.rows.length, 2);
  assert.equal(f.post({ ...f.payload, body: 'changed' }).code, 'ID_CONFLICT'); assert.equal(f.isLocked(), false);
});
test('reject invalid, oversized and unexpected data without writing', () => {
  const f = fixture();
  for (const input of ['{', null, { ...f.payload, title: ' ' }, { ...f.payload, body: 'x'.repeat(2001) }, { ...f.payload, id: 'bad' }, { ...f.payload, contact: 'unexpected' }]) {
    assert.equal(f.post(input).ok, false); assert.equal(f.rows.length, 1);
  }
});
test('formula-like content is stored as text', () => {
  const f = fixture(); assert.equal(f.post({ ...f.payload, title: '=IMPORTXML("x")', body: '+1' }).ok, true);
  assert.equal(f.rows[1][3], '\u200b=IMPORTXML("x")'); assert.equal(f.rows[1][4], '\u200b+1');
});
test('write failures and disabled configuration never return success or expose secrets', () => {
  const f = fixture(); f.fail(); const result = f.post(f.payload); assert.equal(result.ok, false);
  assert.equal(f.rows.length, 1); assert.equal(f.isLocked(), false); assert(!JSON.stringify(result).includes('private'));
  const g = fixture(); g.props.delete('FEEDBACK_SHEET_ID'); assert.equal(g.post(g.payload).ok, false);
});
test('daily cap rejects new reports but permits duplicate acknowledgements', () => {
  const f = fixture(); assert.equal(f.post(f.payload).ok, true);
  f.props.set('FEEDBACK_DAILY', JSON.stringify({ day: new Date().toISOString().slice(0, 10), count: 100 }));
  assert.equal(f.post(f.payload).ok, true);
  assert.equal(f.post({ ...f.payload, id: '22345678-1234-4123-8123-123456789012' }).code, 'LIMIT');
  assert.equal(f.rows.length, 2);
});
