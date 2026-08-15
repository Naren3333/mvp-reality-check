import { readdir, readFile, realpath } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.py', '.rb', '.go', '.java', '.cs']);
const ignoredDirectories = new Set(['.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.next', '.turbo']);
const maxFiles = 3_000;
const maxBytes = 1_000_000;

async function walk(directory, files = []) {
  if (files.length >= maxFiles) return files;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= maxFiles) break;
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walk(filePath, files);
    } else if (entry.isFile() && sourceExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(filePath);
    }
  }
  return files;
}

function firstLine(text, matcher) {
  const index = text.search(matcher);
  return index < 0 ? null : text.slice(0, index).split(/\r?\n/).length;
}

function citation(root, file, text, matcher) {
  const line = firstLine(text, matcher);
  const path = relative(root, file).split(sep).join('/');
  return line ? `${path}:${line}` : path;
}

function claimSignals(claim) {
  const normalized = claim.toLowerCase();
  const exportClaim = /export|report|download/.test(normalized);
  const words = normalized.match(/[a-z][a-z0-9-]{2,}/g) || [];
  const ignored = new Set(['teams', 'team', 'with', 'that', 'this', 'from', 'their', 'securely', 'secure', 'should', 'could', 'will', 'can']);
  const terms = words.filter((word) => !ignored.has(word)).slice(0, 6);
  return { exportClaim, terms: exportClaim ? ['export', 'report', 'download'] : terms };
}

function hasClaimSignal(path, text, signals) {
  if (signals.exportClaim) return /export|report|download/i.test(`${path}\n${text}`);
  return signals.terms.some((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(`${path}\n${text}`));
}

function makeGap(title, detail) {
  return { title, detail };
}

export async function auditRepository(repoPath, claim) {
  const root = await realpath(repoPath);
  const allFiles = await walk(root);
  const source = [];
  for (const file of allFiles) {
    try {
      const text = await readFile(file, 'utf8');
      if (Buffer.byteLength(text, 'utf8') <= maxBytes) source.push({ file, text });
    } catch { /* Skip unreadable or non-text files. */ }
  }

  const signals = claimSignals(claim);
  const aiSearchClaim = /(?:\bai\b|ai-powered|semantic|embedding|\bllm\b)/i.test(claim) && /search/i.test(claim);
  const componentPattern = /(?:export|report|download)/i;
  const routePathPattern = /(?:api|route|routes|controller|handler)/i;
  const authorizationPattern = /(?:requireRole|hasRole|authorize|authorization|permission|canExport|can[A-Z][A-Za-z]+)/;
  const testPathPattern = /(?:^|[/\\])(?:__tests__|test|tests|spec|specs)(?:[/\\]|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;
  if (aiSearchClaim) {
    const searchPattern = /\bsearch\b/i;
    const aiIntegrationPattern = /(?:openai|anthropic|\bllm\b|embedding|prompt\s*(?:template|model)|model\s*(?:provider|client))/i;
    const searchUi = source.find(({ file }) => /workspace-organization/i.test(file));
    const searchRoute = source.find(({ file, text }) => routePathPattern.test(file) && !/_test\.go$/i.test(file) && /(?:SearchWorkspaceDocuments|SearchDocuments)/.test(text));
    const aiIntegration = source.find(({ text }) => aiIntegrationPattern.test(text));
    const aiTest = source.find(({ file, text }) => (testPathPattern.test(file) || /_test\.go$/i.test(file)) && aiIntegrationPattern.test(text));
    const evidence = [];
    const gaps = [];
    if (searchUi) evidence.push({ citation: citation(root, searchUi.file, searchUi.text, searchPattern), title: 'Workspace search UI signal found', detail: 'A deterministic source check found a component associated with workspace search.', tag: 'component' });
    if (searchRoute) evidence.push({ citation: citation(root, searchRoute.file, searchRoute.text, searchPattern), title: 'Workspace search endpoint signal found', detail: 'A deterministic source check found a route-related source file associated with workspace search.', tag: 'route' });
    if (aiIntegration) evidence.push({ citation: citation(root, aiIntegration.file, aiIntegration.text, aiIntegrationPattern), title: 'AI or semantic-retrieval integration signal found', detail: 'A source signal may indicate an AI-related integration. A human must determine relevance and coverage.', tag: 'signal' });
    else gaps.push(makeGap('No AI or semantic-retrieval integration evidence found', 'The deterministic source check found no LLM, embedding, or model-provider integration signal.'));
    if (aiTest) evidence.push({ citation: citation(root, aiTest.file, aiTest.text, aiIntegrationPattern), title: 'AI-search integration test signal found', detail: 'A test file contains an AI-integration source signal; a human must determine coverage.', tag: 'test signal' });
    else gaps.push(makeGap('No automated AI-search integration test found', 'The deterministic source check found no test signal for AI or semantic-search behavior.'));
    if (!searchUi) gaps.unshift(makeGap('No workspace search UI signal found', 'No component source file matched workspace search using the supported deterministic checks.'));
    if (!searchRoute) gaps.unshift(makeGap('No workspace search endpoint signal found', 'No route-related source file matched workspace search using the supported deterministic checks.'));
    const searchSupport = Boolean(searchUi || searchRoute);
    const semanticSupport = Boolean(aiIntegration && aiTest);
    return {
      repoName: root.split(sep).filter(Boolean).at(-1) || root,
      repositoryPath: root,
      scannedFiles: source.length,
      evidence,
      gaps,
      verdict: semanticSupport ? 'Evidenced in source' : searchSupport ? 'Partially evidenced' : 'No supporting evidence found',
      boundary: 'Source signals do not establish that search is AI-powered or semantic without a source-backed integration and human verification.',
      why: searchSupport ? 'The repository supports workspace search. It does not provide source evidence of an LLM, embeddings, or semantic retrieval, so the AI-powered search claim is only partially evidenced.' : 'The supported deterministic checks found no workspace-search source signals and no AI or semantic-retrieval integration evidence.',
      trace: [`Read ${source.length} supported source files from the selected local repository.`, 'Mapped the claim to workspace search UI, search endpoint, AI or semantic-retrieval integration, and integration-test expectations.', searchUi ? `Cited workspace search UI: ${citation(root, searchUi.file, searchUi.text, searchPattern)}.` : 'No workspace search UI signal was cited.', searchRoute ? `Cited workspace search endpoint: ${citation(root, searchRoute.file, searchRoute.text, searchPattern)}.` : 'No AI or semantic-retrieval integration signal was cited.', aiIntegration ? `Cited AI integration signal: ${citation(root, aiIntegration.file, aiIntegration.text, aiIntegrationPattern)}.` : 'No AI or semantic-retrieval integration signal was cited.', aiTest ? `Cited AI-search test signal: ${citation(root, aiTest.file, aiTest.text, aiIntegrationPattern)}.` : 'No automated AI-search integration test was cited.']
    };
  }
  const component = source.find(({ file, text }) => /(?:component|components)/i.test(file) && hasClaimSignal(file, text, signals));
  const route = source.find(({ file, text }) => routePathPattern.test(file) && hasClaimSignal(file, text, signals));
  const authorization = source.find(({ file, text }) => routePathPattern.test(file) && authorizationPattern.test(text) && hasClaimSignal(file, text, signals));
  const accessTest = source.find(({ file, text }) => testPathPattern.test(file) && authorizationPattern.test(text) && hasClaimSignal(file, text, signals));
  const evidence = [];
  const gaps = [];

  if (component) evidence.push({
    citation: citation(root, component.file, component.text, componentPattern),
    title: 'Claim-related UI signal found',
    detail: 'A deterministic file-path and source-text check linked this component to the claim.',
    tag: 'component'
  });
  if (route) evidence.push({
    citation: citation(root, route.file, route.text, componentPattern),
    title: 'Claim-related route signal found',
    detail: 'A deterministic file-path and source-text check linked this route-related file to the claim.',
    tag: 'route'
  });
  if (authorization) evidence.push({
    citation: citation(root, authorization.file, authorization.text, authorizationPattern),
    title: 'Authorization signal found',
    detail: 'A route-related file contains an authorization-related source signal. A human must determine relevance and coverage.',
    tag: 'signal'
  });
  else gaps.push(makeGap('No route-level authorization signal found', 'The deterministic source check did not find an authorization-related signal in a claim-related route file.'));
  if (accessTest) evidence.push({
    citation: citation(root, accessTest.file, accessTest.text, authorizationPattern),
    title: 'Access-control test signal found',
    detail: 'A test file contains both claim-related and access-control-related source signals. A human must determine coverage.',
    tag: 'test signal'
  });
  else gaps.push(makeGap('No automated access-control test signal found', 'The deterministic source check did not find an access-control-related signal in a claim-related test file.'));
  if (!component) gaps.unshift(makeGap('No claim-related UI component signal found', 'No component file matched the entered claim using the supported deterministic checks.'));
  if (!route) gaps.unshift(makeGap('No claim-related route signal found', 'No route-related file matched the entered claim using the supported deterministic checks.'));

  const supportFound = Boolean(component || route);
  const allExpectedSignals = Boolean(component && route && authorization && accessTest);
  const verdict = allExpectedSignals ? 'Evidenced in source' : supportFound ? 'Partially evidenced' : 'No supporting evidence found';
  const trace = [
    `Read ${source.length} supported source files from the selected local repository.`,
    `Mapped the claim to ${signals.exportClaim ? 'export interface, export route, authorization, and access-control test' : 'claim-related component, route, authorization, and test'} expectations.`,
    component ? `Cited component signal: ${citation(root, component.file, component.text, componentPattern)}.` : 'No claim-related component signal was cited.',
    route ? `Cited route signal: ${citation(root, route.file, route.text, componentPattern)}.` : 'No claim-related route signal was cited.',
    authorization ? `Cited authorization signal: ${citation(root, authorization.file, authorization.text, authorizationPattern)}.` : 'No route-level authorization signal was cited.',
    accessTest ? `Cited access-control test signal: ${citation(root, accessTest.file, accessTest.text, authorizationPattern)}.` : 'No automated access-control test signal was cited.'
  ];

  return {
    repoName: root.split(sep).filter(Boolean).at(-1) || root,
    repositoryPath: root,
    scannedFiles: source.length,
    evidence,
    gaps,
    verdict,
    boundary: 'Source signals do not establish runtime behavior, security, or suitability without human verification.',
    why: supportFound
      ? 'The local repository contains source signals linked to the claim. Any authorization and test signals are reported as citations, not proof: a reviewer must verify their relevance, runtime behavior, and coverage.'
      : 'The supported deterministic checks found no claim-related component or route signals in the selected local repository. This does not establish that the capability is absent, nor can source-only checks evaluate runtime behavior or security.',
    trace
  };
}
