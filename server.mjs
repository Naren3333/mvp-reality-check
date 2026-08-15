import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { auditRepository } from './audit-engine.mjs';

const port = Number(process.env.PORT || 4173);
const root = fileURLToPath(new URL('.', import.meta.url));
const dataDirectory = join(root, '.local-data');
const historyFile = join(dataDirectory, 'audit-history.json');
const reviewsFile = join(dataDirectory, 'reviews.json');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const execFileAsync = promisify(execFile);

async function readJson(request) {
  let body = '';
  for await (const chunk of request) { body += chunk; if (body.length > 1_000_000) throw new Error('Request is too large.'); }
  return JSON.parse(body || '{}');
}

async function readStore(file) {
  try { const value = JSON.parse(await readFile(file, 'utf8')); return Array.isArray(value) ? value : []; } catch { return []; }
}

async function writeStore(file, value) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
}

function gitArgs(repoPath, args) { return ['-c', `safe.directory=${repoPath}`, '-C', repoPath, ...args]; }

async function gitContext(repoPath) {
  try {
    const [branch, commit, status] = await Promise.all([
      execFileAsync('git', gitArgs(repoPath, ['branch', '--show-current'])),
      execFileAsync('git', gitArgs(repoPath, ['rev-parse', '--short', 'HEAD'])),
      execFileAsync('git', gitArgs(repoPath, ['status', '--porcelain']))
    ]);
    return { branch: branch.stdout.trim() || 'detached', commit: commit.stdout.trim(), dirty: Boolean(status.stdout.trim()) };
  } catch { return null; }
}

async function gitDiff(repoPath, baseline, current) {
  if (!baseline || !current || baseline === current) return { available: false, files: [], note: baseline === current ? 'The previous saved audit used the same commit.' : 'No comparable Git baseline was available.' };
  try {
    const result = await execFileAsync('git', gitArgs(repoPath, ['diff', '--name-only', `${baseline}..${current}`]));
    const files = result.stdout.split(/\r?\n/).filter(Boolean).slice(0, 40);
    return { available: true, files, note: files.length ? `${files.length} changed file(s) between saved audit commits.` : 'No tracked file changes were reported between saved audit commits.' };
  } catch { return { available: false, files: [], note: 'Git diff could not be calculated for the previous saved audit.' }; }
}

function normalizeDocuments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((item) => ({ name: String(item?.name || 'Untitled document').slice(0, 140), text: String(item?.text || '').slice(0, 24_000) })).filter((item) => item.text.trim());
}

async function saveAudit(audit, claim, documents) {
  const history = await readStore(historyFile);
  const previous = history.find((entry) => entry.repoName === audit.repoName && entry.template === audit.template);
  const citations = audit.evidence.map(({ citation }) => citation);
  audit.comparison = previous ? {
    baselineCommit: previous.git?.commit || null,
    previousVerdict: previous.verdict,
    newEvidence: citations.filter((citation) => !previous.evidence.includes(citation)),
    removedEvidence: previous.evidence.filter((citation) => !citations.includes(citation)),
    gitDiff: await gitDiff(audit.repositoryPath, previous.git?.commit, audit.git?.commit)
  } : null;
  audit.auditId = crypto.randomUUID();
  audit.documentEvidence = documents.map((item) => ({ name: item.name, kind: 'reviewer-supplied document', excerpt: item.text.replace(/\s+/g, ' ').slice(0, 300) }));
  history.unshift({ id: audit.auditId, createdAt: new Date().toISOString(), claim, template: audit.template, repoName: audit.repoName, verdict: audit.verdict, git: audit.git, evidence: citations, gaps: audit.gaps.map(({ title }) => title), requirements: audit.requirements, documents: audit.documentEvidence.map(({ name }) => name) });
  await writeStore(historyFile, history.slice(0, 50));
}

async function discoverTests(repoPath) {
  const manifests = ['package.json', 'apps/web/package.json', 'apps/collaboration/package.json'];
  const commands = [];
  for (const manifest of manifests) {
    try {
      const pkg = JSON.parse(await readFile(join(repoPath, manifest), 'utf8'));
      for (const [name, script] of Object.entries(pkg.scripts || {})) if (/test|e2e|check/i.test(name)) commands.push({ manifest, command: `npm run ${name}`, script });
    } catch { /* No supported manifest at this location. */ }
  }
  return { commands, note: 'Test commands are discovered only. This read-only auditor does not execute repository code.' };
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/history') return sendJson(res, 200, await readStore(historyFile));
  if (req.method === 'GET' && req.url === '/api/reviews') return sendJson(res, 200, await readStore(reviewsFile));
  if (req.method === 'POST' && req.url === '/api/audit') {
    try {
      const { repoPath, claim, template = 'generic', rules = null, documents = [] } = await readJson(req);
      if (typeof repoPath !== 'string' || !repoPath.trim() || typeof claim !== 'string' || !claim.trim()) throw new Error('A local repository path and claim are required.');
      const audit = await auditRepository(repoPath.trim(), claim.trim(), template, rules);
      audit.template = template;
      audit.git = await gitContext(audit.repositoryPath);
      audit.testDiscovery = await discoverTests(audit.repositoryPath);
      await saveAudit(audit, claim.trim(), normalizeDocuments(documents));
      return sendJson(res, 200, audit);
    } catch (error) { return sendJson(res, 400, { error: error instanceof Error ? error.message : 'The local repository audit could not be completed.' }); }
  }
  if (req.method === 'POST' && req.url === '/api/reviews') {
    try {
      const review = await readJson(req);
      if (!review.claim || !review.repoName || !review.decision) throw new Error('Claim, repository, and reviewer decision are required.');
      const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), auditId: String(review.auditId || ''), claim: String(review.claim).slice(0, 500), repoName: String(review.repoName).slice(0, 140), verdict: String(review.verdict || ''), decision: String(review.decision).slice(0, 140), owner: String(review.owner || '').slice(0, 140), dueDate: String(review.dueDate || '').slice(0, 30), notes: String(review.notes || '').slice(0, 6000), state: String(review.state || 'Open').slice(0, 30) };
      const reviews = await readStore(reviewsFile);
      reviews.unshift(entry);
      await writeStore(reviewsFile, reviews.slice(0, 100));
      return sendJson(res, 201, entry);
    } catch (error) { return sendJson(res, 400, { error: error instanceof Error ? error.message : 'The reviewer decision could not be saved.' }); }
  }
  const requested = req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, '');
  const file = normalize(join(root, requested));
  if (!file.startsWith(normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  try { res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(await readFile(file)); }
  catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`MVP Reality Check is running at http://localhost:${port}`));
