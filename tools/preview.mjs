import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { root, config } from './build.mjs';

export async function startServer({ directory = () => path.join(root, 'dist'), missing = () => false, port = 0 } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith(config.sitePath) || missing(pathname)) throw new Error('Not found');
      let relative = pathname.slice(config.sitePath.length);
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      const base = path.resolve(directory());
      const target = path.resolve(base, relative);
      if (!target.startsWith(base + path.sep) || !(await stat(target)).isFile()) throw new Error('Not found');
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(target));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}${config.basePath}` };
}

if (process.argv[1]?.endsWith('preview.mjs')) {
  const { url } = await startServer({ port: 5173 });
  console.log(`Preview: ${url}`);
}
