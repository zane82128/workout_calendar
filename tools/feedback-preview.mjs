import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../services/feedback/smoke.html', import.meta.url));
const server = createServer((req, res) => {
  if (req.url !== '/') { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html);
});
server.listen(5174, '127.0.0.1', () => console.log('Feedback smoke test: http://127.0.0.1:5174/ (not the workout app)'));
