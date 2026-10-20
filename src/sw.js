// Populated by tools/build.mjs. Source previews do not register a worker.
const CONFIG = /* RELEASE_CONFIG */ null;

if (CONFIG) {
  const PREFIX = 'workout-calendar-release-';
  const CACHE = PREFIX + CONFIG.releaseId;
  const scope = self.registration.scope;
  const appURL = (name) => new URL(name, scope).href;
  const inScope = (client) => client.url.startsWith(scope);
  const windows = async () => (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(inScope);

  async function digest(response) {
    const bytes = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
    return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
  }

  self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
      const downloaded = await Promise.all(CONFIG.resources.map(async (resource) => {
        const response = await fetch(appURL(resource.url), { cache: 'no-store' });
        if (!response.ok || await digest(response) !== resource.sha256) throw new Error(`Incomplete release: ${resource.url}`);
        return [appURL(resource.url), response];
      }));
      const cache = await caches.open(CACHE);
      await Promise.all(downloaded.map(([url, response]) => cache.put(url, response)));
    })());
  });

  self.addEventListener('activate', (event) => {
    // Keep old resources until all open pages confirm they run this release.
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || !url.href.startsWith(scope)) return;
    if (['version.json', 'sw.js', 'release-manifest.json'].some((name) => url.pathname === new URL(name, scope).pathname)) {
      event.respondWith(fetch(event.request, { cache: 'no-store' }));
      return;
    }
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      if (event.request.mode === 'navigate') return await cache.match(appURL('index.html')) || fetch(event.request);
      const current = await cache.match(event.request);
      if (current) return current;
      if (url.pathname.includes('/assets/')) {
        for (const key of await caches.keys()) {
          if (key.startsWith(PREFIX)) {
            const previous = await (await caches.open(key)).match(event.request);
            if (previous) return previous;
          }
        }
      }
      return fetch(event.request);
    })());
  });

  function ask(client, message) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 4000);
      channel.port1.onmessage = ({ data }) => { clearTimeout(timer); channel.port1.close(); resolve(data); };
      client.postMessage(message, [channel.port2]);
    });
  }

  let applying = false;
  self.addEventListener('message', (event) => {
    const type = event.data?.type;
    if (type === 'APPLY_UPDATE') event.waitUntil((async () => {
      const reply = (data) => event.ports[0]?.postMessage(data);
      if (applying || !event.source || !inScope(event.source)) return reply({ ok: false });
      applying = true;
      const clients = await windows();
      try {
        const answers = await Promise.all(clients.map((client) => ask(client, {
          type: 'PREPARE_UPDATE', initiator: event.source.id, releaseId: CONFIG.releaseId,
        })));
        const currentClients = await windows();
        if (answers.some((answer) => !answer?.ok) || currentClients.some((c) => !clients.some((old) => old.id === c.id))) {
          throw new Error('請先儲存並關閉其他訓練分頁，再重試更新。');
        }
        reply({ ok: true });
        await self.skipWaiting();
      } catch (error) {
        clients.forEach((client) => client.postMessage({ type: 'CANCEL_UPDATE' }));
        reply({ ok: false, error: error.message });
      } finally { applying = false; }
    })());
    if (type === 'CLEANUP_CACHES') event.waitUntil((async () => {
      const answers = await Promise.all((await windows()).map((client) => ask(client, { type: 'GET_RELEASE' })));
      if (!answers.length || answers.some((answer) => answer?.releaseId !== CONFIG.releaseId)) return;
      await Promise.all((await caches.keys()).filter((key) => key !== CACHE && (key.startsWith(PREFIX) || key === 'workout-calendar-pwa-v1')).map((key) => caches.delete(key)));
    })());
  });
}
