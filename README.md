# MVP Reality Check demo

Dependency-free local prototype for the interview presentation.

## Run the demo

From this folder:

```powershell
node server.mjs
```

Open [http://localhost:4173](http://localhost:4173).

For the two-slide interview companion, open [http://localhost:4173/slides.html](http://localhost:4173/slides.html) in a second window next to the prototype. Use the arrow keys or Space to advance, or press `F` for presentation mode.

No installation, API keys, or external services are required. The app starts on the included fixed local mock evidence profile.

## Audit a real local repository

1. Select the repository card.
2. Choose **Audit a local repository path**.
3. Enter the absolute path to a local Git checkout and select **Use path**.
4. Select **Audit claim**.

The local server recursively reads supported source files (JavaScript/TypeScript, Vue, Svelte, Python, Ruby, Go, Java, and C#), skips generated/dependency folders, runs deterministic component/route/authorization/test checks, and saves up to 50 audit summaries in `.local-data/audit-history.json`. No source contents are uploaded.

## Optional Codex review step

After an audit, the app can copy a constrained Codex review prompt or export an evidence pack. Paste that into your signed-in Codex client to get an explanation of the cited evidence and questions for a reviewer. This is deliberately manual and optional: Codex does not set the verdict, and the demo uses no API key.

## Demo flow

1. Start with the prefilled claim and repository, then select **Audit claim**.
2. Let the short deterministic-check trace complete.
3. Review the evidence, gaps, bounded verdict, and human-review boundary.
4. Open **Audit trace** if you want to make the deterministic process explicit.
5. For the AI-assisted workflow, use **Copy Codex review prompt** after the result.
