import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { root } from '../tools/build.mjs';
import { checkRelease } from '../tools/check-release.mjs';
import { startServer } from '../tools/preview.mjs';

await checkRelease();
const folder = path.join(root, '.release-tests'); await mkdir(folder, { recursive: true });
const { server, url } = await startServer();
const browser = await chromium.launch();
const results = [];
const seed = {
  exercises: [{ id: 'bench', name: '平板臥推', category: '胸' }, { id: 'push', name: '伏地挺身', category: '胸' }],
  entries: [{ id: 'legacy', dateKey: '2026-10-15', exerciseId: 'bench', exerciseName: '<舊臥推>', weight: 100, unit: 'lb', reps: 10, sets: 3, note: '<img src=x onerror=alert(1)>' }],
  presetVersionApplied: '2026-02-07-v2', recordMemo: '共用備忘錄保留', scheduleTimerElapsedSeconds: 123,
};
async function scenario(name, fn, initial = seed) {
  const context = await browser.newContext({ timezoneId: 'Asia/Taipei', locale: process.env.TEST_BROWSER_LOCALE || 'zh-TW' });
  const errors = []; context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  try {
    await context.addInitScript((data) => { if (location.protocol.startsWith('http') && !localStorage.getItem('product-seeded')) { localStorage.setItem('workoutCalendar.v1', JSON.stringify(data)); localStorage.setItem('product-seeded', '1'); } }, initial);
    const page = await context.newPage(); await page.clock.setFixedTime(new Date('2026-10-20T04:00:00Z'));
    await page.goto(url); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    // Scenarios start with a known exercise identity, not the locale-dependent first option.
    await page.selectOption('#exercise-select', 'bench');
    await fn(page, context); assert.deepEqual(errors, []);
    results.push({ name, passed: true }); console.log(`PASS ${name}`);
  } catch (error) { results.push({ name, passed: false, error: error.stack }); throw error; }
  finally { await context.close(); }
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')));
async function date(page, key) { await page.fill('#schedule-date-input', key); }
async function finish(page, key, weight) { await date(page, key); await page.fill('#entry-weight', String(weight)); await page.click('#complete-button'); }
try {
  await scenario('雙主題、系統同步、偏好保存、離線字型與資料隔離', async (page, context) => {
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.fonts.check('18px "Fusion Pixel"', '訓練深蹲重量')));
    const before = await stored(page);
    await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
    await page.selectOption('#theme-select', 'light');
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
    for (const mode of ['light', 'dark']) {
      await page.selectOption('#theme-select', mode);
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(folder, `theme-${mode}.png`), fullPage: true });
      await page.click('#tasks-tab');
      assert(await page.locator('#task-input').isVisible());
      await page.click('#record-tab');
    }
    await page.selectOption('#theme-select', 'system');
    await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
    await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
    await context.setOffline(true); await page.reload(); await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.fonts.check('18px "Fusion Pixel"')));
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
    assert.deepEqual(await stored(page), before);
  });
  await scenario('遷移備份、舊資料原樣只讀與安全文字顯示', async (page) => {
    const data = await stored(page); assert.deepEqual(data.entries, seed.entries); assert.equal(data.recordMemo, seed.recordMemo); assert.equal(data.scheduleTimerElapsedSeconds, 123);
    const backup = await page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.backup.beforeWeightV2'))); assert.deepEqual(backup, seed);
    await date(page, '2026-10-15'); assert(await page.locator('#legacy-section').isVisible());
    assert((await page.locator('#legacy-list').textContent()).includes(seed.entries[0].note)); assert.equal(await page.locator('#legacy-list img').count(), 0);
    assert.equal(await page.locator('#legacy-list input,#legacy-list button').count(), 0);
    assert.equal(await page.locator('#highest-weight').textContent(), '尚無紀錄');
  });
  await scenario('日期、同日最高、上次與歷史最高、補登與重整', async (page) => {
    await finish(page, '2026-10-03', 45); await finish(page, '2026-10-01', 40);
    await date(page, '2026-10-04'); assert.equal(await page.inputValue('#entry-weight'), '45'); assert.equal(await page.locator('#last-weight').textContent(), '45 kg');
    await finish(page, '2026-10-04', 42.5); await page.fill('#entry-weight', '35'); await page.click('#complete-button');
    assert.equal((await stored(page)).completedEntries.filter((r) => r.dateKey === '2026-10-04').length, 1);
    assert.equal(await page.locator('#current-weight').textContent(), '當天最高：42.5 kg'); assert.equal(await page.locator('#last-weight').textContent(), '45 kg');
    await date(page, '2026-10-05'); assert.equal(await page.locator('#last-weight').textContent(), '42.5 kg'); assert.equal(await page.locator('#highest-weight').textContent(), '45 kg');
    await date(page, '2026-10-02'); assert.equal(await page.locator('#last-weight').textContent(), '40 kg');
    await page.reload(); assert.equal((await stored(page)).completedEntries.length, 3);
  });
  await scenario('更正降低、取消及刪除重算、舊新版日曆顏色', async (page) => {
    await finish(page, '2026-10-14', 40); await finish(page, '2026-10-15', 45);
    await page.click('#completed-list button:text-is("更正")'); await page.fill('#correct-weight', '35'); await page.locator('#completed-list button:text-is("儲存")').click();
    assert.equal(await page.locator('#highest-weight').textContent(), '40 kg');
    await page.click('#completed-list button:text-is("刪除")'); await page.click('#completed-list button:text-is("取消")'); assert.equal((await stored(page)).completedEntries.length, 2);
    await page.click('#completed-list button:text-is("刪除")'); await page.click('#completed-list button:text-is("確認刪除")');
    assert(await page.locator('#calendar-days [data-date="2026-10-15"]').evaluate((e) => e.classList.contains('calendar__day--legacy')));
    await date(page, '2026-10-14'); await page.click('#completed-list button:text-is("刪除")'); await page.click('#completed-list button:text-is("確認刪除")');
    assert.equal(await page.locator('#highest-weight').textContent(), '尚無紀錄');
  });
  await scenario('0 kg、空白／負數／未來拒絕，不產生假成功', async (page) => {
    await page.selectOption('#exercise-select', 'push'); assert.equal(await page.inputValue('#entry-weight'), '');
    await page.click('#complete-button'); assert(await page.locator('#entry-error').isVisible()); assert.equal((await stored(page)).completedEntries.length, 0);
    await page.fill('#entry-weight', '-1'); await page.click('#complete-button'); assert.equal((await stored(page)).completedEntries.length, 0);
    await page.fill('#entry-weight', '0'); await page.click('#complete-button'); assert.equal((await stored(page)).completedEntries[0].weight, 0);
    await page.fill('#entry-weight', ''); await page.click('#complete-button'); assert(await page.locator('#completion-toast').isHidden());
    await date(page, '2026-10-21'); assert(await page.locator('#entry-error').isVisible()); assert.equal(await page.inputValue('#schedule-date-input'), '2026-10-20');
    await page.clock.setFixedTime(new Date('2026-10-19T04:00:00Z')); await page.fill('#entry-weight', '10'); await page.click('#complete-button');
    assert.equal((await stored(page)).completedEntries.length, 1); assert(await page.locator('#entry-error').isVisible());
  });
  await scenario('封存恢復及改名保持身份與歷史名稱', async (page) => {
    await finish(page, '2026-10-01', 40); await page.click('#tasks-tab');
    const task = page.locator('#task-list [data-id="bench"]'); await task.locator('button:text-is("改名")').click(); await page.fill('#task-edit-name', '新臥推'); await task.locator('button:text-is("儲存")').click();
    await task.locator('button:text-is("封存")').click(); assert.equal(await page.locator('#exercise-select option[value="bench"]').count(), 0);
    await page.locator('#archived-panel summary').click(); await page.locator('#archived-list [data-id="bench"] button').click();
    await page.click('#record-tab'); await page.selectOption('#exercise-select', 'bench'); await finish(page, '2026-10-02', 45);
    const data = await stored(page); assert.equal(data.completedEntries[0].exerciseName, '平板臥推'); assert.equal(data.completedEntries[1].exerciseName, '新臥推'); assert.equal(await page.locator('#highest-weight').textContent(), '45 kg');
  });
  await scenario('儲存失敗不改畫面或資料，不顯示完成', async (page) => {
    const before = await stored(page);
    await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'workoutCalendar.v1') throw new Error('測試 quota'); return original.call(this, key, value); }; });
    await page.fill('#entry-weight', '30'); await page.click('#complete-button');
    assert(await page.locator('#entry-error').isVisible()); assert(await page.locator('#completion-toast').isHidden()); assert.deepEqual(await stored(page), before);
  });
  await scenario('底部完成通知一秒、重複計時、無版面推動及窄螢幕', async (page) => {
    await page.clock.install({ time: new Date('2026-10-20T04:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-20T04:00:01Z'));
    await page.evaluate(() => document.fonts.ready);
    const documentY = () => page.locator('#completed-list').evaluate((e) => e.getBoundingClientRect().top + scrollY);
    const y = await documentY();
    await page.fill('#entry-weight', '30'); await page.click('#complete-button'); assert.equal(await page.locator('#completion-toast').textContent(), '已完成');
    assert.equal(await documentY(), y);
    await page.clock.fastForward(999); assert(await page.locator('#completion-toast').isVisible()); await page.clock.fastForward(1); assert(await page.locator('#completion-toast').isHidden());
    await page.click('#complete-button'); await page.clock.fastForward(600); await page.click('#complete-button'); await page.clock.fastForward(600); assert(await page.locator('#completion-toast').isVisible()); await page.clock.fastForward(400); assert(await page.locator('#completion-toast').isHidden());
    for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(folder, 'product-mobile.png'), fullPage: true });
    await page.click('#tasks-tab'); await page.screenshot({ path: path.join(folder, 'product-tasks.png'), fullPage: true });
  });
  await scenario('休息倒數暫停續跑、完成只處理一次', async (page) => {
    await page.evaluate(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    await page.clock.install({ time: new Date('2026-10-20T04:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-20T04:00:01Z'));
    await page.locator('#rest-panel summary').click(); await page.fill('#rest-timer-minutes', '0'); await page.fill('#rest-timer-seconds', '5'); await page.click('#rest-timer-start');
    await page.clock.fastForward(2000); await page.click('#rest-timer-pause'); assert.equal(await page.locator('#rest-timer-display').textContent(), '00:03');
    await page.clock.fastForward(4000); assert.equal(await page.locator('#rest-timer-display').textContent(), '00:03');
    await page.click('#rest-timer-reset'); assert.equal(await page.locator('#rest-timer-display').textContent(), '00:05');
    await page.click('#rest-timer-start'); await page.clock.fastForward(2000);
    await page.click('#rest-timer-reset'); assert.equal(await page.locator('#rest-timer-display').textContent(), '00:05');
    assert.equal((await stored(page)).restTimerRunning, false);
    await page.clock.fastForward(6000); assert.equal(await page.locator('#rest-timer-display').textContent(), '00:05');
    await page.reload(); await page.locator('#rest-panel summary').click();
    assert.equal(await page.locator('#rest-timer-display').textContent(), '00:05');
    await page.click('#rest-timer-start'); await page.clock.fastForward(2000); await page.click('#rest-timer-pause');
    await page.click('#rest-timer-start'); await page.clock.fastForward(3000); assert.equal((await stored(page)).restTimerRunning, false); assert.equal((await stored(page)).restTimerRemainingSeconds, 0);
    await page.click('#rest-timer-reset'); assert.equal(await page.locator('#rest-timer-display').textContent(), '00:05');
    await page.reload(); assert.equal((await stored(page)).restTimerRunning, false);
  });
} finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(folder, 'product-results.json'), JSON.stringify({ results, testedAt: new Date().toISOString() }, null, 2));
}
console.log(`All ${results.length} product scenarios passed.`);
