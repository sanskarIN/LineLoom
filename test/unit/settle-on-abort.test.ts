import { describe, expect, it, vi } from "vitest";
import { settleOnAbort } from "../../src/completion/settle-on-abort";

describe("live completion waits with non-cooperative transports", () => {
  it("returns a valid result without rewriting model output", async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const source = "const answer = 42;";
    await expect(settleOnAbort(controller.signal, async () => source)).resolves.toBe(source);
    expect(add).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("does not invoke a model request when already aborted", async () => {
    const controller = new AbortController();
    controller.abort("PRIVATE_CANCEL_REASON");
    const work = vi.fn(async () => "not invoked");
    await expect(settleOnAbort(controller.signal, work)).rejects.toMatchObject({
      name: "AbortError", message: "Generation cancelled."
    });
    expect(work).not.toHaveBeenCalled();
  });

  it("refuses to begin inference if cancellation wins the work microtask", async () => {
    const controller = new AbortController();
    const work = vi.fn(async () => "not invoked");
    const pending = settleOnAbort(controller.signal, work);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(work).not.toHaveBeenCalled();
  });

  it("does not hang if the mock transport never responds to an abort", async () => {
    const controller = new AbortController();
    let started = false;
    const pending = settleOnAbort(controller.signal, () => {
      started = true;
      return new Promise<string>(() => {});
    });
    await Promise.resolve();
    expect(started).toBe(true);
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = Promise.race([
        pending.then(() => "unexpected", (error: unknown) =>
          error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "unexpected-error"),
        new Promise<string>(resolve => { watchdog = setTimeout(() => resolve("hung"), 500); })
      ]);
      controller.abort();
      expect(await result).toBe("cancelled");
    } finally {
      if (watchdog) clearTimeout(watchdog);
    }
  });

  it("discards a late response or failure instead of resurrecting ghost text", async () => {
    for (const outcome of ["resolve", "reject"] as const) {
      const controller = new AbortController();
      let resolveWork: (text: string) => void = () => {};
      let rejectWork: (reason: Error) => void = () => {};
      const pending = settleOnAbort(controller.signal, () => new Promise<string>((resolve, reject) => {
        resolveWork = resolve;
        rejectWork = reject;
      }));
      await Promise.resolve();
      const offered = vi.fn();
      const observed = pending.then(offered, error => error);
      controller.abort();
      const cancelled = await observed;
      expect(cancelled).toMatchObject({ name: "AbortError", message: "Generation cancelled." });
      if (outcome === "resolve") resolveWork("PRIVATE_GENERATED_CODE");
      else rejectWork(new Error("PRIVATE_MODEL_ERROR"));
      await Promise.resolve();
      expect(offered).not.toHaveBeenCalled();
      expect(JSON.stringify({ name: cancelled.name, message: cancelled.message }))
        .not.toMatch(/PRIVATE_/);
    }
  });

  it("propagates ordinary transport errors and unregisters the abort listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const error = new Error("controlled failure");
    await expect(settleOnAbort(controller.signal, async () => { throw error; })).rejects.toBe(error);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
