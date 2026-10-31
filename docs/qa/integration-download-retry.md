# VS Code integration-download retry policy

The Linux VS Code extension-host test downloads a disposable VS Code desktop
test binary using the official `@vscode/test-electron` helper. GitHub Actions
occasionally cannot reach the upstream download service even though the
extension's tests themselves are healthy. For example, the `main` CI run
[41173527708](https://github.com/sanskarIN/LineLoom/actions/runs/41173527708)
first failed on 2026-10-31 when its editor download hit `ETIMEDOUT`
and `ENETUNREACH`. The failing job passed when retried, without changing
the extension source. This is external transport flakiness, **not a reason
to waive extension-host testing**.

## Safeguard

The development test runner now explicitly calls
`downloadAndUnzipVSCode("stable")` before `runTests`, and passes the
downloaded executable path into the latter. The download is retried **only**
for recognized transient network error codes (including nested
`AggregateError` connection errors), at most three attempts with 1s and
2s delays. A successful download launches the VS Code integration suite
**exactly once**.

Invalid installs, integrity failures, assertions, tests that exit nonzero,
non-network errors and exhausted network retries still fail CI. The
underlying library's extraction and executable validation remain in effect;
this wrapper does not bypass the published VS Code test framework, pin an
unverified binary or retry the VS Code test process. CI does not suppress
missing model evidence or replace physical manual QA.

The downloaded VS Code build is for local integration testing. It is not
included in the extension's VSIX or distributed to users.

## Regression checks

`npm run test:qa` runs synthetic, fully offline tests that inject a fake
downloader and verify bounded delays, nested temporary network errors,
non-network fail-closed behavior, invalid return values and exhaustion.
The real Linux `Extension host (Linux)` job must still pass using an actual
VS Code binary. The three OS checks, dependency audit and VSIX candidate
install/upgrade gates remain mandatory before merging source changes.

There is **no** GitHub or marketplace publication implied by a passing
integration run. Real-device accessibility, actual local Ollama quality
and first-party model training remain distinct manual evidence gates.
