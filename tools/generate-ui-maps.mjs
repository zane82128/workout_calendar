import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const mapsDir = path.join(rootDir, 'docs', 'ui_component_maps');
const configPath = path.join(__dirname, 'ui-map.config.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function resolveSafePath(urlPath) {
  const normalized = path.normalize(urlPath.replace(/^\/+/, ''));
  if (!normalized || normalized === '.') {
    return path.join(srcDir, 'index.html');
  }
  const filePath = path.join(srcDir, normalized);
  if (!filePath.startsWith(srcDir)) return null;
  return filePath;
}

function startStaticServer(port = 5179) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const reqPath = req.url?.split('?')[0] || '/';
        const filePath = resolveSafePath(reqPath);
        if (!filePath || !existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath);
        const mime = MIME[ext] || 'application/octet-stream';
        const content = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': mime });
        res.end(content);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(String(error));
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function seedLocalState() {
  const today = new Date().toISOString().slice(0, 10);
  const iso = new Date().toISOString();
  return {
    exercises: [
      { id: 'ex-1', name: '三頭下壓', category: '手臂', createdAt: iso },
      { id: 'ex-2', name: '平板臥推', category: '胸', createdAt: iso },
      { id: 'ex-3', name: '深蹲', category: '腿', createdAt: iso }
    ],
    entries: [
      {
        id: 'en-1',
        dateKey: today,
        exerciseId: 'ex-1',
        exerciseName: '三頭下壓',
        exerciseCategory: '手臂',
        weight: 12.5,
        unit: 'kg',
        reps: 10,
        sets: 3,
        note: '組間休息 90 秒',
        createdAt: iso
      }
    ],
    presetVersionApplied: '2026-02-07-v2',
    selectedDate: `${today}T00:00:00.000Z`
  };
}

async function injectOverlay(page, title, elements) {
  await page.evaluate(({ titleText, mapElements }) => {
    const existing = document.getElementById('ui-map-overlay-root');
    if (existing) existing.remove();

    const palette = ['#64b5f6', '#aed581', '#ffb74d', '#ce93d8', '#ef9a9a'];
    const root = document.createElement('div');
    root.id = 'ui-map-overlay-root';
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '2147483647';

    const titleTag = document.createElement('div');
    titleTag.textContent = titleText;
    titleTag.style.position = 'fixed';
    titleTag.style.left = '8px';
    titleTag.style.top = '8px';
    titleTag.style.padding = '6px 10px';
    titleTag.style.background = 'rgba(0, 0, 0, 0.72)';
    titleTag.style.color = '#fff';
    titleTag.style.font = '700 14px/1.2 Segoe UI, sans-serif';
    root.appendChild(titleTag);

    let index = 0;
    for (const entry of mapElements) {
      const element = document.querySelector(entry.selector);
      if (!element) {
        index += 1;
        continue;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        index += 1;
        continue;
      }
      const color = palette[index % palette.length];
      const box = document.createElement('div');
      box.style.position = 'fixed';
      box.style.left = `${Math.max(0, rect.left)}px`;
      box.style.top = `${Math.max(0, rect.top)}px`;
      box.style.width = `${Math.max(2, rect.width)}px`;
      box.style.height = `${Math.max(2, rect.height)}px`;
      box.style.border = `3px solid ${color}`;
      box.style.boxSizing = 'border-box';

      const tag = document.createElement('div');
      tag.textContent = `${index + 1} ${entry.label}`;
      tag.style.position = 'fixed';
      tag.style.left = `${Math.max(4, rect.left)}px`;
      tag.style.top = `${Math.max(4, rect.top - 24)}px`;
      tag.style.padding = '2px 6px';
      tag.style.background = 'rgba(0, 0, 0, 0.72)';
      tag.style.border = `2px solid ${color}`;
      tag.style.color = '#fff';
      tag.style.font = '600 11px/1.2 Segoe UI, sans-serif';

      root.appendChild(box);
      root.appendChild(tag);
      index += 1;
    }
    document.body.appendChild(root);
  }, { titleText: title, mapElements: elements });
}

async function removeOverlay(page) {
  await page.evaluate(() => {
    const existing = document.getElementById('ui-map-overlay-root');
    if (existing) existing.remove();
  });
}

async function generate() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1 });
    await context.addInitScript((data) => {
      localStorage.setItem('workoutCalendar.v1', JSON.stringify(data));
    }, seedLocalState());

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5179/index.html', { waitUntil: 'networkidle' });

    for (const pageMap of config.pages) {
      if (pageMap.activate) {
        await page.click(pageMap.activate);
      }
      await page.waitForTimeout(250);
      await page.evaluate(() => window.scrollTo(0, 0));
      await removeOverlay(page);
      await page.screenshot({ path: path.join(mapsDir, `${pageMap.name}_raw.png`) });
      await injectOverlay(page, pageMap.title, pageMap.elements);
      await page.screenshot({ path: path.join(mapsDir, `${pageMap.name}_annotated.png`) });
      await removeOverlay(page);
    }

    await context.close();
    console.log('UI maps generated successfully.');
  } finally {
    await browser.close();
    server.close();
  }
}

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
