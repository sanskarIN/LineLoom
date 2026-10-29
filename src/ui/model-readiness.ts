/**
 * Ephemeral result of an explicitly invoked Ollama connection/model-list check.
 *
 * Never record endpoint URLs, model names, paths or server error bodies here.
 * 'available' only means the configured default tag appeared in /api/tags
 * during the LAST user-initiated check: it is not ongoing monitoring or a
 * guarantee that the model can generate text.
 */
export type ModelReadiness =
  | "not-checked"
  | "checking"
  | "available"
  | "missing"
  | "unreachable";

export class ModelReadinessSession {
  private revision = 0;
  private result: ModelReadiness = "not-checked";
  // Store only the abort controller for the current explicit check.
  private controller?: AbortController;

  get state(): ModelReadiness { return this.result; }

  /** Starting a second check supersedes every older pending check. */
  begin(): number {
    this.controller?.abort();
    this.controller = new AbortController();
    this.revision++;
    this.result = "checking";
    return this.revision;
  }

  /** Prevent a superseded request from reaching the model-list endpoint. */
  signalFor(token: number): AbortSignal {
    return this.isCurrent(token) && this.controller
      ? this.controller.signal : AbortSignal.abort();
  }

  isCurrent(token: number): boolean {
    return token === this.revision && this.result === "checking";
  }

  finish(token: number, result: Exclude<ModelReadiness, "checking">): boolean {
    if (!this.isCurrent(token)) return false;
    this.result = result;
    this.controller = undefined;
    return true;
  }

  /** Clear on any LineLoom configuration or consent boundary change. */
  clear(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.revision++;
    this.result = "not-checked";
  }
}
