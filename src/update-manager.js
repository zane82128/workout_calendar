const INFO = typeof __RELEASE_INFO__ === 'undefined' ? { releaseId: 'development' } : __RELEASE_INFO__;
const AUTO_INTERVAL = 5 * 60 * 1000;
export const UPDATE_SNAPSHOT_KEY = 'workoutCalendar.updateSnapshot';

export function startUpdateManager({ save, snapshot, canPrepare, freeze }) {
  const version = document.getElementById('app-version');
  const status = document.getElementById('update-status');
  const checkButton = document.getElementById('check-update');
  const applyButton = document.getElementById('apply-update');
  const laterButton = document.getElementById('defer-update');
  const note = document.getElementById('update-note');
  version.textContent = `目前版本：${INFO.releaseId}`;
  version.title = INFO.commit || '';
  if (INFO.releaseId === 'development' || !('serviceWorker' in navigator)) {
    status.textContent = INFO.releaseId === 'development' ? '開發預覽：更新功能於建置版本啟用' : '此瀏覽器不支援離線更新';
    checkButton.disabled = true;
    return;
  }
  let registration;
  let checking = false;
  let applying = false;
  let lastCheck = 0;
  let reloadExpected = false;
  let reloaded = false;
  let freezeTimer;
  let deferredWorker;
  const say = (text) => { status.textContent = text; };

  function ready() {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return false;
    say('新版本已準備完成');
    applyButton.hidden = false;
    laterButton.hidden = deferredWorker === registration.waiting;
    note.hidden = deferredWorker === registration.waiting;
    document.querySelector('.app-update').classList.toggle('app-update--ready', deferredWorker !== registration.waiting);
    return true;
  }

  function cancelPreparation() {
    clearTimeout(freezeTimer);
    reloadExpected = false;
    freeze(false);
    sessionStorage.removeItem(UPDATE_SNAPSHOT_KEY);
  }

  navigator.serviceWorker.addEventListener('message', ({ data, ports, source }) => {
    if (data?.type === 'GET_RELEASE') {
      ports[0]?.postMessage({ releaseId: INFO.releaseId });
    } else if (data?.type === 'PREPARE_UPDATE') {
      // Only this registration's waiting worker may request a reload snapshot.
      if (!registration?.waiting || source?.scriptURL !== registration.waiting.scriptURL) return;
      try {
        if (!applying && !canPrepare()) throw new Error('其他分頁仍在使用中');
        sessionStorage.setItem(UPDATE_SNAPSHOT_KEY, JSON.stringify({ ...snapshot(), targetRelease: data.releaseId }));
        freeze(true);
        reloadExpected = true;
        freezeTimer = setTimeout(cancelPreparation, 10000);
        ports[0]?.postMessage({ ok: true });
      } catch {
        ports[0]?.postMessage({ ok: false });
      }
    } else if (data?.type === 'CANCEL_UPDATE') cancelPreparation();
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadExpected && !reloaded) {
      reloaded = true;
      clearTimeout(freezeTimer);
      location.reload();
    } else navigator.serviceWorker.controller?.postMessage({ type: 'CLEANUP_CACHES' });
  });

  function watch(worker) {
    if (!worker) return;
    say('正在下載更新…');
    const changed = () => {
      if (worker.state === 'installed') {
        if (!ready()) say('離線資源已準備完成');
      } else if (worker.state === 'redundant') say('更新失敗，繼續使用目前版本；請稍後重試');
    };
    worker.addEventListener('statechange', changed);
    changed();
  }

  async function check(manual = false) {
    if (!registration || checking || applying || (!manual && Date.now() - lastCheck < AUTO_INTERVAL)) return;
    lastCheck = Date.now();
    if (!navigator.onLine) { say('目前離線，無法檢查更新'); return; }
    checking = true;
    checkButton.disabled = true;
    say('正在檢查更新…');
    try {
      const response = await fetch(new URL('version.json', registration.scope), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('版本資訊讀取失敗');
      const remote = await response.json();
      if (!remote.releaseId) throw new Error('無效版本資訊');
      await registration.update();
      if (!ready()) {
        if (registration.installing) watch(registration.installing);
        else say(remote.releaseId === INFO.releaseId ? '目前沒有可用更新' : '新版尚未準備完成，請稍後重試');
      }
    } catch {
      say(navigator.onLine ? '更新檢查失敗，請稍後重試' : '目前離線，無法檢查更新');
    } finally {
      checking = false;
      checkButton.disabled = false;
    }
  }

  applyButton.addEventListener('click', async () => {
    if (applying || !registration?.waiting) return;
    applying = true;
    applyButton.disabled = true;
    laterButton.disabled = true;
    const channel = new MessageChannel();
    try {
      save();
      say('正在儲存並準備更新…');
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('更新回應逾時，請稍後重試')), 7000);
        channel.port1.onmessage = ({ data }) => { clearTimeout(timer); resolve(data); };
        registration.waiting.postMessage({ type: 'APPLY_UPDATE' }, [channel.port2]);
      });
      if (!result.ok) throw new Error(result.error || '更新暫緩，請稍後重試');
      say('正在套用更新…');
    } catch (error) {
      cancelPreparation();
      say(`無法套用更新：${error.message}`);
    } finally {
      channel.port1.close();
      applying = false;
      applyButton.disabled = false;
      laterButton.disabled = false;
    }
  });
  laterButton.addEventListener('click', () => {
    deferredWorker = registration.waiting;
    laterButton.hidden = true;
    note.hidden = true;
    document.querySelector('.app-update').classList.remove('app-update--ready');
    say('更新已暫緩，可隨時點選「立即更新」');
  });
  checkButton.addEventListener('click', () => check(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('online', () => check());
  window.addEventListener('offline', () => say('目前離線，無法檢查更新'));

  (async () => {
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      registration.addEventListener('updatefound', () => watch(registration.installing));
      if (registration.installing) watch(registration.installing);
      ready();
      navigator.serviceWorker.controller?.postMessage({ type: 'CLEANUP_CACHES' });
      await check();
    } catch { say('離線更新服務無法啟動，請稍後重新開啟'); }
  })();
}
