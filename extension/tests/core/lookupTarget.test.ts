import { describe, expect, it } from "vitest";
import { getCustomLookupTargetState, getLookupTargetState } from "@/core/lookupTarget";

describe("lookupTarget", () => {
  it("accepts eligible page URLs", () => {
    expect(getLookupTargetState("https://example.com/story")).toEqual({
      kind: "eligible",
      url: "https://example.com/story"
    });
  });

  it("rejects unsupported or empty tab URLs", () => {
    expect(getLookupTargetState("chrome://extensions")).toEqual({
      kind: "ineligible",
      reasonKey: "eligibility.httpOnly"
    });
    expect(getLookupTargetState(undefined)).toEqual({
      kind: "ineligible",
      reasonKey: "lookupTarget.missingUrl"
    });
  });

  it("accepts relaxed custom URLs by adding https when needed", () => {
    expect(getCustomLookupTargetState("example.com/story")).toEqual({
      kind: "eligible",
      url: "https://example.com/story"
    });
  });

  it("still rejects clearly invalid custom input", () => {
    expect(getCustomLookupTargetState("notaurl")).toEqual({
      kind: "ineligible",
      reasonKey: "eligibility.invalidUrl"
    });
  });
});
