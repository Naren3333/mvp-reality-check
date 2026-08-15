import { createServer } from 'node:net';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDirectory = join(root, '.local-data');
const pidFile = join(dataDirectory, 'demo-server.json');
const logFile = join(dataDirectory, 'server.log');
const commandLinePort = process.argv.find((value) => value.startsWith('--port='))?.slice('--port='.length);
const requestedPort = commandLinePort || process.env.PORT || '4173';
const portWasExplicitlyRequested = Boolean(commandLinePort || process.env.PORT);
let port = Number(requestedPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use a valid TCP port number.');

function baseUrl() { return `http://127.0.0.1:${port}`; }

function cleanEnvironment() {
  const environment = {};
  for (const [key, value] of Object.entries(process.env)) if (key.toUpperCase() !== 'PATH') environment[key] = value;
  environment.Path = process.env.Path || process.env.PATH || '';
  environment.PORT = String(port);
  return environment;
}

async function health() {
  try {
    const response = await fetch(`${baseUrl()}/api/health`, { signal: AbortSignal.timeout(1200) });
    const payload = await response.json();
    return response.ok && payload?.service === 'mvp-reality-check';
  } catch { return false; }
}

async function portIsAvailable() {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', (error) => resolve(error.code !== 'EADDRINUSE'));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

async function readRecord() {
  try { return JSON.parse(await readFile(pidFile, 'utf8')); } catch { return null; }
}

async function clearRecord() { await rm(pidFile, { force: true }); }

function openBrowser() {
  if (process.platform !== 'win32') return;
  const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', baseUrl()], { detached: true, stdio: 'ignore', windowsHide: true });
  browser.unref();
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await health()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function isValidPort(value) { return Number.isInteger(value) && value > 0 && value < 65536; }

async function reuseRecordedPort() {
  if (portWasExplicitlyRequested) return;
  const record = await readRecord();
  if (isValidPort(record?.port)) port = record.port;
}

async function chooseAvailablePort() {
  if (await health() || await portIsAvailable()) return;
  if (portWasExplicitlyRequested) throw new Error(`Port ${port} is already used by another program. Choose a free port with --port=#### or close the program using this port.`);
  for (let candidate = 4175; candidate <= 4195; candidate += 1) {
    port = candidate;
    if (await health() || await portIsAvailable()) return;
  }
  throw new Error('No free local port was found between 4173 and 4195. Use --port=#### to choose one.');
}

async function start() {
  await reuseRecordedPort();
  if (await health()) {
    console.log(`MVP Reality Check is already running at ${baseUrl()}`);
    return;
  }
  await chooseAvailablePort();
  if (await health()) {
    console.log(`MVP Reality Check is already running at ${baseUrl()}`);
    return;
  }
  await mkdir(dataDirectory, { recursive: true });
  const logHandle = openSync(logFile, 'a');
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', logHandle, logHandle],
    windowsHide: true,
    env: cleanEnvironment()
  });
  child.unref();
  closeSync(logHandle);
  await writeFile(pidFile, JSON.stringify({ pid: child.pid, port, startedAt: new Date().toISOString() }, null, 2));
  if (!await waitForHealth()) {
    await clearRecord();
    throw new Error(`The server did not pass its health check. Read ${logFile} for the startup error.`);
  }
  console.log(`MVP Reality Check is running at ${baseUrl()}`);
}

async function stop() {
  const record = await readRecord();
  if (!portWasExplicitlyRequested && isValidPort(record?.port)) port = record.port;
  if (!record || record.port !== port) throw new Error(`No launcher-managed MVP Reality Check server is recorded for port ${port}.`);
  if (!await health()) { await clearRecord(); console.log('Removed a stale server record.'); return; }
  try { process.kill(record.pid); } catch (error) { throw new Error(`Could not stop the recorded server process: ${error.message}`); }
  await clearRecord();
  console.log(`Stopped MVP Reality Check on port ${port}.`);
}

async function main() {
  const wantsStatus = process.argv.includes('--status');
  const wantsStop = process.argv.includes('--stop');
  const wantsOpen = process.argv.includes('--open');
  if (wantsStatus) {
    await reuseRecordedPort();
    if (!await health()) throw new Error(`MVP Reality Check is not running at ${baseUrl()}.`);
    console.log(`MVP Reality Check is healthy at ${baseUrl()}`);
    return;
  }
  if (wantsStop) return stop();
  await start();
  if (wantsOpen) openBrowser();
}

main().catch((error) => { console.error(`MVP Reality Check launcher: ${error.message}`); process.exitCode = 1; });
