// Word fixes (Captions tab): the user's list is applied on top of upstream's autocorrect.
import { afterEach, describe, expect, it } from "vitest";
import type { Caption } from "@remotion/captions";
import { autocorrectWords, setUserWordFixes } from "../composition/config/autocorrect";

const word = (text: string): Caption => ({ text, startMs: 0, endMs: 0, timestampMs: 0, confidence: null });
const fix = (text: string) => autocorrectWords([word(text)])[0]!.text;

afterEach(() => setUserWordFixes([]));

describe("autocorrect with user word fixes", () => {
  it("keeps upstream's own fixes", () => {
    expect(fix(" github").trim()).toBe("GitHub"); // upstream's rule leaves a double space; not ours to change
    expect(fix(" remotion.")).toBe(" Remotion.");
  });

  it("changes nothing without fixes", () => {
    expect(fix(" kubernetes")).toBe(" kubernetes");
  });

  it("replaces a word, ignoring case, and keeps the leading space", () => {
    setUserWordFixes([{ from: "kubernetes", to: "Kubernetes" }]);
    expect(fix(" kubernetes")).toBe(" Kubernetes");
    expect(fix(" KUBERNETES")).toBe(" Kubernetes");
  });

  it("keeps trailing punctuation", () => {
    setUserWordFixes([{ from: "acme", to: "ACME Corp" }]);
    expect(fix(" acme,")).toBe(" ACME Corp,");
    expect(fix(" acme.")).toBe(" ACME Corp.");
  });

  it("only replaces whole words", () => {
    setUserWordFixes([{ from: "cat", to: "dog" }]);
    expect(fix(" concatenate")).toBe(" concatenate");
  });

  it("ignores incomplete rows", () => {
    setUserWordFixes([{ from: "", to: "x" }, { from: "y", to: "  " }]);
    expect(fix(" y")).toBe(" y");
  });
});
