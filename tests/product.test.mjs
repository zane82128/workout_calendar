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
    await selectExercise(page, 'bench');
    await fn(page, context); assert.deepEqual(errors, []);
    results.push({ name, passed: true }); console.log(`PASS ${name}`);
  } catch (error) { results.push({ name, passed: false, error: error.stack }); throw error; }
  finally { await context.close(); }
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('workoutCalendar.v1')));
async function selectExercise(page, id) {
  const label = await page.locator(`#exercise-select option[value="${id}"]`).textContent();
  await page.click('#open-exercise-picker'); await page.fill('#exercise-search', label.split(' · ').slice(1).join(' · '));
  await page.locator(`#exercise-picker-results [data-exercise-id="${id}"]`).click();
}
async function reveal(locator) { await locator.evaluate(e => { for (let p = e.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; }); }
async function openSettings(page) { if (!(await page.locator('#settings-panel').evaluate(e => e.open))) await page.click('#open-settings'); }
async function changeTheme(page, mode) { await openSettings(page); await page.selectOption('#theme-select', mode); await page.click('#close-settings'); }
async function date(page, key) { await page.fill('#schedule-date-input', key); }
async function finish(page, key, weight) { await date(page, key); await page.fill('#entry-weight', String(weight)); await page.click('#complete-button'); }
try {
  await scenario('分頁吸附、各頁位置還原、設定集中與回報草稿', async (page) => {
    await page.setViewportSize({ width: 390, height: 600 }); await page.evaluate(() => document.fonts.ready);
    await page.locator('#calendar-panel').evaluate(e => e.open = true);
    await page.locator('#rest-panel').evaluate(e => e.open = true);
    await page.evaluate(() => scrollTo(0, 210));
    assert(Math.abs((await page.locator('#app-navigation').boundingBox()).y) < 1);
    assert((await page.locator('header').boundingBox()).y < 0);
    const recordY = await page.evaluate(() => scrollY);
    await page.click('#tasks-tab'); assert.equal(await page.evaluate(() => scrollY), 0);
    await page.locator('#task-list details').evaluateAll(elements => elements.forEach(e => e.open = true));
    await page.locator('#add-exercise-panel').evaluate(e => e.open = true);
    await page.evaluate(() => scrollTo(0, 160)); const taskY = await page.evaluate(() => scrollY);
    await page.click('#record-tab'); assert(Math.abs(await page.evaluate(() => scrollY) - recordY) < 1);
    await page.click('#tasks-tab'); assert(Math.abs(await page.evaluate(() => scrollY) - taskY) < 1);
    await openSettings(page); assert(await page.locator('#theme-select').isVisible());
    await page.selectOption('#theme-select', 'dark');
    await page.locator('#feedback-panel > summary').click(); await page.fill('#feedback-title', '設定草稿'); await page.fill('#feedback-body', '關閉設定不應清空');
    await page.click('#close-settings'); assert(await page.locator('#feedback-panel').isHidden());
    await openSettings(page); assert.equal(await page.inputValue('#feedback-body'), '關閉設定不應清空');
    await page.keyboard.press('Escape'); assert(await page.locator('#settings-panel').isHidden());
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  });
  await scenario('單筆 kg/lb 輸入、切換不改數字、混合最高與原單位更正', async (page) => {
    await date(page, '2026-10-18'); await page.fill('#entry-weight', '20'); await page.selectOption('#entry-unit', 'lb');
    assert.equal(await page.inputValue('#entry-weight'), '20'); await page.click('#complete-button');
    let saved = (await stored(page)).completedEntries[0];
    assert.equal(saved.unit, 'kg'); assert.equal(saved.inputUnit, 'lb'); assert(Math.abs(saved.weight - 9.0718474) < 1e-10);
    assert((await page.locator('#completed-list').textContent()).includes('20 lb'));
    await page.selectOption('#entry-unit', 'kg'); assert.equal(await page.inputValue('#entry-weight'), '20');
    assert.equal(await page.locator('#highest-weight').textContent(), '9.07 kg');
    assert((await page.locator('#completed-list').textContent()).includes('20 lb'));
    await finish(page, '2026-10-19', 10); assert.equal(await page.locator('#highest-weight').textContent(), '10 kg');
    await page.selectOption('#entry-unit', 'lb'); assert.equal(await page.inputValue('#entry-weight'), '10');
    assert.equal(await page.locator('#highest-weight').textContent(), '22.05 lb');
    await date(page, '2026-10-18'); await page.locator('#completed-list button:text-is("更正")').click();
    assert.equal(await page.inputValue('#correct-unit'), 'lb'); assert.equal(await page.inputValue('#correct-weight'), '20');
    await page.fill('#correct-weight', '30'); await page.locator('#completed-list button:text-is("儲存")').click();
    assert.equal(await page.locator('#highest-weight').textContent(), '30 lb');
    await page.reload(); assert((await page.locator('#entry-unit').inputValue()) === 'kg');
    await date(page, '2026-10-18'); assert((await page.locator('#completed-list').textContent()).includes('30 lb'));
    await date(page, '2026-10-20');
    // Prefill shows rounded kg but completing it unchanged retains the source precision.
    await page.selectOption('#entry-unit', 'lb'); await date(page, '2026-10-19');
    assert.equal(await page.inputValue('#entry-weight'), '30');
    await page.click('#complete-button');
    saved = (await stored(page)).completedEntries.find(r => r.dateKey === '2026-10-19');
    assert(Math.abs(saved.weight - 13.6077711) < 1e-10);
  });
  await scenario('三處分類收合、搜尋取消不改重量、組合跨分類勾選保留', async (page) => {
    await page.fill('#entry-weight', '37.5');
    await page.click('#open-exercise-picker');
    assert(await page.locator('#exercise-picker').isVisible());
    assert(await page.locator('#exercise-picker-results details[data-category="胸"]').evaluate(e => e.open));
    await page.fill('#exercise-search', '引體');
    assert.equal(await page.locator('#exercise-picker-results .exercise-choice').count(), 1);
    assert.equal(await page.inputValue('#exercise-select'), 'bench');
    assert.equal(await page.inputValue('#entry-weight'), '37.5');
    await page.keyboard.press('Escape'); assert(await page.locator('#exercise-picker').isHidden());
    assert.equal(await page.inputValue('#entry-weight'), '37.5');
    await selectExercise(page, 'pull');
    assert((await page.locator('#selected-exercise').textContent()).includes('背 · 引體向上'));
    await page.click('#open-exercise-picker'); await page.fill('#exercise-search', '沒有這個動作');
    assert(await page.locator('#exercise-picker-empty').isVisible()); await page.click('#close-exercise-picker');
    await page.click('#tasks-tab');
    assert(await page.locator('#task-input').isHidden());
    assert.equal(await page.locator('#task-list > details[open]').count(), 0);
    const chest = page.locator('#task-list > details[data-category="胸"]');
    await chest.locator(':scope > summary').click();
    const task = chest.locator('[data-id="bench"]');
    assert.equal(await task.locator('.row > span').first().textContent(), '平板臥推');
    assert(await task.locator('button:text-is("改名")').isHidden());
    await task.locator('.exercise-actions > summary').click(); assert(await task.locator('button:text-is("改名")').isVisible());
    await page.locator('#add-exercise-panel > summary').focus(); await page.keyboard.press('Enter'); assert(await page.locator('#task-input').isVisible());
    await page.click('#manage-sets'); await page.fill('#set-name', '跨分類 TEST'); await page.locator('#set-choices-panel > summary').click();
    const setChest = page.locator('#set-choices details[data-category="胸"]'), setBack = page.locator('#set-choices details[data-category="背"]');
    assert.equal(await page.locator('#set-choices details[open]').count(), 0);
    await setChest.locator(':scope > summary').click(); await page.check('#set-choices input[value="bench"]');
    await setChest.locator(':scope > summary').click(); await setBack.locator(':scope > summary').click(); await page.check('#set-choices input[value="pull"]');
    await setChest.locator(':scope > summary').click(); assert(await page.isChecked('#set-choices input[value="bench"]'));
    assert((await setChest.locator(':scope > summary').textContent()).includes('已選 1'));
    await page.click('#set-save'); assert.deepEqual((await stored(page)).trainingSets[0].exerciseIds, ['bench', 'pull']);
  }, { ...seed, exercises: [...seed.exercises, { id: 'pull', name: '引體向上', category: '背' }] });
  await scenario('分類筆畫排序、組合建立編輯、每日待做與完成分離', async (page) => {
    const labels = await page.locator('#exercise-select option').allTextContents();
    assert(labels.every(text => text.startsWith('胸 · ')));
    await page.click('#tasks-tab'); await page.click('#manage-sets');
    await page.fill('#set-name', '推日'); await page.locator('#set-choices-panel > summary').click();
    await reveal(page.locator('#set-choices input[value="bench"]')); await page.check('#set-choices input[value="bench"]'); await page.check('#set-choices input[value="push"]');
    await page.click('#set-save');
    assert.equal((await stored(page)).trainingSets.length, 1);
    await page.locator('#set-list button:text-is("編輯")').click();
    await page.fill('#set-name', '推日修改'); await page.locator('#set-order .set-order-row').nth(1).locator('button:text-is("上移")').click();
    await page.click('#set-save'); assert.deepEqual((await stored(page)).trainingSets[0].exerciseIds, ['push', 'bench']);
    await page.click('#record-tab'); await page.locator('#daily-set-panel summary').click();
    await page.click('#daily-set-add'); await page.click('#daily-set-add');
    assert.equal((await stored(page)).plannedExercises.length, 2); assert.equal((await stored(page)).completedEntries.length, 0);
    assert.equal(await page.locator('#pending-list .record-item').count(), 2);
    await page.locator('#pending-list [data-id="bench"] button:text-is("記錄")').click();
    await page.fill('#entry-weight', '40'); await page.click('#complete-button');
    assert.equal(await page.locator('#pending-list .record-item').count(), 1); assert.equal((await stored(page)).completedEntries.length, 1);
    await page.reload(); assert.equal(await page.locator('#pending-list .record-item').count(), 1);
    await page.locator('#pending-list button:text-is("移除待做")').click();
    assert.equal((await stored(page)).completedEntries.length, 1);
    await page.click('#tasks-tab'); await reveal(page.locator('#task-list [data-id="push"] button:text-is("封存")')); await page.locator('#task-list [data-id="push"] button:text-is("封存")').click();
    await page.click('#record-tab'); await page.locator('#daily-set-panel summary').click(); await page.click('#daily-set-add');
    assert((await page.locator('#daily-set-status').textContent()).includes('略過 1'));
    await page.click('#tasks-tab'); await page.click('#manage-sets');
    await page.locator('#set-list button:text-is("刪除組合")').click(); await page.locator('#set-list button:text-is("確認刪除")').click();
    assert.equal((await stored(page)).trainingSets.length, 0); assert.equal((await stored(page)).completedEntries.length, 1);
  });
  await scenario('休息入口到期橘色十秒，開始與重置立即清除', async (page) => {
    await page.evaluate(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    await page.clock.install({ time: new Date('2026-10-20T04:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-20T04:00:01Z'));
    await page.locator('#rest-panel summary').click(); await page.fill('#rest-timer-minutes', '0'); await page.fill('#rest-timer-seconds', '2');
    await page.click('#rest-timer-start'); await page.locator('#rest-panel summary').click();
    await page.clock.fastForward(2000);
    const orange = () => page.locator('#rest-panel').evaluate(e => e.classList.contains('rest-finished'));
    assert(await orange()); assert.equal(await page.locator('#rest-summary-label').textContent(), '休息結束');
    await page.clock.fastForward(9999); assert(await orange()); await page.clock.fastForward(1); assert.equal(await orange(), false);
    await page.locator('#rest-panel summary').click(); await page.click('#rest-timer-start'); await page.clock.fastForward(2000); assert(await orange());
    await page.click('#rest-timer-reset'); assert.equal(await orange(), false);
    await page.click('#rest-timer-start'); await page.clock.fastForward(2000); assert(await orange());
    await page.click('#rest-timer-start'); assert.equal(await orange(), false);
  });
  await scenario('回報表單：驗證、離線草稿、失敗重試編號及成功確認', async (page, context) => {
    const before = await stored(page), requests = [];
    let mode = 'failure';
    await page.route('https://script.google.com/macros/s/**/exec', async (route) => {
      const payload = route.request().postDataJSON(); requests.push(payload);
      if (mode === 'failure') return route.abort('failed');
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, id: mode === 'wrong-id' ? 'wrong' : payload.id }) });
    });
    await openSettings(page); await page.locator('#feedback-panel summary').click();
    await page.click('#feedback-send'); assert.equal(requests.length, 0);
    await page.fill('#feedback-title', '測試主旨'); await page.fill('#feedback-body', '測試問題內容');
    await context.setOffline(true); await page.click('#feedback-send');
    assert((await page.locator('#feedback-status').textContent()).includes('離線')); assert.equal(requests.length, 0);
    await context.setOffline(false); await page.reload();
    await openSettings(page); await page.locator('#feedback-panel summary').click();
    assert.equal(await page.inputValue('#feedback-body'), '測試問題內容');
    await page.click('#feedback-send');
    await page.waitForFunction(() => document.getElementById('feedback-status').textContent.includes('尚無法確認'));
    assert.equal(await page.inputValue('#feedback-body'), '測試問題內容');
    const id = requests[0].id;
    await page.reload(); await openSettings(page); await page.locator('#feedback-panel summary').click();
    mode = 'wrong-id'; await page.click('#feedback-send');
    await page.waitForFunction(() => document.getElementById('feedback-status').textContent.includes('尚無法確認'));
    assert.equal(requests[1].id, id); assert.equal(await page.inputValue('#feedback-title'), '測試主旨');
    mode = 'success'; await page.click('#feedback-send');
    await page.waitForFunction(() => document.getElementById('feedback-status').textContent.startsWith('已送出'));
    assert.equal(requests[2].id, id); assert.equal(await page.inputValue('#feedback-body'), '');
    assert.deepEqual(Object.keys(requests[2]).sort(), ['body', 'id', 'title', 'version']);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('workoutCalendar.feedbackDraft')), null);
    assert.deepEqual(await stored(page), before);
  });
  await scenario('雙主題、系統同步、偏好保存、離線字型與資料隔離', async (page, context) => {
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.fonts.check('18px "Fusion Pixel"', '訓練深蹲重量')));
    const before = await stored(page);
    await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
    await changeTheme(page, 'light');
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
    for (const mode of ['light', 'dark']) {
      await changeTheme(page, mode);
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(folder, `theme-${mode}.png`), fullPage: true });
      await page.click('#tasks-tab');
      assert(await page.locator('#add-exercise-panel summary').isVisible());
      await page.click('#record-tab');
    }
    await changeTheme(page, 'system');
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
    assert.equal(await page.locator('#current-weight').count(), 0);
    assert((await page.locator('#completed-list').textContent()).includes('42.5 kg')); assert.equal(await page.locator('#last-weight').textContent(), '45 kg');
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
    await selectExercise(page, 'push'); assert.equal(await page.inputValue('#entry-weight'), '');
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
    const task = page.locator('#task-list [data-id="bench"]'); await reveal(task.locator('button:text-is("改名")')); await task.locator('button:text-is("改名")').click(); await page.fill('#task-edit-name', '新臥推'); await task.locator('button:text-is("儲存")').click();
    await reveal(task.locator('button:text-is("封存")')); await task.locator('button:text-is("封存")').click(); assert.equal(await page.locator('#exercise-select option[value="bench"]').count(), 0);
    await reveal(page.locator('#archived-list [data-id="bench"] button')); await page.locator('#archived-list [data-id="bench"] button').click();
    await page.click('#record-tab'); await selectExercise(page, 'bench'); await finish(page, '2026-10-02', 45);
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
  await scenario('有氧分鐘與次數分開保存比較、更正刪除、重整與舊重量保留', async page => {
    await selectExercise(page, 'run');
    assert.deepEqual(await page.locator('#entry-unit option').allTextContents(), ['分鐘', '下']);
    assert.equal(await page.locator('#highest-weight').textContent(), '尚無紀錄');
    await page.fill('#entry-weight','10.5'); await page.click('#complete-button');
    await page.selectOption('#entry-unit','reps'); await page.fill('#entry-weight','500'); await page.click('#complete-button');
    assert.equal((await stored(page)).cardioEntries.length,2);
    assert.equal((await stored(page)).completedEntries[0].weight,99);
    await page.fill('#entry-weight','2.5'); await page.click('#complete-button');
    assert.equal(await page.locator('#completion-toast').isVisible(),false);
    assert.match(await page.locator('#entry-error').textContent(),/正整數/);
    await page.fill('#entry-weight','0'); await page.click('#complete-button');
    assert.equal((await stored(page)).cardioEntries.length,2);
    await page.selectOption('#entry-unit','minutes'); await page.fill('#entry-weight','5'); await page.click('#complete-button');
    assert.equal(await page.locator('#highest-weight').textContent(),'10.5 分鐘');
    const minuteId=(await stored(page)).cardioEntries.find(r=>r.unit==='minutes').id;
    const row=page.locator(`#completed-list [data-id="${minuteId}"]`);
    await row.getByRole('button',{name:'更正',exact:true}).click();
    await page.fill('#correct-weight','3'); await row.getByRole('button',{name:'儲存',exact:true}).click();
    assert.equal(await page.locator('#highest-weight').textContent(),'3 分鐘');
    await page.reload(); await selectExercise(page,'run');
    assert.equal(await page.locator('#highest-weight').textContent(),'3 分鐘');
    await page.fill('#schedule-date-input','2026-10-19'); await page.locator('#schedule-date-input').dispatchEvent('change');
    await page.fill('#entry-weight','20'); await page.click('#complete-button');
    await reveal(page.locator('#go-today')); await page.click('#go-today');
    assert.equal(await page.locator('#last-weight').textContent(),'20 分鐘');
    await page.selectOption('#entry-unit','reps');
    assert.equal(await page.locator('#last-weight').textContent(),'尚無紀錄');
    assert.equal(await page.locator('#highest-weight').textContent(),'500 下');
    await page.evaluate(() => sessionStorage.setItem('workoutCalendar.updateSnapshot', JSON.stringify({ exerciseId:'run', selectedDate:'2026-10-20', weightDirty:true, fields:[{id:'entry-unit',value:'reps'},{id:'entry-weight',value:'600'}] })));
    await page.reload();
    assert.equal(await page.locator('#entry-unit').inputValue(),'reps');
    assert.equal(await page.locator('#entry-weight').inputValue(),'600');
    assert.equal(await page.locator('#highest-weight').textContent(),'500 下');
    await row.getByRole('button',{name:'刪除',exact:true}).click(); await row.getByRole('button',{name:'確認刪除',exact:true}).click();
    assert.equal((await stored(page)).cardioEntries.filter(r=>r.unit==='reps').length,1);
    await selectExercise(page,'bench'); assert.deepEqual(await page.locator('#entry-unit option').allTextContents(),['kg','lb']);
  }, { ...seed, exercises: [...seed.exercises,{id:'run',name:'跳繩',category:'有氧'}], completedEntries:[{id:'old-run',exerciseId:'run',exerciseName:'跳繩',exerciseCategory:'有氧',dateKey:'2026-10-20',weight:99,unit:'kg'}] });
} finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(folder, 'product-results.json'), JSON.stringify({ results, testedAt: new Date().toISOString() }, null, 2));
}
console.log(`All ${results.length} product scenarios passed.`);
