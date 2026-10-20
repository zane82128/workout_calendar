import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const config = JSON.parse(await readFile(path.join(root, 'release.config.json'), 'utf8'));
export const hash = (data) => createHash('sha256').update(data).digest('hex');
export const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

export function validateReleaseId(id) {
  if (!/^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/.test(id || '')) throw new Error('請指定 --release YYYY.MM.DD.序號');
  const [y, m, d] = id.split('.').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new Error('無效的 release 日期');
  if (!config.basePath.startsWith(config.sitePath) || !config.basePath.endsWith('/') || config.basePath.includes('..')) throw new Error('無效的 basePath');
}

export function releaseArgument() {
  const index = process.argv.indexOf('--release');
  const id = index >= 0 ? process.argv[index + 1] : process.env.RELEASE_ID;
  validateReleaseId(id);
  return id;
}

export async function filesIn(dir, prefix = '') {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + item.name;
    if (item.isDirectory()) result.push(...await filesIn(path.join(dir, item.name), name + '/'));
    else result.push(name);
  }
  return result.sort();
}

export async function sourceFingerprint() {
  const inputs = (await filesIn(path.join(root, 'src'))).map((name) => `src/${name}`);
  inputs.push('release.config.json', 'package.json', 'package-lock.json', 'tools/build.mjs');
  const signatures = [];
  for (const name of inputs.sort()) signatures.push(`${name}:${hash(await readFile(path.join(root, name)))}`);
  return hash(signatures.join('\n'));
}

export async function buildRelease(id, output = path.join(root, 'dist')) {
  validateReleaseId(id);
  output = path.resolve(output);
  if (output !== path.join(root, 'dist') && !output.startsWith(path.join(root, '.release-tests') + path.sep)) throw new Error('建置路徑必須位於 dist 或 .release-tests');
  await mkdir(output, { recursive: true });
  const appDir = path.join(output, config.basePath.slice(config.sitePath.length));
  await mkdir(appDir, { recursive: true });
  const commit = git('rev-parse', 'HEAD');
  const info = {
    releaseId: id, commit,
    builtAt: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
    sourceDirty: Boolean(git('status', '--porcelain')),
    sourceFingerprint: await sourceFingerprint(),
    dataVersion: config.dataVersion, basePath: config.basePath,
  };
  const result = await build({
    absWorkingDir: root, entryPoints: ['src/main.js', 'src/styles.css'],
    outdir: path.join(appDir, 'assets'), entryNames: '[name]-[hash]',
    bundle: true, format: 'esm', target: ['es2020'], write: false,
    loader: { '.woff2': 'file', '.svg': 'file' }, assetNames: '[name]-[hash]',
    define: { __RELEASE_INFO__: JSON.stringify(info) },
  });
  for (const file of await filesIn(output)) await rm(path.join(output, file));
  for (const file of result.outputFiles) {
    await mkdir(path.dirname(file.path), { recursive: true });
    await writeFile(file.path, file.contents);
  }
  const js = path.basename(result.outputFiles.find((f) => f.path.endsWith('.js')).path);
  const css = path.basename(result.outputFiles.find((f) => f.path.endsWith('.css')).path);
  let html = await readFile(path.join(root, 'src/index.html'), 'utf8');
  html = html.replace(/styles\.css(?:\?[^"']*)?/, `assets/${css}`).replace(/main\.js(?:\?[^"']*)?/, `assets/${js}`);
  await writeFile(path.join(appDir, 'index.html'), html);
  await cp(path.join(root, 'src/icons'), path.join(appDir, 'icons'), { recursive: true });
  await cp(path.join(root, 'src/manifest.json'), path.join(appDir, 'manifest.json'));
  await mkdir(path.join(appDir, 'fonts'), { recursive: true });
  await cp(path.join(root, 'src/fonts/OFL.txt'), path.join(appDir, 'fonts/OFL.txt'));
  await cp(path.join(root, 'src/fonts/LICENSES'), path.join(appDir, 'fonts/LICENSES'), { recursive: true });
  const resources = [];
  for (const name of await filesIn(appDir)) resources.push({ url: name, sha256: hash(await readFile(path.join(appDir, name))) });
  const worker = (await readFile(path.join(root, 'src/sw.js'), 'utf8')).replace('/* RELEASE_CONFIG */ null', JSON.stringify({ ...info, resources }));
  await writeFile(path.join(appDir, 'sw.js'), worker);
  await writeFile(path.join(appDir, 'version.json'), JSON.stringify(info, null, 2) + '\n');
  await writeFile(path.join(appDir, 'release-manifest.json'), JSON.stringify({ ...info, resources, workerSha256: hash(worker) }, null, 2) + '\n');
  await writeFile(path.join(output, '.nojekyll'), '');
  if (appDir !== output) await writeFile(path.join(output, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Workout Calendar</title><a href="./src/">開啟 Workout Calendar</a>');
  return { output, appDir, info };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildRelease(releaseArgument());
  console.log(`Built ${result.info.releaseId} (${result.info.commit.slice(0, 8)}) → dist/`);
}
