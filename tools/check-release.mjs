import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, config, hash, git, filesIn, validateReleaseId, sourceFingerprint } from './build.mjs';

export async function checkRelease(output = path.join(root, 'dist')) {
  const appDir = path.join(output, config.basePath.slice(config.sitePath.length));
  const manifest = JSON.parse(await readFile(path.join(appDir, 'release-manifest.json'), 'utf8'));
  validateReleaseId(manifest.releaseId);
  assert.equal(manifest.commit, git('rev-parse', 'HEAD'), '產物不是目前 commit');
  assert.equal(manifest.sourceFingerprint, await sourceFingerprint(), '來源已變更，請重新建置再驗證');
  assert.equal(manifest.basePath, config.basePath);
  assert.equal(manifest.dataVersion, config.dataVersion);
  const version = JSON.parse(await readFile(path.join(appDir, 'version.json'), 'utf8'));
  for (const key of Object.keys(version)) assert.deepEqual(version[key], manifest[key], `版本資訊不一致：${key}`);
  assert(!git('tag', '--list', `pwa-${manifest.releaseId}`), '此 release ID 已有 Git tag，請使用新序號');
  const files = await filesIn(appDir);
  const resources = manifest.resources.map((r) => r.url);
  assert.equal(new Set(resources).size, resources.length);
  for (const resource of manifest.resources) {
    assert(!resource.url.includes('..') && !resource.url.startsWith('/'), '不安全的資源路徑');
    assert.equal(hash(await readFile(path.join(appDir, resource.url))), resource.sha256, `資源內容不一致：${resource.url}`);
  }
  assert.deepEqual(files.filter((f) => !['sw.js', 'version.json', 'release-manifest.json'].includes(f)), [...resources].sort());
  const sw = await readFile(path.join(appDir, 'sw.js'), 'utf8');
  assert.equal(hash(sw), manifest.workerSha256);
  assert(!sw.includes('/* RELEASE_CONFIG */ null'), 'worker 尚未生成');
  assert(sw.includes(JSON.stringify(manifest.releaseId)));
  const html = await readFile(path.join(appDir, 'index.html'), 'utf8');
  for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(https?:|#|data:)/.test(reference)) continue;
    assert(!reference.includes('?'), '資源應使用雜湊檔名');
    assert(resources.includes(reference.replace(/^\.\//, '')), `引用未納入快取：${reference}`);
  }
  assert(resources.some((r) => /^assets\/main-[\w-]+\.js$/.test(r)));
  assert(resources.some((r) => /^assets\/styles-[\w-]+\.css$/.test(r)));
  assert(resources.includes('manifest.json') && resources.includes('icons/calendar-icon.svg'));
  const webManifest = JSON.parse(await readFile(path.join(appDir, 'manifest.json'), 'utf8'));
  assert.equal(webManifest.start_url, '.');
  for (const size of [192, 512]) {
    const icon = webManifest.icons.find(icon => icon.sizes === `${size}x${size}` && icon.type === 'image/png');
    assert(icon && resources.includes(icon.src), `缺少 ${size}px 安裝圖示`);
    const png = await readFile(path.join(appDir, icon.src));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
  assert(webManifest.icons.some(icon => (icon.purpose || '').split(' ').includes('maskable')), '缺少可裁切圖示');
  if (process.env.FORMAL_RELEASE === '1') {
    assert(!manifest.sourceDirty && !git('status', '--porcelain'), '正式發版要求乾淨的工作目錄');
    const remoteTags = git('ls-remote', '--tags', 'origin', `refs/tags/pwa-${manifest.releaseId}`);
    assert(!remoteTags, '遠端已有此 release ID');
    const response = await fetch(`https://zane82128.github.io${config.basePath}version.json`, { cache: 'no-store' });
    if (response.ok) assert.notEqual((await response.json()).releaseId, manifest.releaseId, '正式網站已使用此 release ID');
    else assert.equal(response.status, 404, '無法核對正式版本');
  }
  console.log(`Release checks passed: ${manifest.releaseId}${manifest.sourceDirty ? ' (本地未提交修改，禁止正式部署)' : ''}`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkRelease();
