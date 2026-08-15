const intake = document.getElementById('intake');
const progress = document.getElementById('progress');
const results = document.getElementById('results');
const auditButton = document.getElementById('auditButton');
const rerunButton = document.getElementById('rerunButton');
const claimInput = document.getElementById('claim');
const claimTemplate = document.getElementById('claimTemplate');
const stages = [...document.querySelectorAll('.stages li')];
const repoButton = document.getElementById('repoButton');
const repoPicker = document.getElementById('repoPicker');
const useDemo = document.getElementById('useDemo');
const chooseFolder = document.getElementById('chooseFolder');
const choosePath = document.getElementById('choosePath');
const folderInput = document.getElementById('folderInput');
const pathEntry = document.getElementById('pathEntry');
const repoPathInput = document.getElementById('repoPathInput');
const usePath = document.getElementById('usePath');
const repoName = document.getElementById('repoName');
const repoMeta = document.getElementById('repoMeta');
const resultTitle = document.getElementById('results-title');
const verdictText = document.getElementById('verdictText');
const boundaryText = document.getElementById('boundaryText');
const whyCopy = document.getElementById('whyCopy');
const evidenceCards = document.getElementById('evidenceCards');
const gapCards = document.getElementById('gapCards');
const traceList = document.getElementById('traceList');
const history = document.getElementById('history');
const historyList = document.getElementById('historyList');
const copyPrompt = document.getElementById('copyPrompt');
const exportEvidence = document.getElementById('exportEvidence');
const exportMarkdown = document.getElementById('exportMarkdown');
const reviewDecision = document.getElementById('reviewDecision');
const reviewNotes = document.getElementById('reviewNotes');
const saveReview = document.getElementById('saveReview');
const reviewStatus = document.getElementById('reviewStatus');
const runClaim = document.getElementById('runClaim');
const gitContext = document.getElementById('gitContext');
const comparisonPanel = document.getElementById('comparisonPanel'); const comparisonText = document.getElementById('comparisonText'); const testDiscovery = document.getElementById('testDiscovery'); const testCommands = document.getElementById('testCommands'); const testNote = document.getElementById('testNote');
const editRules = document.getElementById('editRules'); const rulesPanel = document.getElementById('rulesPanel'); const rulesInput = document.getElementById('rulesInput'); const saveRules = document.getElementById('saveRules'); const rulesStatus = document.getElementById('rulesStatus');

let source = { type: 'demo', files: [] };
let lastAudit = null;

const demoAudit = {
  repoName: 'syncspace',
  evidence: [
    { citation: 'apps/web/components/app/workspace-organization.tsx:67', title: 'Workspace search UI', detail: 'Source contains an interface that calls the workspace search operation.', tag: 'component' },
    { citation: 'apps/api/internal/http/handlers/organization.go:495', title: 'Workspace search endpoint', detail: 'Source contains a membership-scoped workspace search handler.', tag: 'route' }
  ],
  gaps: [
    { title: 'No AI or semantic-retrieval integration evidence found', detail: 'The cited search implementation does not establish source evidence of an LLM, embeddings, or semantic retrieval.' },
    { title: 'No automated AI-search integration test found', detail: 'No test citation was found to demonstrate AI-assisted or semantic-search behavior.' }
  ],
  verdict: 'Partially evidenced',
  boundary: 'Do not present SyncSpace search as AI-powered or semantic without a source-backed integration and human verification.',
  why: 'The source supports that SyncSpace has workspace-scoped text search. It does not provide evidence of an AI model, embeddings, or semantic retrieval. This is a source-evidence assessment, not proof of runtime behavior or an AI capability.',
  trace: ['Mapped the claim to search UI, search endpoint, AI or semantic-retrieval, and integration-test expectations.', 'Cited apps/web/components/app/workspace-organization.tsx:67 as workspace search UI evidence.', 'Cited apps/api/internal/http/handlers/organization.go:495 as workspace search endpoint evidence.', 'No source evidence of an LLM, embeddings, or semantic retrieval was cited.', 'No automated AI-search integration test was cited.']
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function resetStages() {
  stages.forEach((stage) => stage.classList.remove('active', 'done'));
}

function sourceFileLabel(file) {
  return file.webkitRelativePath || file.name;
}

function renderCards(audit) {
  evidenceCards.innerHTML = audit.evidence.map((item) => `
    <article class="evidence-card">
      <div class="status-icon evidence-icon">↗</div>
      <div><p class="citation">${escapeHtml(item.citation)}</p><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.detail)}</p></div>
      <span class="source-tag">${escapeHtml(item.tag)}</span>
    </article>`).join('') || `
    <article class="evidence-card"><div class="status-icon evidence-icon">–</div><div><p class="citation">No citation</p><h4>No expected source evidence found</h4><p>No supported component or route signal matched the entered claim.</p></div><span class="source-tag">source</span></article>`;
  gapCards.innerHTML = audit.gaps.map((item) => `
    <article class="gap-card"><div class="status-icon gap-icon">!</div><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.detail)}</p></div></article>`).join('');
}

function renderTrace(trace = []) {
  traceList.innerHTML = trace.map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(item)}</li>`).join('');
}

function renderAudit(audit) {
  const claim = claimInput.value.trim() || 'Untitled product claim';
  resultTitle.textContent = claim;
  runClaim.textContent = `“${claim}”`;
  verdictText.innerHTML = `<span class="verdict-dot"></span>${escapeHtml(audit.verdict)}`;
  boundaryText.innerHTML = `<span>Boundary</span>${escapeHtml(audit.boundary)}`;
  whyCopy.textContent = audit.why;
  renderCards(audit);
  renderTrace(audit.trace);
  if (audit.git) {
    const comparison = audit.comparison ? ` · compared with ${audit.comparison.baselineCommit || 'previous local audit'}: +${audit.comparison.newEvidence.length} / -${audit.comparison.removedEvidence.length} citations` : '';
    gitContext.innerHTML = `<strong>Git context</strong> ${escapeHtml(audit.git.branch)} @ ${escapeHtml(audit.git.commit)} · ${audit.git.dirty ? 'working tree has changes' : 'working tree clean'}${escapeHtml(comparison)}`;
    gitContext.hidden = false;
  } else gitContext.hidden = true;
  if (audit.comparison) { comparisonText.textContent = `Compared with ${audit.comparison.baselineCommit || 'the previous saved audit'}: ${audit.comparison.newEvidence.length} citation(s) added, ${audit.comparison.removedEvidence.length} removed; prior verdict was ${audit.comparison.previousVerdict}.`; comparisonPanel.hidden = false; } else comparisonPanel.hidden = true;
  if (audit.testDiscovery) { testCommands.innerHTML = audit.testDiscovery.commands.map((item) => `<li>${escapeHtml(item.manifest)} — ${escapeHtml(item.command)} (${escapeHtml(item.script)})</li>`).join('') || '<li>No npm test script discovered.</li>'; testNote.textContent = audit.testDiscovery.note; testDiscovery.hidden = false; } else testDiscovery.hidden = true;
  lastAudit = { claim, source, audit };
  const saved = localStorage.getItem(`mvp-review:${claim}:${audit.repoName}`);
  if (saved) { const review = JSON.parse(saved); reviewDecision.value = review.decision; reviewNotes.value = review.notes; reviewStatus.textContent = 'Saved local reviewer decision loaded.'; } else { reviewDecision.value = ''; reviewNotes.value = ''; reviewStatus.textContent = ''; }
}

async function inspectLocalFiles(files) {
  const sourceFiles = [...files].filter((file) => /\.(?:[cm]?[jt]sx?|vue|svelte|py|rb|go|java|cs)$/i.test(file.name) && file.size <= 1_000_000).slice(0, 250);
  const readable = await Promise.all(sourceFiles.map(async (file) => ({ path: sourceFileLabel(file), text: await file.text() })));
  const expectsExport = /export|report|download/i.test(claimInput.value);
  const component = readable.find(({ path, text }) => /export|report|download/i.test(path) && /component|tsx|jsx|vue|svelte/i.test(`${path} ${text.slice(0, 300)}`));
  const route = readable.find(({ path, text }) => /(?:api|route|controller|handler)/i.test(path) && /export|report|download/i.test(`${path} ${text}`));
  const authSignal = readable.find(({ path, text }) => /(?:api|route|controller|handler)/i.test(path) && /(?:requireRole|hasRole|authorize|authoriz|canExport|permission)/i.test(text));
  const accessTest = readable.find(({ path, text }) => /(?:test|spec)/i.test(path) && /(?:role|permission|authoriz|access.?control)/i.test(text));
  const evidence = [];
  const gaps = [];
  if (component) evidence.push({ citation: component.path, title: expectsExport ? 'Claim-related UI signal found' : 'Claim-related UI signal found', detail: 'A deterministic filename and source-text check linked this file to the claim.', tag: 'component' });
  if (route) evidence.push({ citation: route.path, title: 'Claim-related route signal found', detail: 'A deterministic path and source-text check linked this route-related file to the claim.', tag: 'route' });
  if (authSignal) evidence.push({ citation: authSignal.path, title: 'Authorization signal found', detail: 'A route-related source file contains an authorization-related signal; human review must determine relevance and coverage.', tag: 'signal' });
  else gaps.push({ title: 'No route-level authorization signal found', detail: 'The deterministic source check did not find an authorization-related signal in a route-related file.' });
  if (accessTest) evidence.push({ citation: accessTest.path, title: 'Access-control test signal found', detail: 'A test file contains an access-control-related signal; human review must determine coverage.', tag: 'test signal' });
  else gaps.push({ title: 'No automated access-control test signal found', detail: 'The deterministic source check did not find an access-control-related signal in a test file.' });
  if (!component) gaps.unshift({ title: 'No claim-related UI component signal found', detail: 'No component file matched the entered claim using the browser-only local check.' });
  if (!route) gaps.unshift({ title: 'No claim-related route signal found', detail: 'No route-related file matched the entered claim using the browser-only local check.' });
  const sourceSupport = Boolean(component || route);
  return {
    repoName: repoName.textContent,
    evidence: evidence.slice(0, 4), gaps,
    verdict: sourceSupport ? (authSignal && accessTest ? 'Evidenced in source' : 'Partially evidenced') : 'No supporting evidence found',
    boundary: 'Source signals do not establish runtime behavior, security, or suitability without human verification.',
    why: 'This browser-only source check found the signals listed above. It does not retain audit history and cannot establish runtime behavior or security.',
    trace: [`Read ${readable.length} supported files selected in the browser.`, 'Mapped the claim to component, route, authorization, and access-control test expectations.', ...evidence.map((item) => `Cited ${item.citation}.`), ...gaps.map((item) => item.title)]
  };
}

async function auditServerRepository() {
  const rules = JSON.parse(localStorage.getItem(`mvp-rules:${claimTemplate.value}`) || 'null');
  const response = await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoPath: source.path, claim: claimInput.value.trim(), template: claimTemplate.value, rules }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'The local repository audit could not be completed.');
  return payload;
}

async function prepareAudit() {
  if (source.type === 'demo') return demoAudit;
  if (source.type === 'server') return auditServerRepository();
  return inspectLocalFiles(source.files);
}

function failedAudit(message) {
  return { repoName: repoName.textContent, evidence: [], gaps: [{ title: 'Audit could not complete', detail: message }], verdict: 'Requires runtime / human verification', boundary: 'No source conclusion should be drawn until the repository path and scan can be reviewed.', why: 'The local audit did not complete. The tool intentionally does not substitute demo evidence or invent a result.', trace: [message] };
}

async function runAudit() {
  intake.hidden = true;
  results.hidden = true;
  progress.hidden = false;
  resetStages();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  let audit;
  try { audit = await prepareAudit(); } catch (error) { audit = failedAudit(error instanceof Error ? error.message : 'The local source check failed.'); }
  renderAudit(audit);
  stages.forEach((stage, index) => window.setTimeout(() => {
    if (index > 0) stages[index - 1].classList.replace('active', 'done');
    stage.classList.add('active');
  }, index * 600));
  window.setTimeout(async () => {
    stages.at(-1).classList.replace('active', 'done');
    progress.hidden = true;
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (source.type === 'server') await loadHistory();
  }, stages.length * 600 + 260);
}

function closePicker() {
  repoPicker.hidden = true;
  repoButton.setAttribute('aria-expanded', 'false');
  pathEntry.hidden = true;
}

async function loadHistory() {
  try {
    const response = await fetch('/api/history');
    const entries = await response.json();
    if (!entries.length) return;
    historyList.innerHTML = entries.slice(0, 5).map((entry) => `<li><span>${escapeHtml(entry.claim)}<br><small>${escapeHtml(entry.repoName)} · ${new Date(entry.createdAt).toLocaleString()}</small></span><strong>${escapeHtml(entry.verdict)}</strong></li>`).join('');
    history.hidden = false;
  } catch { /* The standalone demo has no history endpoint. */ }
}

function evidencePack() {
  if (!lastAudit) return null;
  return { claim: lastAudit.claim, repository: lastAudit.audit.repoName, git: lastAudit.audit.git || null, verdict: lastAudit.audit.verdict, boundary: lastAudit.audit.boundary, citedEvidence: lastAudit.audit.evidence, evidenceGaps: lastAudit.audit.gaps, auditTrace: lastAudit.audit.trace, instruction: 'Use only this evidence pack. Explain the relevance of citations and identify questions for a human reviewer. Do not infer missing facts, decide the verdict, or claim production behavior or security.' };
}

repoButton.addEventListener('click', () => {
  repoPicker.hidden = !repoPicker.hidden;
  repoButton.setAttribute('aria-expanded', String(!repoPicker.hidden));
});
useDemo.addEventListener('click', () => {
  source = { type: 'demo', files: [] };
  repoName.textContent = 'syncspace';
  repoMeta.textContent = 'main · demo source profile';
  closePicker();
});
chooseFolder.addEventListener('click', () => folderInput.click());
choosePath.addEventListener('click', () => { pathEntry.hidden = !pathEntry.hidden; repoPathInput.focus(); });
usePath.addEventListener('click', () => {
  const path = repoPathInput.value.trim();
  if (!path) { repoPathInput.focus(); return; }
  source = { type: 'server', path };
  repoName.textContent = path.split(/[\\/]/).filter(Boolean).at(-1) || 'local repository';
  repoMeta.textContent = 'local repository path · source scan + history';
  closePicker();
});
folderInput.addEventListener('change', () => {
  if (!folderInput.files.length) return;
  source = { type: 'browser', files: folderInput.files };
  const firstPath = sourceFileLabel(folderInput.files[0]).split('/');
  repoName.textContent = firstPath[0] || 'local project';
  repoMeta.textContent = `${folderInput.files.length} local files selected · browser-only scan`;
  closePicker();
});
document.addEventListener('click', (event) => { if (!event.target.closest('.field-group')) closePicker(); });
claimTemplate.addEventListener('change', () => {
  const claims = { 'ai-search': 'Study groups can search shared notes semantically with AI.', 'secure-export': 'Teams can export reports securely.', generic: '' };
  if (claims[claimTemplate.value]) claimInput.value = claims[claimTemplate.value];
});
const defaultRules = { 'ai-search': { checks:[{label:'Workspace search UI',kind:'component',pathPattern:'workspace-organization',contentPattern:'search'},{label:'AI or semantic retrieval integration',kind:'integration',pathPattern:'',contentPattern:'openai|anthropic|\\bllm\\b|embedding'}] }, 'secure-export': { checks:[{label:'Export UI',kind:'component',pathPattern:'components?',contentPattern:'export|report'},{label:'Route authorization',kind:'authorization',pathPattern:'api|route|handler|controller',contentPattern:'authorize|permission|requireRole'}] }, generic:{checks:[]} };
editRules.addEventListener('click', () => { const value = localStorage.getItem(`mvp-rules:${claimTemplate.value}`); rulesInput.value = value || JSON.stringify(defaultRules[claimTemplate.value], null, 2); rulesPanel.hidden = !rulesPanel.hidden; });
saveRules.addEventListener('click', () => { try { const parsed = JSON.parse(rulesInput.value); if (!Array.isArray(parsed.checks)) throw new Error(); localStorage.setItem(`mvp-rules:${claimTemplate.value}`, JSON.stringify(parsed)); rulesStatus.textContent = 'Rules saved locally and will drive the next local-path audit.'; } catch { rulesStatus.textContent = 'Use valid JSON with a checks array.'; } });
auditButton.addEventListener('click', runAudit);
rerunButton.addEventListener('click', () => { results.hidden = true; intake.hidden = false; intake.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
copyPrompt.addEventListener('click', async () => {
  const pack = evidencePack();
  if (!pack) return;
  const prompt = `${pack.instruction}\n\nEvidence pack:\n${JSON.stringify(pack, null, 2)}`;
  await navigator.clipboard.writeText(prompt);
  copyPrompt.textContent = 'Copied review prompt';
  window.setTimeout(() => { copyPrompt.textContent = 'Copy Codex review prompt'; }, 1800);
});
exportEvidence.addEventListener('click', () => {
  const pack = evidencePack();
  if (!pack) return;
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mvp-reality-check-evidence-pack.json';
  link.click();
  URL.revokeObjectURL(url);
});
exportMarkdown.addEventListener('click', () => {
  const pack = evidencePack(); if (!pack) return;
  const review = { decision: reviewDecision.value || 'Not recorded', notes: reviewNotes.value || 'None' };
  const markdown = `# MVP Reality Check review\n\n## Claim\n${pack.claim}\n\n## Verdict\n${pack.verdict}\n\n## Git\n${pack.git?.branch || 'Not recorded'} @ ${pack.git?.commit || 'Not recorded'}\n\n## Evidence\n${pack.citedEvidence.map((item) => `- ${item.citation}: ${item.title}`).join('\n') || '- None'}\n\n## Gaps\n${pack.evidenceGaps.map((item) => `- ${item.title}`).join('\n')}\n\n## Human decision\n${review.decision}\n\n${review.notes}\n\n## Boundary\n${pack.boundary}\n`;
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' })); link.download = 'mvp-reality-check-review.md'; link.click(); URL.revokeObjectURL(link.href);
});
saveReview.addEventListener('click', () => { if (!lastAudit || !reviewDecision.value) { reviewStatus.textContent = 'Choose a decision before saving.'; return; } localStorage.setItem(`mvp-review:${lastAudit.claim}:${lastAudit.audit.repoName}`, JSON.stringify({ decision: reviewDecision.value, notes: reviewNotes.value, savedAt: new Date().toISOString() })); reviewStatus.textContent = 'Decision saved locally.'; });
loadHistory();
