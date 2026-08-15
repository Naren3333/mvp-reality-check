import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRepository } from './audit-engine.mjs';

const port = Number(process.env.PORT || 4173);
const root = fileURLToPath(new URL('.', import.meta.url));
const historyDirectory = join(root, '.local-data');
const historyFile = join(historyDirectory, 'audit-history.json');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request is too large.');
  }
  return JSON.parse(body || '{}');
}

async function getHistory() {
  try { return JSON.parse(await readFile(historyFile, 'utf8')); } catch { return []; }
}

async function saveAudit(audit, claim) {
  const history = await getHistory();
  history.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), claim, repoName: audit.repoName, verdict: audit.verdict, evidence: audit.evidence.map(({ citation }) => citation), gaps: audit.gaps.map(({ title }) => title) });
  await mkdir(historyDirectory, { recursive: true });
  await writeFile(historyFile, JSON.stringify(history.slice(0, 50), null, 2));
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/history') {
    const history = await getHistory();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(history));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/audit') {
    try {
      const { repoPath, claim } = await readJson(req);
      if (typeof repoPath !== 'string' || !repoPath.trim() || typeof claim !== 'string' || !claim.trim()) throw new Error('A local repository path and claim are required.');
      const audit = await auditRepository(repoPath.trim(), claim.trim());
      await saveAudit(audit, claim.trim());
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(audit));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'The local audit could not be completed.' }));
    }
    return;
  }
  const requested = req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, '');
  const file = normalize(join(root, requested));
  if (!file.startsWith(normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`MVP Reality Check is running at http://localhost:${port}`));
