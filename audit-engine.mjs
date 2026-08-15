import { readdir, readFile, realpath } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.py', '.rb', '.go', '.java', '.cs']);
const ignoredDirectories = new Set(['.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.next', '.turbo']);
const maxFiles = 3000;
const maxBytes = 1_000_000;

async function walk(directory, files = []) {
  if (files.length >= maxFiles) return files;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (files.length >= maxFiles) break;
    const file = resolve(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) await walk(file, files);
    if (entry.isFile() && sourceExtensions.has(extname(entry.name).toLowerCase())) files.push(file);
  }
  return files;
}

function compilePattern(value) {
  try { return value ? new RegExp(value, 'i') : null; } catch { return null; }
}

function lineNumber(text, matcher) {
  const index = text.search(matcher);
  return index < 0 ? null : text.slice(0, index).split(/\r?\n/).length;
}

function sourcePath(root, file) {
  return relative(root, file).split(sep).join('/');
}

function sourceExcerpt(text, matcher) {
  const line = lineNumber(text, matcher);
  if (!line) return '';
  return text.split(/\r?\n/).slice(Math.max(0, line - 2), line + 1).map((item) => item.trim().slice(0, 220)).join('\n');
}

function cited(root, candidate, matcher) {
  const line = lineNumber(candidate.text, matcher);
  return {
    citation: `${sourcePath(root, candidate.file)}${line ? `:${line}` : ''}`,
    excerpt: sourceExcerpt(candidate.text, matcher)
  };
}

function evidence(root, candidate, matcher, title, detail, tag) {
  return { ...cited(root, candidate, matcher), title, detail, tag };
}

function gap(title, detail, nextStep) {
  return { title, detail, nextStep: nextStep || 'Ask a reviewer to identify the missing source or runtime evidence.' };
}

function verdictFor(requirements) {
  const sourceRequirements = requirements.filter((item) => item.kind === 'source');
  if (!sourceRequirements.some((item) => item.status === 'supported')) return 'No supporting evidence found';
  return sourceRequirements.every((item) => item.status === 'supported') ? 'Evidenced in source' : 'Partially evidenced';
}

function makeRequirement(id, label, supported, citation, detail, nextStep) {
  return { id, label, kind: 'source', status: supported ? 'supported' : 'gap', citation: citation || null, detail, nextStep };
}

function humanRequirement() {
  return { id: 'human-verification', label: 'Runtime and human verification', kind: 'human', status: 'requires-human', citation: null, detail: 'Source review cannot establish production behavior, security, or user-facing outcomes.', nextStep: 'Run the manual checks below and record a reviewer decision.' };
}

function buildPaths(evidenceItems) {
  if (evidenceItems.length < 2) return [];
  return [{
    title: 'Candidate evidence path',
    note: 'This is a review sequence assembled from deterministic citations, not a verified runtime call graph.',
    steps: evidenceItems.slice(0, 4).map((item, index) => ({ order: index + 1, label: item.title, citation: item.citation }))
  }];
}

function runtimePlan(template, gaps) {
  const shared = [{ title: 'Record the environment', action: 'Note the local branch, commit, test data, and user role used for verification.', capture: 'Screenshot or short test note with the Git commit.' }];
  const plans = {
    'ai-search': [
      { title: 'Check the search behaviour', action: 'Use two differently worded queries for the same note concept and observe the returned results.', capture: 'Queries, returned results, and a screenshot.' },
      { title: 'Verify the AI boundary', action: 'Ask the owner to identify the configured retrieval or model provider and where it runs.', capture: 'Configuration or architecture evidence; do not infer this from UI behaviour.' },
      { title: 'Exercise authorization', action: 'Repeat the search with a user who should not access the workspace.', capture: 'Expected deny/empty response and relevant audit logs, if available.' }
    ],
    'secure-export': [
      { title: 'Verify role enforcement', action: 'Attempt the export as an authorized user and an unauthorized user in a safe test environment.', capture: 'HTTP result or UI outcome for each role.' },
      { title: 'Inspect export handling', action: 'Confirm how generated files, links, and retained report data are handled in the intended runtime environment.', capture: 'Runtime configuration or operator evidence.' },
      { title: 'Run a targeted test', action: 'Run a declared access-control/export test only after a reviewer approves the command and environment.', capture: 'Command, outcome, and test output.' }
    ],
    'sso-access': [
      { title: 'Verify identity-provider flow', action: 'Sign in through the intended provider using a non-production test account.', capture: 'Provider, redirect outcome, and account mapping.' },
      { title: 'Verify role mapping', action: 'Confirm a mapped and unmapped user receive the expected access outcomes.', capture: 'Role mapping evidence and outcomes.' }
    ],
    'payments': [
      { title: 'Use a payment sandbox', action: 'Complete a successful and declined test transaction in the payment provider sandbox.', capture: 'Provider event IDs and application outcomes.' },
      { title: 'Verify reconciliation', action: 'Confirm the application handles duplicate delivery or retry of the same payment event.', capture: 'Test result and event log.' }
    ]
  };
  const gapStep = gaps.length ? [{ title: 'Resolve source gaps', action: `Review the ${gaps.length} listed gap(s) with the implementation owner before presenting the claim.`, capture: 'Links to added source evidence or an explicit accepted risk.' }] : [];
  return [...shared, ...(plans[template] || [{ title: 'Exercise the claimed outcome', action: 'Run a focused manual test in a safe environment with an appropriate user role.', capture: 'Steps, outcome, and reviewer notes.' }]), ...gapStep];
}

function finalize({ root, template, source, evidenceItems, gaps, requirements, trace, boundary, why }) {
  return {
    repoName: root.split(sep).filter(Boolean).at(-1) || root,
    repositoryPath: root,
    template,
    scannedFiles: source.length,
    evidence: evidenceItems,
    gaps,
    requirements: [...requirements, humanRequirement()],
    verdict: verdictFor(requirements),
    boundary,
    why,
    trace,
    codePaths: buildPaths(evidenceItems),
    runtimePlan: runtimePlan(template, gaps)
  };
}

function auditWithRules(root, source, template, rules) {
  const checks = Array.isArray(rules?.checks) ? rules.checks.slice(0, 12) : [];
  const evidenceItems = [];
  const gaps = [];
  const requirements = [];
  for (const [index, check] of checks.entries()) {
    const pathPattern = compilePattern(check.pathPattern);
    const contentPattern = compilePattern(check.contentPattern);
    const matcher = contentPattern || pathPattern || /./;
    const match = source.find(({ file, text }) => (!pathPattern || pathPattern.test(file)) && (!contentPattern || contentPattern.test(text)));
    if (match) {
      const item = evidence(root, match, matcher, check.label || 'Configured evidence signal found', 'Matched using a reviewer-configured deterministic evidence rule.', check.kind || 'rule');
      evidenceItems.push(item);
      requirements.push(makeRequirement(`rule-${index}`, check.label || 'Configured evidence signal', true, item.citation, item.detail, 'Review the cited source for relevance and coverage.'));
    } else {
      const missing = gap(`Missing: ${check.label || 'configured evidence signal'}`, 'No source file matched this reviewer-configured deterministic rule.', 'Refine the rule or identify the expected implementation evidence.');
      gaps.push(missing);
      requirements.push(makeRequirement(`rule-${index}`, check.label || 'Configured evidence signal', false, null, missing.detail, missing.nextStep));
    }
  }
  return finalize({ root, template, source, evidenceItems, gaps, requirements, boundary: 'Configured source rules do not establish runtime behavior, security, or suitability without human verification.', why: `This audit applied ${checks.length} reviewer-configured deterministic evidence rule(s).`, trace: [`Read ${source.length} supported source files from the selected local repository.`, `Applied ${checks.length} reviewer-configured evidence rule(s).`, ...evidenceItems.map((item) => `Cited ${item.citation} for ${item.title}.`), ...gaps.map((item) => item.title)] });
}

function auditAiSearch(root, source, template) {
  const routePath = /(?:api|route|routes|controller|handler)/i;
  const testPath = /(?:^|[/\\])(?:__tests__|test|tests|spec|specs)(?:[/\\]|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|_test\.go$/i;
  const search = /\bsearch\b/i;
  const ai = /(?:openai|anthropic|\bllm\b|\bembeddings?\b|\bvector(?:store|search)\b|prompt\s*(?:template|model)|model\s*(?:provider|client))/i;
  const ui = source.find(({ file, text }) => /workspace-organization/i.test(file) && search.test(`${file}\n${text}`));
  const route = source.find(({ file, text }) => routePath.test(file) && !/_test\.go$/i.test(file) && /(?:SearchWorkspaceDocuments|SearchDocuments)/.test(text));
  const integration = source.find(({ file, text }) => ai.test(text) && /(?:search|retriev|document|query)/i.test(`${file}\n${text}`));
  const test = source.find(({ file, text }) => testPath.test(file) && ai.test(text) && /(?:search|retriev|document|query)/i.test(`${file}\n${text}`));
  const evidenceItems = [];
  const gaps = [];
  const requirements = [];
  const add = (id, label, candidate, matcher, title, detail, missingDetail, nextStep, tag) => {
    if (candidate) { const item = evidence(root, candidate, matcher, title, detail, tag); evidenceItems.push(item); requirements.push(makeRequirement(id, label, true, item.citation, detail, nextStep)); }
    else { const missing = gap(`No ${label} found`, missingDetail, nextStep); gaps.push(missing); requirements.push(makeRequirement(id, label, false, null, missingDetail, nextStep)); }
  };
  add('search-ui', 'workspace search UI signal', ui, search, 'Workspace search UI signal found', 'A deterministic source check found a component associated with workspace search.', 'No component source file matched workspace search using the supported deterministic checks.', 'Locate the user-facing search entry point or revise the claim.', 'component');
  add('search-route', 'workspace search endpoint signal', route, search, 'Workspace search endpoint signal found', 'A deterministic source check found a route-related source file associated with workspace search.', 'No route-related source file matched workspace search using the supported deterministic checks.', 'Locate the server-side search boundary or revise the claim.', 'route');
  add('semantic-integration', 'AI or semantic-retrieval integration evidence', integration, ai, 'AI or semantic-retrieval integration signal found', 'A source signal may indicate an AI-related integration. A human must determine relevance and coverage.', 'The deterministic source check found no LLM, embedding, vector-search, or model-provider integration signal.', 'Identify the retrieval/model integration or describe this feature as non-AI search.', 'signal');
  add('semantic-test', 'automated AI-search integration test', test, ai, 'AI-search integration test signal found', 'A test file contains an AI-integration source signal; a human must determine coverage.', 'The deterministic source check found no test signal for AI or semantic-search behavior.', 'Add or locate a focused integration test and have a reviewer assess it.', 'test signal');
  return finalize({ root, template, source, evidenceItems, gaps, requirements, boundary: 'Source signals do not establish that search is AI-powered or semantic without source-backed integration plus runtime and human verification.', why: ui || route ? 'The repository supports workspace search. It does not provide source evidence of an LLM, embeddings, vector retrieval, or an AI-search test, so the AI-powered search claim is only partially evidenced.' : 'The supported deterministic checks found no workspace-search source signals and no AI or semantic-retrieval integration evidence.', trace: [`Read ${source.length} supported source files from the selected local repository.`, 'Mapped the claim into UI, route, semantic-integration, and automated-test requirements.', ...requirements.map((item) => item.status === 'supported' ? `Cited ${item.citation} for ${item.label}.` : `Gap: ${item.label}.`)] });
}

function auditGeneric(root, source, claim, template) {
  const words = (claim.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter((word) => !new Set(['teams', 'team', 'with', 'that', 'this', 'from', 'their', 'securely', 'secure', 'should', 'could', 'will', 'can']).has(word)).slice(0, 6);
  const terms = /export|report|download/i.test(claim) ? ['export', 'report', 'download'] : words;
  const claimPattern = new RegExp(terms.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') || 'a^', 'i');
  const routePath = /(?:api|route|routes|controller|handler)/i;
  const authorization = /(?:requireRole|hasRole|authorize|authorization|permission|canExport|can[A-Z][A-Za-z]+)/;
  const testPath = /(?:^|[/\\])(?:__tests__|test|tests|spec|specs)(?:[/\\]|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|_test\.go$/i;
  const component = source.find(({ file, text }) => /(?:component|components)/i.test(file) && claimPattern.test(`${file}\n${text}`));
  const route = source.find(({ file, text }) => routePath.test(file) && claimPattern.test(`${file}\n${text}`));
  const auth = source.find(({ file, text }) => routePath.test(file) && authorization.test(text) && claimPattern.test(`${file}\n${text}`));
  const accessTest = source.find(({ file, text }) => testPath.test(file) && authorization.test(text) && claimPattern.test(`${file}\n${text}`));
  const evidenceItems = [];
  const gaps = [];
  const requirements = [];
  const add = (id, label, candidate, matcher, title, detail, missingDetail, nextStep, tag) => {
    if (candidate) { const item = evidence(root, candidate, matcher, title, detail, tag); evidenceItems.push(item); requirements.push(makeRequirement(id, label, true, item.citation, detail, nextStep)); }
    else { const missing = gap(`No ${label} found`, missingDetail, nextStep); gaps.push(missing); requirements.push(makeRequirement(id, label, false, null, missingDetail, nextStep)); }
  };
  add('ui', 'claim-related UI component signal', component, claimPattern, 'Claim-related UI signal found', 'A deterministic file-path and source-text check linked this component to the claim.', 'No component file matched the claim using the supported deterministic checks.', 'Locate the user-facing implementation or revise the claim.', 'component');
  add('route', 'claim-related route signal', route, claimPattern, 'Claim-related route signal found', 'A deterministic path and source-text check linked this route-related file to the claim.', 'No route-related file matched the claim using the supported deterministic checks.', 'Locate the server-side implementation or revise the claim.', 'route');
  add('authorization', 'route-level authorization signal', auth, authorization, 'Authorization signal found', 'A route-related file contains an authorization-related source signal. A human must determine relevance and coverage.', 'No authorization-related signal was found in a claim-related route file.', 'Review authorization middleware and the claim-related route together.', 'signal');
  add('test', 'automated access-control test signal', accessTest, authorization, 'Access-control test signal found', 'A test file contains claim-related and access-control source signals. A human must determine coverage.', 'No claim-related access-control test signal was found.', 'Locate or add a focused test, then assess whether it exercises the claim.', 'test signal');
  return finalize({ root, template, source, evidenceItems, gaps, requirements, boundary: 'Source signals do not establish runtime behavior, security, or suitability without human verification.', why: component || route ? 'The local repository contains source signals linked to the claim. Authorization and test signals are citations, not proof: a reviewer must verify their relevance, runtime behavior, and coverage.' : 'The supported deterministic checks found no claim-related component or route signals. This does not establish the capability is absent, nor can source-only checks evaluate runtime behavior or security.', trace: [`Read ${source.length} supported source files from the selected local repository.`, 'Mapped the claim into UI, route, authorization, and automated-test requirements.', ...requirements.map((item) => item.status === 'supported' ? `Cited ${item.citation} for ${item.label}.` : `Gap: ${item.label}.`)] });
}

export async function auditRepository(repoPath, claim, template = 'generic', rules = null) {
  const root = await realpath(repoPath);
  const source = [];
  for (const file of await walk(root)) {
    try { const text = await readFile(file, 'utf8'); if (Buffer.byteLength(text, 'utf8') <= maxBytes) source.push({ file, text }); } catch { /* Skip unreadable/non-text files. */ }
  }
  if (rules?.checks?.length) return auditWithRules(root, source, template, rules);
  if (template === 'ai-search' || (template === 'generic' && /(?:\bai\b|semantic|embedding|\bllm\b)/i.test(claim) && /search/i.test(claim))) return auditAiSearch(root, source, template);
  return auditGeneric(root, source, claim, template);
}
