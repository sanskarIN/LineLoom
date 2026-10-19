import { describe, expect, it } from "vitest";
import { isEndpointSelectionCurrent } from "../../src/settings/selection-state";

describe("asynchronous Ollama selection origin guard", () => {
  const approved = (origin: string) => origin === "https://models.example.org";

  it("accepts an unchanged local endpoint without remote consent", () => {
    expect(isEndpointSelectionCurrent(
      "http://127.0.0.1:11434", "http://127.0.0.1:11434", false, () => false
    )).toBe(true);
  });

  it("rejects picker results from a previously configured origin", () => {
    expect(isEndpointSelectionCurrent(
      "http://127.0.0.1:11434", "http://127.0.0.1:11435", false, () => true
    )).toBe(false);
    expect(isEndpointSelectionCurrent(
      "https://models.example.org", "https://other.example.org", true, approved
    )).toBe(false);
  });

  it("requires remote policy and consent to remain enabled", () => {
    expect(isEndpointSelectionCurrent(
      "https://models.example.org", "https://models.example.org", true, approved
    )).toBe(true);
    expect(isEndpointSelectionCurrent(
      "https://models.example.org", "https://models.example.org", false, approved
    )).toBe(false);
    expect(isEndpointSelectionCurrent(
      "https://models.example.org", "https://models.example.org", true, () => false
    )).toBe(false);
  });

  it("fails closed for invalid current endpoint values", () => {
    expect(isEndpointSelectionCurrent(
      "https://models.example.org", "http://models.example.org", true, approved
    )).toBe(false);
    expect(isEndpointSelectionCurrent(
      "http://127.0.0.1:11434", "http://127.0.0.1:11434/api/generate", false, approved
    )).toBe(false);
  });
});
