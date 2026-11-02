# Workspace Trust status and accessibility QA (unreleased source)

Issue: [#101 — accessible completion status and local-model quality](https://github.com/sanskarIN/LineLoom/issues/101)

## Why this change was needed

Workspace Trust is a gate for both automatic and manually invoked LineLoom
completion. A status bar displaying "ready" while VS Code is in a restricted
workspace implies a capability that is blocked. The sidebar's recommended
action could also suggest resuming a file-local pause before mentioning
Workspace Trust. These are misleading recovery instructions.

The source now separates three priorities:

1. **Globally disabled:** show **LineLoom Off** and the enable action.
2. **Restricted workspace, extension enabled:** show **LineLoom Restricted**;
   recommend reviewing VS Code Workspace Trust (never implicitly grant trust).
3. **Trusted workspace:** show any file-local pause and then normal completion,
   warning, or error state.

The status-bar item's native accessibility label is explicit and icon-free,
including the current state and a description of the Quick Actions entry
point. It contains no filenames, source, endpoint URLs, model tags or paths.
A Workspace Trust grant re-renders status and sidebar locally, without
making an Ollama request. The snapshot remains provisional: restricted
status does not imply a live model check, and granting trust does not imply
the opened file passes ignore and sensitivity rules.

## Automated coverage

- Pure status-copy tests for all five completion states, trust restriction,
  disabled precedence, paused-file precedence and accessible labels.
- Sidebar recommendation tests for combinations of restricted workspace,
  paused active file and stale generating/ready engine states.
- Static provider contract checks that native status items expose their
  accessible label and trust-grant event refreshes local UI.
- Existing mocked extension-host, Windows/macOS/Linux and VSIX compatibility
  checks remain mandatory.

These tests **do not** substitute for physical keyboard, screen-reader or
high-contrast manual QA.

## Manual acceptance checklist — NOT RUN

Use a throwaway local workspace and existing, explicitly approved Ollama
configuration. Do not copy private code into issue comments, screenshots
or public diagnostics.

- [ ] In a restricted workspace with autocomplete enabled, status bar reads
      **LineLoom Restricted**, not "ready" or "generating"; sidebar Engine
      Status says **Blocked — workspace restricted**.
- [ ] With a file paused during restriction, the sidebar recommends
      **Review Workspace Trust**, rather than **Resume Suggestions**.
- [ ] In the same restricted workspace, globally disable LineLoom. Status
      becomes **LineLoom Off** and sidebar recommends **Enable Autocomplete**.
- [ ] Explicitly grant Workspace Trust in VS Code. Status updates locally,
      without a passive Ollama request, and previously checked model/file
      readiness states remain unverified until manually checked.
- [ ] In a trusted workspace, pause one local file. Status announces that
      only the current file is paused and the sidebar offers Resume.
- [ ] Use a screen reader on Windows, macOS and Linux: verify native status
      name accurately announces restricted, disabled, paused, and generating
      states without reading codicon markup or hidden details.
- [ ] Operate Quick Actions, sidebar and settings with keyboard only and
      inspect them in a VS Code high-contrast theme. Confirm focus, visible
      action names, and no network activity from passive UI refresh.
- [ ] Verify actual model inference and privacy gates only with explicit
      local QA consent; report sanitized outcomes without source contents.

No new release, model training, Marketplace/Open VSX publication or
publisher-ID migration is authorized by this checklist.
