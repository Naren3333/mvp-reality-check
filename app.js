const byId = (id) => document.getElementById(id);
const intake = byId('intake'); const progress = byId('progress'); const results = byId('results');
const auditButton = byId('auditButton'); const rerunButton = byId('rerunButton'); const claimInput = byId('claim'); const claimTemplate = byId('claimTemplate');
const stages = [...document.querySelectorAll('.stages li')]; const repoButton = byId('repoButton'); const repoPicker = byId('repoPicker'); const useDemo = byId('useDemo'); const chooseFolder = byId('chooseFolder'); const choosePath = byId('choosePath'); const chooseGitHub = byId('chooseGitHub'); const folderInput = byId('folderInput'); const pathEntry = byId('pathEntry'); const githubEntry = byId('githubEntry'); const repoPathInput = byId('repoPathInput'); const githubUrlInput = byId('githubUrlInput'); const usePath = byId('usePath'); const useGitHub = byId('useGitHub'); const repoName = byId('repoName'); const repoMeta = byId('repoMeta');
const documentInput = byId('documentInput'); const documentList = byId('documentList'); const documentHint = byId('documentHint');
const resultTitle = byId('results-title'); const verdictText = byId('verdictText'); const boundaryText = byId('boundaryText'); const whyCopy = byId('whyCopy'); const evidenceCards = byId('evidenceCards'); const gapCards = byId('gapCards'); const requirementsList = byId('requirementsList'); const evidenceGraph = byId('evidenceGraph'); const traceList = byId('traceList'); const traceCount = byId('traceCount');
const explorer = byId('explorer'); const explorerTitle = byId('explorerTitle'); const explorerCitation = byId('explorerCitation'); const explorerCode = byId('explorerCode'); const explorerNote = byId('explorerNote'); const pathSection = byId('pathSection'); const codePaths = byId('codePaths'); const runtimePlanList = byId('runtimePlanList'); const documentEvidenceSection = byId('documentEvidenceSection'); const documentEvidenceCards = byId('documentEvidenceCards');
const history = byId('history'); const historyList = byId('historyList'); const reviewQueue = byId('reviewQueue'); const reviewQueueList = byId('reviewQueueList'); const copyPrompt = byId('copyPrompt'); const exportEvidence = byId('exportEvidence'); const exportMarkdown = byId('exportMarkdown'); const reviewDecision = byId('reviewDecision'); const reviewOwner = byId('reviewOwner'); const reviewState = byId('reviewState'); const reviewDueDate = byId('reviewDueDate'); const reviewNotes = byId('reviewNotes'); const saveReview = byId('saveReview'); const reviewStatus = byId('reviewStatus'); const runClaim = byId('runClaim'); const gitContext = byId('gitContext'); const comparisonPanel = byId('comparisonPanel'); const comparisonText = byId('comparisonText'); const changedFiles = byId('changedFiles'); const testDiscovery = byId('testDiscovery'); const testCommands = byId('testCommands'); const testNote = byId('testNote'); const sandboxRunner = byId('sandboxRunner'); const sandboxCommand = byId('sandboxCommand'); const allowSetupNetwork = byId('allowSetupNetwork'); const runSandboxTest = byId('runSandboxTest'); const dockerStatus = byId('dockerStatus'); const sandboxResult = byId('sandboxResult'); const sandboxResultTitle = byId('sandboxResultTitle'); const sandboxResultMeta = byId('sandboxResultMeta'); const sandboxResultLog = byId('sandboxResultLog'); const sandboxResultBoundary = byId('sandboxResultBoundary'); const editRules = byId('editRules'); const rulesPanel = byId('rulesPanel'); const rulesInput = byId('rulesInput'); const saveRules = byId('saveRules'); const rulesStatus = byId('rulesStatus');
const localRunner = byId('localRunner'); const localCommand = byId('localCommand'); const confirmTrustedLocal = byId('confirmTrustedLocal'); const runLocalTest = byId('runLocalTest'); const localRunStatus = byId('localRunStatus'); const localResult = byId('localResult'); const localResultTitle = byId('localResultTitle'); const localResultMeta = byId('localResultMeta'); const localResultLog = byId('localResultLog'); const localResultBoundary = byId('localResultBoundary');

const defaultRepositoryPath = 'C:\\Users\\Naren\\Documents\\PROJECTSS\\SYNCSPACE';
let source = { type: 'server', path: defaultRepositoryPath };
let lastAudit = null;
let supplementaryDocuments = [];
let lastSandboxRun = null;

const demoAudit = {
  repoName: 'syncspace', template: 'ai-search',
  evidence: [
    { citation: 'apps/web/components/app/workspace-organization.tsx:67', title: 'Workspace search UI signal found', detail: 'Source contains an interface that calls the workspace search operation.', tag: 'component', excerpt: 'searchDocuments({ query, workspaceId })' },
    { citation: 'apps/api/internal/http/handlers/organization.go:495', title: 'Workspace search endpoint signal found', detail: 'Source contains a membership-scoped workspace search handler.', tag: 'route', excerpt: 'func (h *Handler) SearchWorkspaceDocuments(...)' }
  ],
  gaps: [
    { title: 'No AI or semantic-retrieval integration evidence found', detail: 'The cited search implementation does not establish source evidence of an LLM, embeddings, vector retrieval, or a model provider.', nextStep: 'Identify the retrieval/model integration or describe this as non-AI search.' },
    { title: 'No automated AI-search integration test found', detail: 'No test citation was found to demonstrate AI-assisted or semantic-search behaviour.', nextStep: 'Add or locate a focused integration test and have a reviewer assess it.' }
  ],
  requirements: [
    { id: 'search-ui', label: 'Workspace search UI signal', kind: 'source', status: 'supported', citation: 'apps/web/components/app/workspace-organization.tsx:67', detail: 'A source component is associated with workspace search.' },
    { id: 'search-route', label: 'Workspace search endpoint signal', kind: 'source', status: 'supported', citation: 'apps/api/internal/http/handlers/organization.go:495', detail: 'A server-side search handler is cited.' },
    { id: 'semantic-integration', label: 'AI or semantic-retrieval integration evidence', kind: 'source', status: 'gap', detail: 'No model, embedding, vector retrieval, or provider signal is cited.', nextStep: 'Locate the integration or revise the claim.' },
    { id: 'semantic-test', label: 'Automated AI-search integration test', kind: 'source', status: 'gap', detail: 'No focused test signal is cited.', nextStep: 'Add or locate a focused integration test.' },
    { id: 'human-verification', label: 'Runtime and human verification', kind: 'human', status: 'requires-human', detail: 'Source review cannot establish production behaviour, security, or user-facing outcomes.', nextStep: 'Run the manual checks and record a reviewer decision.' }
  ],
  codePaths: [{ title: 'Candidate evidence path', note: 'This is a review sequence assembled from deterministic citations, not a verified runtime call graph.', steps: [{ order: 1, label: 'Workspace search UI', citation: 'apps/web/components/app/workspace-organization.tsx:67' }, { order: 2, label: 'Workspace search endpoint', citation: 'apps/api/internal/http/handlers/organization.go:495' }] }],
  runtimePlan: [{ title: 'Record the environment', action: 'Note the branch, commit, test data, and user role used for verification.', capture: 'Screenshot or test note with the Git commit.' }, { title: 'Check search behaviour', action: 'Use two differently worded queries for the same note concept and observe returned results.', capture: 'Queries, results, and a screenshot.' }, { title: 'Verify the AI boundary', action: 'Ask the owner to identify the configured retrieval or model provider and where it runs.', capture: 'Configuration or architecture evidence; do not infer from UI behaviour.' }, { title: 'Exercise authorization', action: 'Repeat the search with a user who should not access the workspace.', capture: 'Expected deny/empty response and relevant logs, if available.' }],
  verdict: 'Partially evidenced', boundary: 'Do not present SyncSpace search as AI-powered or semantic without source-backed integration plus runtime and human verification.', why: 'The source supports workspace-scoped text search. It does not provide evidence of an AI model, embeddings, vector retrieval, or an AI-search test. This is a source-evidence assessment, not proof of runtime behaviour or an AI capability.',
  trace: ['Mapped the claim into UI, route, semantic-integration, and automated-test requirements.', 'Cited the workspace search UI.', 'Cited the workspace search endpoint.', 'No AI or semantic-retrieval integration was cited.', 'No automated AI-search integration test was cited.']
};

const defaultRules = {
  'ai-search': { checks: [{ label: 'Workspace search UI', kind: 'component', pathPattern: 'workspace-organization', contentPattern: 'search' }, { label: 'AI or semantic retrieval integration', kind: 'integration', pathPattern: '', contentPattern: 'openai|anthropic|\\bllm\\b|embedding|vector' }, { label: 'AI-search test', kind: 'test', pathPattern: 'test|spec', contentPattern: 'openai|anthropic|\\bllm\\b|embedding|vector' }] },
  'secure-export': { checks: [{ label: 'Export UI', kind: 'component', pathPattern: 'components?', contentPattern: 'export|report' }, { label: 'Export route', kind: 'route', pathPattern: 'api|route|handler|controller', contentPattern: 'export|report' }, { label: 'Route authorization', kind: 'authorization', pathPattern: 'api|route|handler|controller', contentPattern: 'authorize|permission|requireRole' }] },
  'sso-access': { checks: [{ label: 'Identity provider integration', kind: 'integration', pathPattern: '', contentPattern: 'saml|oidc|oauth|auth0|okta|azure' }, { label: 'Role or group mapping', kind: 'authorization', pathPattern: '', contentPattern: 'role|group|permission' }] },
  payments: { checks: [{ label: 'Payment provider integration', kind: 'integration', pathPattern: '', contentPattern: 'stripe|paypal|adyen|payment' }, { label: 'Payment event handling', kind: 'route', pathPattern: 'webhook|route|handler|controller', contentPattern: 'payment|invoice|checkout' }] },
  generic: { checks: [] }
};

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
function resetStages() { stages.forEach((stage) => stage.classList.remove('active', 'done')); }
function sourceFileLabel(file) { return file.webkitRelativePath || file.name; }
function statusLabel(status) { return status === 'supported' ? 'Cited' : status === 'gap' ? 'Gap' : 'Human review'; }

function normalizeAudit(audit) {
  const requirements = audit.requirements || [
    ...audit.evidence.map((item, index) => ({ id: `e-${index}`, label: item.title, kind: 'source', status: 'supported', citation: item.citation, detail: item.detail })),
    ...audit.gaps.map((item, index) => ({ id: `g-${index}`, label: item.title, kind: 'source', status: 'gap', detail: item.detail, nextStep: item.nextStep })),
    { id: 'human-verification', label: 'Runtime and human verification', kind: 'human', status: 'requires-human', detail: 'Source review cannot establish runtime behaviour, security, or user-facing outcomes.', nextStep: 'Run the manual checks and record a reviewer decision.' }
  ];
  return { ...audit, requirements, codePaths: audit.codePaths || [], runtimePlan: audit.runtimePlan || [{ title: 'Exercise the claimed outcome', action: 'Run a focused manual test in a safe environment with an appropriate user role.', capture: 'Steps, outcome, and reviewer notes.' }], documentEvidence: audit.documentEvidence || supplementaryDocuments.map((item) => ({ name: item.name, kind: 'reviewer-supplied document', excerpt: item.text.replace(/\s+/g, ' ').slice(0, 300) })) };
}

function renderRequirements(requirements) {
  requirementsList.innerHTML = requirements.map((item) => `<article class="requirement ${escapeHtml(item.status)}"><span class="requirement-state">${item.status === 'supported' ? '✓' : item.status === 'gap' ? '!' : '◎'}</span><div><div class="requirement-title"><h4>${escapeHtml(item.label)}</h4><span>${statusLabel(item.status)}</span></div><p>${escapeHtml(item.detail)}</p>${item.citation ? `<code>${escapeHtml(item.citation)}</code>` : ''}${item.nextStep ? `<small>Next: ${escapeHtml(item.nextStep)}</small>` : ''}</div></article>`).join('');
}

function renderGraph(claim, requirements) {
  evidenceGraph.innerHTML = `<div class="graph-claim"><span>Claim</span><strong>${escapeHtml(claim)}</strong></div><div class="graph-branch">${requirements.map((item) => `<article class="graph-node ${escapeHtml(item.status)}"><span class="graph-line"></span><small>${statusLabel(item.status)}</small><strong>${escapeHtml(item.label)}</strong>${item.citation ? `<code>${escapeHtml(item.citation)}</code>` : `<p>${escapeHtml(item.nextStep || 'Needs reviewer evidence.')}</p>`}</article>`).join('')}</div>`;
}

function renderCards(audit) {
  evidenceCards.innerHTML = audit.evidence.map((item, index) => `<button class="evidence-card" type="button" data-evidence-index="${index}"><span class="status-icon evidence-icon">↗</span><span><p class="citation">${escapeHtml(item.citation)}</p><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.detail)}</p></span><span class="source-tag">${escapeHtml(item.tag)}</span></button>`).join('') || '<article class="evidence-card empty-card"><span class="status-icon evidence-icon">–</span><span><p class="citation">No citation</p><h4>No expected source evidence found</h4><p>No supported deterministic source signal matched the entered claim.</p></span></article>';
  gapCards.innerHTML = audit.gaps.map((item) => `<article class="gap-card"><span class="status-icon gap-icon">!</span><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.detail)}</p>${item.nextStep ? `<small>Next: ${escapeHtml(item.nextStep)}</small>` : ''}</div></article>`).join('') || '<article class="gap-card"><span class="status-icon gap-icon">✓</span><div><h4>No deterministic source gaps found</h4><p>Runtime and human review are still required.</p></div></article>';
}

function renderTrace(trace) { traceCount.textContent = `${trace.length} deterministic checks`; traceList.innerHTML = trace.map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(item)}</li>`).join(''); }
function renderPaths(paths) { if (!paths.length) { pathSection.hidden = true; return; } pathSection.hidden = false; codePaths.innerHTML = paths.map((path) => `<article class="code-path"><h4>${escapeHtml(path.title)}</h4><p>${escapeHtml(path.note)}</p><ol>${path.steps.map((step) => `<li><span>${step.order}</span><div><strong>${escapeHtml(step.label)}</strong><code>${escapeHtml(step.citation)}</code></div></li>`).join('')}</ol></article>`).join(''); }
function renderRuntimePlan(plan) { runtimePlanList.innerHTML = plan.map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.action)}</p><small>Capture: ${escapeHtml(item.capture)}</small></div></li>`).join(''); }
function renderDocuments(docs) { if (!docs.length) { documentEvidenceSection.hidden = true; return; } documentEvidenceSection.hidden = false; documentEvidenceCards.innerHTML = docs.map((item) => `<article><span>DOC</span><div><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.excerpt)}</p><small>${escapeHtml(item.kind)}</small></div></article>`).join(''); }

async function configureSandboxRunner(audit) {
  const commands = audit.testDiscovery?.commands || [];
  if (!audit.repositoryPath || !commands.length) { sandboxRunner.hidden = true; return; }
  sandboxRunner.hidden = false;
  sandboxCommand.innerHTML = commands.map((item) => `<option value="${escapeHtml(item.command)}">${escapeHtml(item.command)} — ${escapeHtml(item.manifest)}</option>`).join('');
  sandboxResult.hidden = true;
  dockerStatus.textContent = 'Checking Docker Desktop availability…';
  try {
    const response = await fetch('/api/docker-status'); const status = await response.json();
    dockerStatus.textContent = status.available ? `Docker engine ready (v${status.version}). Test execution stays isolated and network-disabled after setup.` : (status.note || 'Docker Desktop is unavailable.');
    runSandboxTest.disabled = !status.available;
  } catch { dockerStatus.textContent = 'Docker status could not be checked.'; runSandboxTest.disabled = true; }
}

function configureLocalRunner(audit) {
  const commands = audit.testDiscovery?.commands || [];
  if (source.type !== 'server' || !audit.repositoryPath || !commands.length) { localRunner.hidden = true; return; }
  localRunner.hidden = false;
  localCommand.innerHTML = commands.map((item) => `<option value="${escapeHtml(item.command)}">${escapeHtml(item.command)} — ${escapeHtml(item.manifest)}</option>`).join('');
  confirmTrustedLocal.checked = false;
  runLocalTest.disabled = true;
  localResult.hidden = true;
  localRunStatus.textContent = 'Choose a declared command and explicitly confirm local execution.';
}

function renderSandboxResult(result) {
  lastSandboxRun = result;
  sandboxResult.hidden = false;
  sandboxResultTitle.textContent = result.status === 'passed' ? 'Sandbox test passed' : result.status === 'failed' ? 'Sandbox test failed' : result.status === 'unavailable' ? 'Docker unavailable' : 'Sandbox run needs attention';
  sandboxResultMeta.textContent = `${result.command || 'No command'}${result.test?.exitCode !== null && result.test?.exitCode !== undefined ? ` · exit ${result.test.exitCode}` : ''}`;
  sandboxResultLog.textContent = result.test?.log || result.setup?.log || 'No command output was captured.';
  sandboxResultBoundary.textContent = result.boundary || 'A sandbox result is bounded runtime evidence, not proof of production behaviour or security.';
}

function selectEvidence(index) {
  const item = lastAudit?.audit.evidence[index];
  if (!item) return;
  explorer.hidden = false; explorerTitle.textContent = item.title; explorerCitation.textContent = item.citation; explorerCode.textContent = item.excerpt || 'No line excerpt was available for this citation.'; explorerNote.textContent = 'Excerpt is local source context around the deterministic match. It is not a proof of runtime behaviour or security.'; explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function reviewStorageKey(audit) { return `mvp-review:${audit.auditId || `${claimInput.value}:${audit.repoName}`}`; }
function populateReview(audit) { const saved = localStorage.getItem(reviewStorageKey(audit)); if (!saved) { reviewDecision.value = ''; reviewOwner.value = ''; reviewState.value = 'Open'; reviewDueDate.value = ''; reviewNotes.value = ''; reviewStatus.textContent = ''; return; } try { const review = JSON.parse(saved); reviewDecision.value = review.decision || ''; reviewOwner.value = review.owner || ''; reviewState.value = review.state || 'Open'; reviewDueDate.value = review.dueDate || ''; reviewNotes.value = review.notes || ''; reviewStatus.textContent = 'Saved reviewer decision loaded.'; } catch { /* Ignore malformed local review. */ } }

function renderAudit(rawAudit) {
  const audit = normalizeAudit(rawAudit); const claim = claimInput.value.trim() || 'Untitled product claim';
  resultTitle.textContent = claim; runClaim.textContent = `“${claim}”`; verdictText.innerHTML = `<span class="verdict-dot"></span>${escapeHtml(audit.verdict)}`; boundaryText.innerHTML = `<span>Boundary</span>${escapeHtml(audit.boundary)}`; whyCopy.textContent = audit.why;
  renderRequirements(audit.requirements); renderGraph(claim, audit.requirements); renderCards(audit); renderTrace(audit.trace || []); renderPaths(audit.codePaths); renderRuntimePlan(audit.runtimePlan); renderDocuments(audit.documentEvidence);
  explorer.hidden = true;
  if (audit.git) { const comparison = audit.comparison ? ` · compared with ${audit.comparison.baselineCommit || 'previous local audit'}: +${audit.comparison.newEvidence.length} / -${audit.comparison.removedEvidence.length} citations` : ''; gitContext.innerHTML = `<strong>Git context</strong> ${escapeHtml(audit.git.branch)} @ ${escapeHtml(audit.git.commit)} · ${audit.git.dirty ? 'working tree has changes' : 'working tree clean'}${escapeHtml(comparison)}`; gitContext.hidden = false; } else gitContext.hidden = true;
  if (audit.comparison) { const diff = audit.comparison.gitDiff; comparisonText.textContent = `Compared with ${audit.comparison.baselineCommit || 'the previous saved audit'}: ${audit.comparison.newEvidence.length} citation(s) added, ${audit.comparison.removedEvidence.length} removed; prior verdict was ${audit.comparison.previousVerdict}. ${diff?.note || ''}`; changedFiles.innerHTML = diff?.files?.map((file) => `<li><code>${escapeHtml(file)}</code></li>`).join('') || ''; comparisonPanel.hidden = false; } else comparisonPanel.hidden = true;
  if (audit.testDiscovery) { testCommands.innerHTML = audit.testDiscovery.commands.map((item) => `<li><code>${escapeHtml(item.command)}</code> <span>${escapeHtml(item.manifest)} — ${escapeHtml(item.script)}</span></li>`).join('') || '<li>No declared test, e2e, or check script discovered.</li>'; testNote.textContent = audit.testDiscovery.note; testDiscovery.hidden = false; configureSandboxRunner(audit); configureLocalRunner(audit); } else { testDiscovery.hidden = true; sandboxRunner.hidden = true; localRunner.hidden = true; }
  lastAudit = { claim, source, audit }; lastSandboxRun = null; populateReview(audit);
}

async function inspectLocalFiles(files) {
  const readable = await Promise.all([...files].filter((file) => /\.(?:[cm]?[jt]sx?|vue|svelte|py|rb|go|java|cs)$/i.test(file.name) && file.size <= 1_000_000).slice(0, 250).map(async (file) => ({ path: sourceFileLabel(file), text: await file.text() })));
  const terms = (claimInput.value.toLowerCase().match(/[a-z]{3,}/g) || []).slice(0, 6); const claimPattern = new RegExp(terms.join('|') || 'a^', 'i'); const routePath = /api|route|controller|handler/i; const auth = /requireRole|hasRole|authorize|authoriz|permission/i; const test = /test|spec/i;
  const component = readable.find(({ path, text }) => /component|tsx|jsx|vue|svelte/i.test(path) && claimPattern.test(`${path}\n${text}`)); const route = readable.find(({ path, text }) => routePath.test(path) && claimPattern.test(`${path}\n${text}`)); const authorization = readable.find(({ path, text }) => routePath.test(path) && auth.test(text)); const accessTest = readable.find(({ path, text }) => test.test(path) && auth.test(text));
  const matches = [[component, 'Claim-related UI signal found', 'component'], [route, 'Claim-related route signal found', 'route'], [authorization, 'Authorization signal found', 'signal'], [accessTest, 'Access-control test signal found', 'test signal']]; const evidence = matches.filter(([item]) => item).map(([item, title, tag]) => ({ citation: item.path, title, detail: 'A browser-only deterministic source check linked this file to the requirement.', tag, excerpt: '' }));
  const gaps = matches.filter(([item]) => !item).map(([, title]) => ({ title: `No ${title.toLowerCase()}`, detail: 'The browser-only source check did not find this signal.', nextStep: 'Use a local repository path for the full review workflow.' }));
  const requirements = matches.map(([item, title], index) => ({ id: `browser-${index}`, label: title, kind: 'source', status: item ? 'supported' : 'gap', citation: item?.path || null, detail: item ? 'A browser-only deterministic signal was cited.' : 'No browser-only deterministic signal was found.', nextStep: item ? 'Review source relevance and coverage.' : 'Use a full local-path audit.' }));
  return { repoName: repoName.textContent, evidence, gaps, requirements, verdict: evidence.length === matches.length ? 'Evidenced in source' : evidence.length ? 'Partially evidenced' : 'No supporting evidence found', boundary: 'Browser-only source signals do not establish runtime behaviour, security, or suitability without human verification.', why: 'This browser-only check is limited to selected files and does not provide Git comparison, test discovery, or a persisted reviewer queue.', trace: [`Read ${readable.length} supported browser-selected files.`, 'Mapped the claim into UI, route, authorization, and test requirements.'], codePaths: [], runtimePlan: [{ title: 'Use a full local-path audit', action: 'Use the local repository path option to create a review-ready audit with Git context.', capture: 'Saved local audit record.' }] };
}

async function auditServerRepository() { const rules = JSON.parse(localStorage.getItem(`mvp-rules:${claimTemplate.value}`) || 'null'); const response = await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoPath: source.path, claim: claimInput.value.trim(), template: claimTemplate.value, rules, documents: supplementaryDocuments }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'The local repository audit could not be completed.'); return payload; }
async function auditGitHubRepository() { const rules = JSON.parse(localStorage.getItem(`mvp-rules:${claimTemplate.value}`) || 'null'); const response = await fetch('/api/github-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: source.url, claim: claimInput.value.trim(), template: claimTemplate.value, rules, documents: supplementaryDocuments }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'The public GitHub audit could not be completed.'); source = { type: 'server', path: payload.repositoryPath, remote: payload.remote }; repoName.textContent = payload.repoName; repoMeta.textContent = 'public GitHub shallow clone · local audit cache'; return payload; }
async function prepareAudit() { if (source.type === 'demo') return { ...demoAudit, documentEvidence: supplementaryDocuments.map((item) => ({ name: item.name, kind: 'reviewer-supplied document', excerpt: item.text.replace(/\s+/g, ' ').slice(0, 300) })) }; if (source.type === 'server') return auditServerRepository(); if (source.type === 'github') return auditGitHubRepository(); return inspectLocalFiles(source.files); }
function failedAudit(message) { return { repoName: repoName.textContent, evidence: [], gaps: [{ title: 'Audit could not complete', detail: message, nextStep: 'Check the local repository path and retry.' }], verdict: 'Requires runtime / human verification', boundary: 'No source conclusion should be drawn until the repository path and scan can be reviewed.', why: 'The local audit did not complete. The tool intentionally does not substitute demo evidence or invent a result.', trace: [message], requirements: [{ id: 'audit-failed', label: 'Source audit completed', kind: 'source', status: 'gap', detail: message, nextStep: 'Correct the local audit error and retry.' }], runtimePlan: [{ title: 'Resolve the audit error', action: 'Check the local repository path and server status, then re-run the audit.', capture: 'A completed source audit.' }] }; }

async function runAudit() { intake.hidden = true; results.hidden = true; progress.hidden = false; resetStages(); window.scrollTo({ top: 0, behavior: 'smooth' }); let audit; try { audit = await prepareAudit(); } catch (error) { audit = failedAudit(error instanceof Error ? error.message : 'The local source check failed.'); } renderAudit(audit); stages.forEach((stage, index) => window.setTimeout(() => { if (index > 0) stages[index - 1].classList.replace('active', 'done'); stage.classList.add('active'); }, index * 500)); window.setTimeout(async () => { stages.at(-1).classList.replace('active', 'done'); progress.hidden = true; results.hidden = false; results.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (source.type === 'server') { await loadHistory(); await loadReviewQueue(); } }, stages.length * 500 + 220); }

function closePicker() { repoPicker.hidden = true; repoButton.setAttribute('aria-expanded', 'false'); pathEntry.hidden = true; githubEntry.hidden = true; }
function renderSelectedDocuments() { if (!supplementaryDocuments.length) { documentList.hidden = true; documentHint.textContent = 'Attach a PR description, architecture note, or test report. These are labelled as reviewer-supplied context, never source proof.'; return; } documentList.hidden = false; documentHint.textContent = `${supplementaryDocuments.length} local document(s) will be included as supplementary context.`; documentList.innerHTML = supplementaryDocuments.map((item) => `<li><span>${escapeHtml(item.name)}</span><button type="button" data-remove-document="${escapeHtml(item.name)}">Remove</button></li>`).join(''); }
async function loadDocuments(files) { const accepted = [...files].filter((file) => file.size <= 24_000).slice(0, 5); supplementaryDocuments = await Promise.all(accepted.map(async (file) => ({ name: file.name, text: await file.text() }))); renderSelectedDocuments(); }
async function loadHistory() { try { const response = await fetch('/api/history'); const entries = await response.json(); if (!entries.length) return; historyList.innerHTML = entries.slice(0, 8).map((entry) => `<li><span>${escapeHtml(entry.claim)}<br><small>${escapeHtml(entry.repoName)} · ${new Date(entry.createdAt).toLocaleString()}${entry.documents?.length ? ` · ${entry.documents.length} document(s)` : ''}</small></span><strong>${escapeHtml(entry.verdict)}</strong></li>`).join(''); history.hidden = false; } catch { /* Browser-only mode has no history endpoint. */ } }
async function loadReviewQueue() { try { const response = await fetch('/api/reviews'); const entries = await response.json(); if (!entries.length) { reviewQueue.hidden = true; return; } reviewQueueList.innerHTML = entries.slice(0, 10).map((entry) => `<li><div><strong>${escapeHtml(entry.decision)}</strong><span>${escapeHtml(entry.claim)}</span><small>${escapeHtml(entry.repoName)}${entry.owner ? ` · ${escapeHtml(entry.owner)}` : ''}${entry.dueDate ? ` · due ${escapeHtml(entry.dueDate)}` : ''}</small></div><em class="queue-${escapeHtml(entry.state).toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(entry.state)}</em></li>`).join(''); reviewQueue.hidden = false; } catch { reviewQueue.hidden = true; } }
function currentReview() { return { auditId: lastAudit?.audit.auditId || '', claim: lastAudit?.claim || '', repoName: lastAudit?.audit.repoName || '', verdict: lastAudit?.audit.verdict || '', decision: reviewDecision.value, owner: reviewOwner.value, state: reviewState.value, dueDate: reviewDueDate.value, notes: reviewNotes.value }; }
function evidencePack() { if (!lastAudit) return null; return { claim: lastAudit.claim, repository: lastAudit.audit.repoName, remote: lastAudit.audit.remote || null, git: lastAudit.audit.git || null, verdict: lastAudit.audit.verdict, boundary: lastAudit.audit.boundary, requirements: lastAudit.audit.requirements, citedEvidence: lastAudit.audit.evidence, evidenceGaps: lastAudit.audit.gaps, codePaths: lastAudit.audit.codePaths, manualRuntimePlan: lastAudit.audit.runtimePlan, sandboxRun: lastSandboxRun, supplementaryDocuments: lastAudit.audit.documentEvidence || [], reviewerDecision: currentReview(), auditTrace: lastAudit.audit.trace, instruction: 'Use only this evidence pack. Explain the relevance and limits of cited evidence, summarise gaps, and identify questions for a human reviewer. Do not infer missing facts, choose the verdict, or claim production behaviour, security, or investability.' }; }
function download(content, type, name) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

repoButton.addEventListener('click', () => { repoPicker.hidden = !repoPicker.hidden; repoButton.setAttribute('aria-expanded', String(!repoPicker.hidden)); }); useDemo.addEventListener('click', () => { source = { type: 'demo', files: [] }; repoName.textContent = 'syncspace'; repoMeta.textContent = 'main · demo source profile'; closePicker(); }); chooseFolder.addEventListener('click', () => folderInput.click()); choosePath.addEventListener('click', () => { pathEntry.hidden = !pathEntry.hidden; repoPathInput.focus(); }); usePath.addEventListener('click', () => { const path = repoPathInput.value.trim(); if (!path) { repoPathInput.focus(); return; } source = { type: 'server', path }; repoName.textContent = path.split(/[\\/]/).filter(Boolean).at(-1) || 'local repository'; repoMeta.textContent = 'local repository path · source scan + Git context'; closePicker(); }); folderInput.addEventListener('change', () => { if (!folderInput.files.length) return; source = { type: 'browser', files: folderInput.files }; repoName.textContent = sourceFileLabel(folderInput.files[0]).split('/')[0] || 'local project'; repoMeta.textContent = `${folderInput.files.length} local files selected · browser-only scan`; closePicker(); }); document.addEventListener('click', (event) => { if (!event.target.closest('.field-group')) closePicker(); const remove = event.target.closest('[data-remove-document]'); if (remove) { supplementaryDocuments = supplementaryDocuments.filter((item) => item.name !== remove.dataset.removeDocument); renderSelectedDocuments(); } });
chooseGitHub.addEventListener('click', () => { pathEntry.hidden = true; githubEntry.hidden = !githubEntry.hidden; githubUrlInput.focus(); });
useGitHub.addEventListener('click', () => { const url = githubUrlInput.value.trim(); const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/i); if (!match) { githubUrlInput.focus(); return; } source = { type: 'github', url }; repoName.textContent = match[2].replace(/\.git$/i, ''); repoMeta.textContent = 'public GitHub URL · shallow clone on audit'; closePicker(); });
claimTemplate.addEventListener('change', () => { const claims = { 'ai-search': 'Study groups can search shared notes semantically with AI.', 'secure-export': 'Teams can export reports securely.', 'sso-access': 'Teams can sign in with SSO and receive the right workspace access.', payments: 'Teams can accept payments reliably.', generic: '' }; if (claims[claimTemplate.value]) claimInput.value = claims[claimTemplate.value]; }); editRules.addEventListener('click', () => { const value = localStorage.getItem(`mvp-rules:${claimTemplate.value}`); rulesInput.value = value || JSON.stringify(defaultRules[claimTemplate.value], null, 2); rulesPanel.hidden = !rulesPanel.hidden; }); saveRules.addEventListener('click', () => { try { const parsed = JSON.parse(rulesInput.value); if (!Array.isArray(parsed.checks)) throw new Error(); localStorage.setItem(`mvp-rules:${claimTemplate.value}`, JSON.stringify(parsed)); rulesStatus.textContent = 'Rules saved locally; the next local-path audit will use them.'; } catch { rulesStatus.textContent = 'Use valid JSON with a checks array.'; } }); documentInput.addEventListener('change', () => loadDocuments(documentInput.files)); evidenceCards.addEventListener('click', (event) => { const card = event.target.closest('[data-evidence-index]'); if (card) selectEvidence(Number(card.dataset.evidenceIndex)); }); auditButton.addEventListener('click', runAudit); rerunButton.addEventListener('click', () => { results.hidden = true; intake.hidden = false; intake.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
copyPrompt.addEventListener('click', async () => { const pack = evidencePack(); if (!pack) return; try { await navigator.clipboard.writeText(`${pack.instruction}\n\nEvidence pack:\n${JSON.stringify(pack, null, 2)}`); copyPrompt.textContent = 'Copied review prompt'; window.setTimeout(() => { copyPrompt.textContent = 'Copy Codex review prompt'; }, 1600); } catch { copyPrompt.textContent = 'Copy unavailable'; } }); exportEvidence.addEventListener('click', () => { const pack = evidencePack(); if (pack) download(JSON.stringify(pack, null, 2), 'application/json', 'mvp-reality-check-evidence-pack.json'); }); exportMarkdown.addEventListener('click', () => { const pack = evidencePack(); if (!pack) return; const markdown = `# MVP Reality Check review\n\n## Claim\n${pack.claim}\n\n## Verdict\n${pack.verdict}\n\n## Git\n${pack.git?.branch || 'Not recorded'} @ ${pack.git?.commit || 'Not recorded'}\n\n## Requirement checklist\n${pack.requirements.map((item) => `- [${item.status === 'supported' ? 'x' : ' '}] ${item.label}${item.citation ? ` — ${item.citation}` : ''}`).join('\n')}\n\n## Cited evidence\n${pack.citedEvidence.map((item) => `- ${item.citation}: ${item.title}`).join('\n') || '- None'}\n\n## Gaps\n${pack.evidenceGaps.map((item) => `- ${item.title}: ${item.nextStep || item.detail}`).join('\n') || '- None'}\n\n## Reviewer decision\n${pack.reviewerDecision.decision || 'Not recorded'}\nOwner: ${pack.reviewerDecision.owner || 'Not recorded'}\nDue: ${pack.reviewerDecision.dueDate || 'Not recorded'}\n\n${pack.reviewerDecision.notes || 'No rationale recorded.'}\n\n## Boundary\n${pack.boundary}\n`; download(markdown, 'text/markdown', 'mvp-reality-check-review.md'); }); saveReview.addEventListener('click', async () => { if (!lastAudit || !reviewDecision.value) { reviewStatus.textContent = 'Choose a decision before saving.'; return; } const review = currentReview(); localStorage.setItem(reviewStorageKey(lastAudit.audit), JSON.stringify(review)); if (source.type === 'server') { try { const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); reviewStatus.textContent = 'Decision saved to the local reviewer queue.'; await loadReviewQueue(); return; } catch (error) { reviewStatus.textContent = `Saved in this browser only: ${error.message}`; return; } } reviewStatus.textContent = 'Decision saved in this browser.'; });
runSandboxTest.addEventListener('click', async () => {
  if (!lastAudit || !sandboxCommand.value) return;
  runSandboxTest.disabled = true;
  runSandboxTest.textContent = 'Running isolated command…';
  try {
    const response = await fetch('/api/test-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoPath: lastAudit.audit.repositoryPath, repoName: lastAudit.audit.repoName, command: sandboxCommand.value, allowSetupNetwork: allowSetupNetwork.checked, claim: lastAudit.claim, auditId: lastAudit.audit.auditId }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sandbox test could not be completed.');
    renderSandboxResult(result);
  } catch (error) {
    renderSandboxResult({ status: 'failed', command: sandboxCommand.value, setup: { log: error instanceof Error ? error.message : 'Sandbox test could not be completed.' }, boundary: 'No runtime conclusion should be drawn from an incomplete sandbox run.' });
  } finally {
    runSandboxTest.disabled = false;
    runSandboxTest.textContent = 'Run selected command';
  }
});

confirmTrustedLocal.addEventListener('change', () => { runLocalTest.disabled = !confirmTrustedLocal.checked; });
runLocalTest.addEventListener('click', async () => {
  if (!lastAudit || !localCommand.value || !confirmTrustedLocal.checked) return;
  runLocalTest.disabled = true;
  runLocalTest.textContent = 'Running local command…';
  localRunStatus.textContent = 'The selected declared command is running in the local repository.';
  try {
    const response = await fetch('/api/local-test-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoPath: lastAudit.audit.repositoryPath, repoName: lastAudit.audit.repoName, command: localCommand.value, trustedLocal: true, claim: lastAudit.claim, auditId: lastAudit.audit.auditId }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The local command could not be completed.');
    lastSandboxRun = result;
    localResult.hidden = false;
    localResultTitle.textContent = result.status === 'passed' ? 'Local command passed' : 'Local command failed';
    localResultMeta.textContent = `${result.command}${result.test?.exitCode !== null && result.test?.exitCode !== undefined ? ` · exit ${result.test.exitCode}` : ''}`;
    localResultLog.textContent = result.test?.log || 'No command output was captured.';
    localResultBoundary.textContent = result.boundary;
    localRunStatus.textContent = 'The result is saved as bounded local execution evidence.';
  } catch (error) {
    localRunStatus.textContent = error instanceof Error ? error.message : 'The local command could not be completed.';
  } finally {
    runLocalTest.disabled = !confirmTrustedLocal.checked;
    runLocalTest.textContent = 'Run locally';
  }
});

renderSelectedDocuments(); loadHistory(); loadReviewQueue();
