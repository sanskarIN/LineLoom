/**
 * Non-sensitive, session-only outcome of an explicitly requested active-file
 * privacy inspection. This is NOT an ongoing permission or source snapshot.
 * Never store a document, URI, filename, source, or ignore rule here.
 */
export type ManualFilePrivacy = "not-checked" | "checking" | "allowed" | "blocked" | "no-editor";

export class FilePrivacySession {
  private revision = 0;
  private result: ManualFilePrivacy = "not-checked";

  get state(): ManualFilePrivacy { return this.result; }

  begin(): number {
    this.revision++;
    this.result = "checking";
    return this.revision;
  }

  isCurrent(token: number): boolean {
    return this.revision === token && this.result === "checking";
  }

  finish(token: number, value: Exclude<ManualFilePrivacy, "checking">): boolean {
    if (!this.isCurrent(token)) return false;
    this.result = value;
    return true;
  }

  clear(): void {
    this.revision++;
    this.result = "not-checked";
  }
}
