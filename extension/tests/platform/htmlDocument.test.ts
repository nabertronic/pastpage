import { describe, expect, it } from "vitest";
import { supportsOverlayUi } from "@/platform/htmlDocument";

describe("supportsOverlayUi", () => {
  it("accepts regular HTML documents", () => {
    expect(supportsOverlayUi(document)).toBe(true);
  });

  it("rejects standalone SVG documents", () => {
    const svgDocument = document.implementation.createDocument(
      "http://www.w3.org/2000/svg",
      "svg",
      null
    );

    expect(supportsOverlayUi(svgDocument)).toBe(false);
  });

  it("rejects documents without a body", () => {
    const xmlDocument = document.implementation.createDocument(null, "feed", null);

    expect(supportsOverlayUi(xmlDocument)).toBe(false);
  });
});
