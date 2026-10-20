# LineLoom sidebar (v1.2.0 GitHub stable and v1.2.1 development)

LineLoom's next-release control center is a **native VS Code Activity Bar Tree View**.
Open the LineLoom icon in the Activity Bar and select **Control Center**, or run
**LineLoom: Open Control Center** from the Command Palette/status-bar Quick Actions. The feature
was introduced in [v1.1.0 GitHub **pre-release**](https://github.com/sanskarIN/LineLoom/releases/tag/v1.1.0),
with an extended Active Editor section in the published
[v1.1.1 GitHub preview](https://github.com/sanskarIN/LineLoom/releases/tag/v1.1.1). The
published v1.0.0 stable extension does not include this view.

## What is visible

- **Completion:** turn autocomplete on or off, pause/resume automatic suggestions,
  manually trigger a suggestion, or use **Stop Current Generation** (available
  in the unreleased v1.2.1 candidate) to abort a queued/in-flight request
  without changing the persistent enable/automatic settings.
- **Models & Languages:** show the configured default Ollama model, count language
  overrides and enabled languages, and open existing selection commands.
- **Active Editor (v1.1.1 preview):** display only the current VS Code
  language ID's friendly name, effective default/override model and a provisional
  settings-level completion status. It reacts to editor changes. Unsupported
  languages and missing editors are clearly labeled, without reading filenames,
  paths or source content. A non-identifying document URI scheme is also
  used so untitled and virtual documents are not shown as eligible.
- **Privacy & Connection:** report workspace trust, and whether the inference
  endpoint is loopback, remote approved, remote blocked/pending approval, or invalid.
  Use Check Ollama Connection for an explicit user-initiated model-list request.
- **Session Activity:** request, suggestion, cancellation, failure, cache-hit,
  continuation reuse and empty-response totals from in-memory aggregates,
  plus optional measured average latency when performance diagnostics are
  enabled. Nothing is persisted or sent to a telemetry service.
- **Completion (v1.2.0 candidate):** a local-only runtime status describing
  ready, generating, unavailable, disabled or error. "Ready" means the UI is
  ready, **not** that a configured model is installed or Ollama is reachable.
- **More Actions:** settings, setup instructions, and Quick Actions.

The title-bar refresh icon refreshes the tree without querying Ollama. Sidebar
section and action labels also provide explicit screen-reader names; manual
keyboard/high-contrast acceptance is tracked separately.

## Privacy and behavior

Rendering or refreshing the sidebar never reads other files, constructs inference
prompts, contacts Ollama, or initiates endpoint consent. It does not display the
endpoint host/port, source text, file paths, prompt/response bodies, secrets or
session history. Choosing an existing model or connection command is an explicit
user action and uses the existing remote HTTPS approval flow. The view does not
bypass workspace trust or the completion engine's private-file exclusions.

The new Active Editor status deliberately cannot guarantee that the current
file is eligible for completion: sensitive-file exclusions and ignore rules
are checked only by the completion engine just before inference. That design
avoids filesystem access while merely rendering the sidebar.

The sidebar intentionally reuses commands instead of duplicating VS Code's
configuration persistence and request logic. Settings changes refresh the view;
counters refresh after completion engine state notifications or on demand.

## Developer QA

1. Install dependencies with `npm ci`, then run `npm run check`.
2. Launch the extension host with `F5`; open the LineLoom Activity Bar item.
3. Test enable/disable and pause/resume, with and without an editor open.
4. Configure a remote HTTPS Ollama origin and confirm the sidebar does **not**
   connect until an explicit connection/model action, with approval enforced.
5. Switch between trusted and restricted workspaces. Inspect the tree for
   accurate status and no file contents or sensitive endpoint details.
6. Confirm the existing status bar Quick Actions and inline provider still work.
7. Run `npm run test:integration` in a compatible desktop/test environment.

Release readiness also requires Windows/macOS/Linux host verification,
packaged VSIX checks and real-model acceptance; these are not claimed here.
