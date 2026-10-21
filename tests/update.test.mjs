import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildRelease, root, config, git, hash } from '../tools/build.mjs';
import { checkRelease } from '../tools/check-release.mjs';
import { startServer } from '../tools/preview.mjs';

const testRoot = path.join(root, '.release-tests');
await mkdir(testRoot, { recursive: true });
const candidate = await checkRelease();
const A = await buildRelease('2000.01.01.1', path.join(testRoot, 'a'));
const B = { output: path.join(root, 'dist'), info: candidate };
assert.notEqual(A.info.releaseId, candidate.releaseId, '候選版本不可使用測試專用 ID');
let serving = A.output;
let missingFile = '';
const { server, url } = await startServer({ directory: () => serving, missing: (name) => Boolean(missingFile) && name.endsWith(missingFile) });
const browser = await chromium.launch({ headless: true });
const contexts = [];
const results = [];

async function context() {
  const ctx = await browser.newContext({ serviceWorkers: 'allow', timezoneId: 'Asia/Taipei' });
  contexts.push(ctx);
  return ctx;
}
async function install(ctx, output = A.output) {
  serving = output;
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20000 });
  return page;
}
async function ready(page) {
  await page.locator('#update-panel').evaluate((e) => e.open = true);
  await page.locator('#check-update').click();
  await page.waitForFunction(() => !document.getElementById('apply-update').hidden, null, { timeout: 20000 });
}
async function version(page, id) {
  await page.waitForFunction((expected) => document.getElementById('app-version')?.textContent.includes(expected), id);
}
async function test(name, fn) {
  missingFile = '';
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); throw error; }
  finally { for (const ctx of contexts.splice(0)) await ctx.close(); }
}

try {
  await test('首次安裝、離線與外部快取保護', async () => {
    const ctx = await context();
    const page = await install(ctx, B.output);
    await version(page, candidate.releaseId);
    assert(await page.locator('#apply-update').isHidden());
    await page.locator('.app-update').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(testRoot, 'update-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.app-update').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(testRoot, 'update-mobile.png') });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => caches.open('another-app-cache'));
    await ctx.setOffline(true);
    await page.reload();
    await version(page, candidate.releaseId);
    await page.locator('#update-panel').evaluate((e) => e.open = true);
  await page.locator('#check-update').click();
    await page.waitForFunction(() => document.getElementById('update-status').textContent.includes('離線'));
    assert((await page.evaluate(() => caches.keys())).includes('another-app-cache'));
  });

  await test('A → B、稍後、輸入與日期／計時保留、無重整迴圈', async () => {
    const ctx = await context();
    const page = await install(ctx);
    await page.fill('#schedule-date-input', '2026-10-01');
    await page.locator('#schedule-date-input').dispatchEvent('change');
    await page.fill('#entry-weight', '42.5');
    await page.click('#complete-button');
    await page.fill('#entry-weight', '77.5');
    await page.locator('#feedback-panel').evaluate((e) => e.open = true);
    await page.fill('#feedback-title', '尚未送出的問題');
    await page.fill('#feedback-body', '更新後應保留這段回報草稿');
    await page.click('#tasks-tab'); await page.click('#manage-sets');
    await page.fill('#set-name', '升級保留的組合');
    await page.locator('#set-choices-panel').evaluate(e => e.open = true);
    await page.locator('#set-choices input').first().check(); await page.click('#set-save');
    await page.fill('#set-name', '未儲存的組合草稿');
    await page.locator('#set-choices input').first().check();
    await page.click('#record-tab');
    await page.locator('#daily-set-panel').evaluate(e => e.open = true); await page.click('#daily-set-add');
    await page.fill('#schedule-date-input', '2026-10-01');
    await page.fill('#entry-weight', '77.5');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')));
    serving = B.output;
    await ready(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(testRoot, 'update-ready-mobile.png') });
    await page.click('#defer-update');
    await version(page, A.info.releaseId);
    assert(await page.locator('#apply-update').isVisible());
    await page.click('#apply-update');
    await version(page, candidate.releaseId);
    assert.equal(await page.inputValue('#schedule-date-input'), '2026-10-01');
    assert.equal(await page.inputValue('#entry-weight'), '77.5');
    assert.equal(await page.inputValue('#feedback-title'), '尚未送出的問題');
    assert.equal(await page.inputValue('#feedback-body'), '更新後應保留這段回報草稿');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')));
    assert.deepEqual(after.entries, before.entries);
    assert.deepEqual(after.completedEntries, before.completedEntries);
    assert.deepEqual(after.exercises, before.exercises);
    assert.deepEqual(after.trainingSets, before.trainingSets);
    assert.deepEqual(after.plannedExercises, before.plannedExercises);
    assert.equal(await page.inputValue('#set-name'), '未儲存的組合草稿');
    assert.equal(await page.locator('#set-choices input:checked').count(), 1);
    assert.equal(after.scheduleSessionStartedAt, before.scheduleSessionStartedAt);
    await page.reload();
    await version(page, candidate.releaseId);
    assert(await page.locator('#apply-update').isHidden());
    await ctx.setOffline(true);
    await page.reload();
    await version(page, candidate.releaseId);
    await ctx.setOffline(false);
  });

  await test('缺少資源時保留 A，恢復後可重試', async () => {
    const ctx = await context();
    const page = await install(ctx);
    serving = B.output;
    missingFile = 'icons/calendar-icon.svg';
    await page.locator('#update-panel').evaluate((e) => e.open = true);
    await page.click('#check-update');
    await page.waitForFunction(() => document.getElementById('update-status').textContent.includes('失敗'), null, { timeout: 20000 });
    assert(await page.locator('#apply-update').isHidden());
    await page.reload();
    await version(page, A.info.releaseId);
    missingFile = '';
    await ready(page);
    await page.click('#apply-update');
    await version(page, candidate.releaseId);
  });

  await test('新動作與編輯中草稿保留', async () => {
    const ctx = await context();
    const page = await install(ctx);
    await page.click('#tasks-tab');
    await page.fill('#task-input', '尚未送出的動作');
    await page.locator('#task-list button:text-is("改名")').first().click();
    await page.fill('#task-edit-name', '尚未儲存的名稱');
    serving = B.output;
    await ready(page);
    await page.click('#apply-update');
    await version(page, candidate.releaseId);
    assert.equal(await page.inputValue('#task-input'), '尚未送出的動作');
    assert.equal(await page.inputValue('#task-edit-name'), '尚未儲存的名稱');
  });

  await test('運行中的休息計時跨更新保留，結束只處理一次', async () => {
    const ctx = await context();
    const page = await install(ctx);
    await page.locator('#rest-panel summary').click();
    await page.fill('#rest-timer-minutes', '0');
    await page.fill('#rest-timer-seconds', '3');
    await page.click('#rest-timer-start');
    const started = await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')).restTimerStartedAt);
    serving = B.output;
    await ready(page);
    await page.click('#apply-update');
    await version(page, candidate.releaseId);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')).restTimerStartedAt), started);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')).restTimerRunning === false);
    await page.reload();
    await version(page, candidate.releaseId);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')).restTimerRemainingSeconds), 0);
    assert(!await page.evaluate(() => document.getElementById('completion-toast').textContent.includes('休息結束')));
  });

  await test('自動檢查五分鐘節流，手動檢查可略過', async () => {
    const ctx = await context();
    const page = await install(ctx);
    await page.waitForFunction(() => !document.getElementById('check-update').disabled);
    let requests = 0;
    page.on('request', (request) => { if (request.url().endsWith('version.json')) requests++; });
    await page.evaluate(() => { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
    await page.locator('#update-panel').evaluate((e) => e.open = true);
    await page.click('#check-update');
    await page.waitForFunction(() => !document.getElementById('check-update').disabled);
    assert.equal(requests, 1);
  });

  await test('儲存失敗時不啟用新版、不重整', async () => {
    const ctx = await context();
    const page = await install(ctx);
    serving = B.output;
    await ready(page);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'workoutCalendar.v1') throw new DOMException('測試儲存失敗', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await page.click('#apply-update');
    await page.waitForFunction(() => document.getElementById('update-status').textContent.includes('無法套用'));
    await version(page, A.info.releaseId);
    assert(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)));
  });

  await test('多分頁草稿阻擋更新，關閉後可更新', async () => {
    const ctx = await context();
    const first = await install(ctx);
    const second = await ctx.newPage();
    await second.goto(url);
    await second.click('#tasks-tab');
    await second.fill('#task-input', '尚未新增的動作');
    serving = B.output;
    await ready(first);
    await first.click('#apply-update');
    await first.waitForFunction(() => document.getElementById('update-status').textContent.includes('關閉其他'));
    await version(first, A.info.releaseId);
    assert.equal(await second.inputValue('#task-input'), '尚未新增的動作');
    await second.close();
    await first.click('#apply-update');
    await version(first, candidate.releaseId);
  });

  await test('安全的多分頁協調更新', async () => {
    const ctx = await context();
    const first = await install(ctx);
    const second = await ctx.newPage();
    await second.goto(url);
    await second.click('#tasks-tab');
    await second.fill('#task-input', '另一分頁剛儲存的動作');
    await second.click('#task-form button[type="submit"]');
    serving = B.output;
    await ready(first);
    await first.click('#apply-update');
    await Promise.all([version(first, candidate.releaseId), version(second, candidate.releaseId)]);
    assert(await first.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')).exercises.some((item) => item.name === '另一分頁剛儲存的動作')));
  });

  await test('新 release ID 發布穩定程式，可從候選版回復', async () => {
    const ctx = await context();
    const page = await install(ctx, B.output);
    const rollback = await buildRelease('2000.01.01.3', path.join(testRoot, 'rollback'));
    serving = rollback.output;
    await ready(page);
    await page.click('#apply-update');
    await version(page, rollback.info.releaseId);
  });

  await test('舊四頁更新提示 → 新版遷移、草稿與日期還原', async () => {
    const oldDir = path.join(testRoot, 'four-page'), appDir = path.join(oldDir, 'src');
    await mkdir(appDir, { recursive: true });
    for (const name of ['index.html', 'main.js', 'styles.css', 'preset-exercises.js', 'update-manager.js', 'manifest.json', 'sw.js', 'icons/calendar-icon.svg']) {
      await mkdir(path.dirname(path.join(appDir, name)), { recursive: true });
      await writeFile(path.join(appDir, name), git('show', `571e6d3:src/${name}`));
    }
    const info = { releaseId: '1999.12.31.1', dataVersion: 1, commit: '571e6d3' };
    await build({ entryPoints: [path.join(appDir, 'main.js')], outdir: path.join(appDir, 'assets'), bundle: true, format: 'esm', define: { __RELEASE_INFO__: JSON.stringify(info) } });
    const html = (await readFile(path.join(appDir, 'index.html'), 'utf8')).replace(/main\.js(?:\?[^"']*)?/, 'assets/main.js');
    await writeFile(path.join(appDir, 'index.html'), html);
    const resources = [];
    for (const name of ['index.html', 'styles.css', 'manifest.json', 'icons/calendar-icon.svg', 'assets/main.js']) resources.push({ url: name, sha256: hash(await readFile(path.join(appDir, name))) });
    await writeFile(path.join(appDir, 'sw.js'), git('show', '571e6d3:src/sw.js').replace('/* RELEASE_CONFIG */ null', JSON.stringify({ ...info, resources })));
    await writeFile(path.join(appDir, 'version.json'), JSON.stringify(info));
    const ctx = await context(), page = await install(ctx, oldDir);
    await page.click('[data-page="schedule"].bottom-nav__item');
    await page.fill('#schedule-date-input', '2026-10-01');
    await page.fill('#record-settings-memo', '隱藏功能資料保留');
    await page.click('#schedule-form button[type="submit"]');
    await page.fill('[data-field="weight"]', '100');
    await page.selectOption('[data-field="unit"]', 'lb');
    await page.fill('[data-field="note"]', '舊版 note 保留');
    await page.click('[data-page="tasks"].bottom-nav__item');
    await page.fill('#task-input', '升級前未新增的動作');
    await page.locator('.task-item__edit').first().click();
    await page.fill('.task-item__edit-input', '升級前未儲存名稱');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')));
    serving = B.output;
    await page.click('#check-update');
    await page.waitForFunction(() => !document.getElementById('apply-update').hidden);
    await page.click('#apply-update');
    await version(page, candidate.releaseId);
    assert.equal(await page.inputValue('#task-input'), '升級前未新增的動作');
    assert.equal(await page.inputValue('#task-edit-name'), '升級前未儲存名稱');
    assert.equal(await page.inputValue('#schedule-date-input'), '2026-10-01');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')));
    assert.deepEqual(after.entries, before.entries); assert.equal(after.recordMemo, before.recordMemo);
    assert.deepEqual(after.completedEntries, []); assert.equal(after.schemaVersion, 2);
    await page.click('#record-tab');
    assert(await page.locator('#legacy-section').isVisible());
    assert.equal(await page.locator('#legacy-list input').count(), 0);
    assert.equal(await page.locator('#highest-weight').textContent(), '尚無紀錄');
  });

  await test('既有舊 worker → 首次新版，關閉舊視窗後接管', async () => {
    const legacyDir = path.join(testRoot, 'legacy');
    const legacyApp = path.join(legacyDir, 'src');
    await mkdir(legacyApp, { recursive: true });
    // Frozen fixture from the original repo commit, not the new implementation.
    const originalCommit = '6c89b5686d8c7c36702248976b0fa624bf7b175f';
    for (const name of ['index.html', 'main.js', 'styles.css', 'preset-exercises.js', 'manifest.json', 'sw.js', 'icons/calendar-icon.svg']) {
      await mkdir(path.dirname(path.join(legacyApp, name)), { recursive: true });
      await writeFile(path.join(legacyApp, name), git('show', `${originalCommit}:src/${name}`));
    }
    const ctx = await context();
    serving = legacyDir;
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 20000 });
    // The old worker does not claim clients, so it controls only the next navigation.
    await page.reload();
    await page.click('[data-page="schedule"].bottom-nav__item');
    await page.fill('#record-settings-memo', '舊用戶的備忘錄');
    await page.click('#schedule-form button[type="submit"]');
    await page.fill('[data-field="weight"]', '35');
    const originalData = await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')));
    serving = B.output;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting), null, { timeout: 20000 });
    await page.close();
    const next = await ctx.newPage();
    await next.goto(url);
    await version(next, candidate.releaseId);
    const updatedData = await next.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')));
    assert.deepEqual(updatedData.entries, originalData.entries);
    assert.deepEqual(updatedData.exercises, originalData.exercises);
    assert.equal(updatedData.recordMemo, originalData.recordMemo);
  });
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(testRoot, 'results.json'), JSON.stringify({ candidate, results, testedAt: new Date().toISOString(), platform: process.platform }, null, 2));
}
console.log(`All ${results.length} update scenarios passed.`);
