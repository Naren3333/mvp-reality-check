# MVP Reality Check demo

Dependency-free local prototype for the interview presentation.

## Run the demo

From this folder, either double-click `start-demo.cmd` in File Explorer, or run:

```powershell
npm run dev
```

Open [http://localhost:4173](http://localhost:4173).

For the two-slide interview companion, open [http://localhost:4173/slides.html](http://localhost:4173/slides.html) in a second window next to the prototype. Use the arrow keys or Space to advance, or press `F` for presentation mode.

No installation, API keys, or external services are required. The default repository is the local SyncSpace checkout; the included fixed evidence profile remains available as an optional demo fallback.

## Audit a real local repository

1. Select the repository card.
2. Choose **Audit a local repository path**.
3. Enter the absolute path to a local Git checkout and select **Use path**.
4. Select **Audit claim**.

The local server recursively reads supported source files (JavaScript/TypeScript, Vue, Svelte, Python, Ruby, Go, Java, and C#), skips generated/dependency folders, runs deterministic component/route/authorization/test checks, and saves up to 50 audit summaries in `.local-data/audit-history.json`. No source contents are uploaded.

## Audit a public GitHub repository

1. Select the repository card.
2. Choose **Audit a public GitHub repository**.
3. Enter an HTTPS URL such as `https://github.com/owner/repository`.
4. Select **Audit claim**.

The server accepts only public `https://github.com/owner/repository` URLs. It makes a shallow, no-tags clone into `.local-data/repository-cache`, audits that local copy, and keeps **one** managed GitHub clone at a time: cloning the next public repository removes the previous managed clone. Private repositories are deliberately not supported by this no-key flow.

## Working review controls

- Choose a claim template (AI search, secure export, or generic) and optionally change the persisted, JSON-defined evidence rules with **Edit rules**.
- Each local audit shows the repository's Git branch, short commit, working-tree state, and a comparison with the preceding saved audit for that repository/template.
- The app discovers declared `npm test` scripts but deliberately does **not** execute repository code; that keeps the prototype read-only and safe to run against an unfamiliar checkout.
- A reviewer can record a final decision and rationale in the browser, then export a Markdown hand-off report or JSON evidence pack.

## No-key workflow included

The local-path audit adds the following working features:

- **Claim decomposition:** each claim becomes explicit source requirements, with a cited/gap/human-review status.
- **Evidence graph and citation explorer:** inspect the relationship from claim to requirement to exact source citation, including a short local line excerpt.
- **Candidate code-path trace:** a clearly labelled citation sequence for review. It is not presented as a verified runtime call graph.
- **Git-aware audit history:** compare the current audit with the previous saved audit for the same repository/template, including changed tracked file names when Git can calculate a diff.
- **Supplementary documents:** attach small `.md`, `.txt`, `.json`, `.yaml`, or `.yml` review documents. They remain local and are explicitly separated from source evidence.
- **Manual runtime plan:** generate a template-specific safe test plan. The tool never runs repository code or probes a live system.
- **Reviewer queue:** save a decision, owner, state, due date, and rationale to `.local-data/reviews.json`.

## Optional sandbox test execution

When Docker Desktop is running, a local-path or public-GitHub audit lists discovered `test`, `e2e`, `lint`, `typecheck`, `check`, and `build` scripts. Choose one explicitly under **Run one selected test in an isolated sandbox**.

- The project is copied into a disposable workspace; the original project is never mounted into the container.
- The test phase has no network, no host credentials, no Docker socket, no privileged mode, and CPU/memory/process limits.
- If needed, the reviewer can explicitly allow one setup phase: `npm ci --ignore-scripts` with network access. A `package-lock.json` is required for this phase.
- The tool records the command, outcome, exit code, capped logs, Docker version, and boundary in `.local-data/test-runs.json`.

Sandbox output is bounded execution evidence for one command at one point in time. It does not prove production behaviour, security, or complete test coverage.

The audit does not prove production behaviour, security, privacy, investment readiness, or test coverage. It reports bounded source signals and preserves the human decision point.

## Optional Codex review step

After an audit, the app can copy a constrained Codex review prompt or export an evidence pack. Paste that into your signed-in Codex client to get an explanation of the cited evidence and questions for a reviewer. This is deliberately manual and optional: Codex does not set the verdict, and the demo uses no API key.

## Demo flow

1. Start with the prefilled claim and repository, then select **Audit claim**.
2. Let the short deterministic-check trace complete.
3. Review the evidence, gaps, bounded verdict, and human-review boundary.
4. Open **Audit trace** if you want to make the deterministic process explicit.
5. For the AI-assisted workflow, use **Copy Codex review prompt** after the result.
