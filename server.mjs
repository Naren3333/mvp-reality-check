import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { auditRepository } from './audit-engine.mjs';

const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port number.');
const root = fileURLToPath(new URL('.', import.meta.url));
const dataDirectory = join(root, '.local-data');
const historyFile = join(dataDirectory, 'audit-history.json');
const reviewsFile = join(dataDirectory, 'reviews.json');
const testRunsFile = join(dataDirectory, 'test-runs.json');
const repositoryCacheDirectory = join(dataDirectory, 'repository-cache');
const sandboxRunsDirectory = join(dataDirectory, 'sandbox-runs');
const npmCacheDirectory = join(dataDirectory, 'npm-cache');
const activeSandboxRepositories = new Set();
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

function parsePublicGitHubUrl(value) {
  try {
    const url = new URL(value.trim());
    const match = url.hostname === 'github.com' && url.protocol === 'https:' && url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
    return match ? { url: `https://github.com/${match[1]}/${match[2]}.git`, owner: match[1], repository: match[2] } : null;
  } catch { return null; }
}

async function clearPreviousGitHubClone() {
  await mkdir(repositoryCacheDirectory, { recursive: true });
  const cacheRoot = resolve(repositoryCacheDirectory);
  for (const entry of await readdir(repositoryCacheDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('github-')) continue;
    const target = resolve(repositoryCacheDirectory, entry.name);
    if (!target.startsWith(`${cacheRoot}${sep}`)) throw new Error('Refusing to clear a repository outside the managed cache.');
    if (activeSandboxRepositories.has(target)) throw new Error('Wait for the active sandbox run to finish before cloning another public repository.');
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 600 });
  }
}

async function clonePublicGitHubRepository(value) {
  const parsed = parsePublicGitHubUrl(value);
  if (!parsed) throw new Error('Enter a public HTTPS GitHub repository URL such as https://github.com/owner/repository.');
  await clearPreviousGitHubClone();
  const destination = await mkdtemp(join(repositoryCacheDirectory, 'github-'));
  try {
    await execFileAsync('git', ['-c', 'protocol.file.allow=never', 'clone', '--depth', '1', '--no-tags', parsed.url, destination], { timeout: 120_000, maxBuffer: 2_000_000 });
    return { ...parsed, path: destination };
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw new Error(`Could not clone the public GitHub repository: ${error instanceof Error ? error.message : 'unknown Git error'}`);
  }
}

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
      for (const [name, script] of Object.entries(pkg.scripts || {})) if (/test|e2e|lint|typecheck|check|build/i.test(name)) commands.push({ manifest, command: `npm run ${name}`, script });
    } catch { /* No supported manifest at this location. */ }
  }
  return { commands, note: 'Test commands are discovered only. This read-only auditor does not execute repository code.' };
}

async function dockerStatus() {
  try {
    const result = await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 8_000, maxBuffer: 10_000 });
    return { available: true, version: result.stdout.trim() };
  } catch { return { available: false, version: null, note: 'Docker Desktop is not running or its engine is unavailable.' }; }
}

function sandboxFilter(source) {
  return !new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.turbo']).has(basename(source));
}

function trimLog(value) {
  const text = String(value || '').trim();
  return text.length > 18_000 ? `${text.slice(0, 18_000)}\n… output truncated …` : text;
}

async function dockerCommand(args, timeout = 180_000) {
  try {
    const result = await execFileAsync('docker', args, { timeout, maxBuffer: 20_000_000 });
    return { ok: true, exitCode: 0, log: trimLog(`${result.stdout}\n${result.stderr}`) };
  } catch (error) {
    const detail = error instanceof Error ? error : new Error('Docker command failed.');
    const timeoutNote = detail.killed ? '\nSandbox command exceeded its time limit.' : '';
    return { ok: false, exitCode: typeof detail.code === 'number' ? detail.code : null, log: trimLog(`${detail.stdout || ''}\n${detail.stderr || ''}\n${detail.message || ''}${timeoutNote}`) };
  }
}

function containerArgs(workspace, command, network) {
  return ['run', '--rm', '--network', network ? 'bridge' : 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '256', '--memory', '1g', '--cpus', '1', '--mount', `type=bind,src=${workspace},dst=/workspace`, '--mount', `type=bind,src=${npmCacheDirectory},dst=/npm-cache`, '-w', '/workspace', 'node:22-bookworm-slim', 'sh', '-lc', command];
}

async function runSandboxTest(repoPath, command, allowSetupNetwork) {
  const docker = await dockerStatus();
  if (!docker.available) return { status: 'unavailable', docker, command, setup: null, test: null, boundary: 'No code was executed because Docker is unavailable.' };
  const discovered = await discoverTests(repoPath);
  if (!discovered.commands.some((item) => item.command === command)) throw new Error('Choose a discovered test or check command. Arbitrary shell commands are not accepted.');
  await stat(repoPath);
  const resolvedRepositoryPath = resolve(repoPath);
  await Promise.all([mkdir(sandboxRunsDirectory, { recursive: true }), mkdir(npmCacheDirectory, { recursive: true })]);
  const runDirectory = await mkdtemp(join(sandboxRunsDirectory, 'run-'));
  const workspace = join(runDirectory, 'workspace');
  const startedAt = new Date().toISOString();
  activeSandboxRepositories.add(resolvedRepositoryPath);
  try {
    await cp(repoPath, workspace, { recursive: true, filter: sandboxFilter });
    const hasLockFile = await stat(join(workspace, 'package-lock.json')).then(() => true).catch(() => false);
    let setup = { status: 'skipped', log: 'Dependency setup was not requested. The test will run with only repository files in the disposable workspace.' };
    if (allowSetupNetwork) {
      if (!hasLockFile) return { status: 'setup-required', docker, command, startedAt, setup: { status: 'blocked', log: 'Networked dependency setup is supported only for repositories with package-lock.json.' }, test: null, boundary: 'No test was executed. A lock file is required for reproducible dependency setup.' };
      const setupResult = await dockerCommand(containerArgs(workspace, 'npm ci --ignore-scripts --no-audit --no-fund --cache /npm-cache', true), 240_000);
      setup = { status: setupResult.ok ? 'passed' : 'failed', log: setupResult.log, exitCode: setupResult.exitCode, network: 'enabled only for npm ci --ignore-scripts' };
      if (!setupResult.ok) return { status: 'setup-failed', docker, command, startedAt, setup, test: null, boundary: 'No test was executed because dependency setup failed in the disposable sandbox.' };
    }
    const testResult = await dockerCommand(containerArgs(workspace, command, false), 180_000);
    return { status: testResult.ok ? 'passed' : 'failed', docker, command, startedAt, finishedAt: new Date().toISOString(), setup, test: { status: testResult.ok ? 'passed' : 'failed', exitCode: testResult.exitCode, log: testResult.log, network: 'disabled' }, boundary: 'This records one command in an isolated disposable workspace. It does not prove production behaviour, security, or complete test coverage.' };
  } finally {
    await rm(runDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 600 }).catch(() => {});
    activeSandboxRepositories.delete(resolvedRepositoryPath);
  }
}

async function saveTestRun(result, repoName, claim, auditId) {
  const runs = await readStore(testRunsFile);
  const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), repoName, claim, auditId, status: result.status, command: result.command, setupStatus: result.setup?.status || null, testStatus: result.test?.status || null, exitCode: result.test?.exitCode ?? null, dockerVersion: result.docker?.version || null, boundary: result.boundary };
  runs.unshift(entry);
  await writeStore(testRunsFile, runs.slice(0, 100));
  return entry;
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') return sendJson(res, 200, { service: 'mvp-reality-check', status: 'ready', port });
  if (req.method === 'GET' && req.url === '/api/history') return sendJson(res, 200, await readStore(historyFile));
  if (req.method === 'GET' && req.url === '/api/reviews') return sendJson(res, 200, await readStore(reviewsFile));
  if (req.method === 'GET' && req.url === '/api/docker-status') return sendJson(res, 200, await dockerStatus());
  if (req.method === 'GET' && req.url === '/api/test-runs') return sendJson(res, 200, await readStore(testRunsFile));
  if (req.method === 'POST' && req.url === '/api/github-audit') {
    try {
      const { url, claim, template = 'generic', rules = null, documents = [] } = await readJson(req);
      if (typeof url !== 'string' || typeof claim !== 'string' || !claim.trim()) throw new Error('A public GitHub URL and claim are required.');
      const cloned = await clonePublicGitHubRepository(url);
      const audit = await auditRepository(cloned.path, claim.trim(), template, rules);
      audit.repoName = cloned.repository;
      audit.template = template;
      audit.git = await gitContext(audit.repositoryPath);
      audit.testDiscovery = await discoverTests(audit.repositoryPath);
      audit.remote = { provider: 'GitHub', url: `https://github.com/${cloned.owner}/${cloned.repository}`, clone: 'shallow public clone stored locally for this review' };
      await saveAudit(audit, claim.trim(), normalizeDocuments(documents));
      return sendJson(res, 200, audit);
    } catch (error) { return sendJson(res, 400, { error: error instanceof Error ? error.message : 'The public GitHub audit could not be completed.' }); }
  }
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
  if (req.method === 'POST' && req.url === '/api/test-run') {
    try {
      const { repoPath, command, allowSetupNetwork = false, claim = '', auditId = '', repoName = '' } = await readJson(req);
      if (typeof repoPath !== 'string' || !repoPath || typeof command !== 'string' || !command) throw new Error('Repository path and a discovered test command are required.');
      const result = await runSandboxTest(repoPath, command, Boolean(allowSetupNetwork));
      const run = await saveTestRun(result, String(repoName || basename(repoPath)).slice(0, 140), String(claim).slice(0, 500), String(auditId));
      return sendJson(res, 200, { ...result, run });
    } catch (error) { return sendJson(res, 400, { error: error instanceof Error ? error.message : 'The sandbox test could not be completed.' }); }
  }
  const requested = req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, '');
  const file = normalize(join(root, requested));
  if (!file.startsWith(normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  try { res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(await readFile(file)); }
  catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
});

server.on('error', (error) => {
  console.error(`Could not start MVP Reality Check on http://localhost:${port}: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => console.log(`MVP Reality Check is running at http://localhost:${port}`));
