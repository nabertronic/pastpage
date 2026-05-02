import { describe, expect, it } from "vitest";
import { isLikelyWorkingSnapshotHtml } from "@/core/providers/snapshotValidation";

describe("snapshotValidation", () => {
  it("accepts a normal archived page", () => {
    expect(
      isLikelyWorkingSnapshotHtml("<html><head><title>SPIEGEL Startseite</title></head><body>ok</body></html>")
    ).toBe(true);
  });

  it("rejects known archive error pages", () => {
    expect(
      isLikelyWorkingSnapshotHtml(
        "<html><body>Wayback Machine doesn't have that page archived.</body></html>"
      )
    ).toBe(false);
    expect(
      isLikelyWorkingSnapshotHtml(
        "<html><head><title>One more step</title></head><body>Please complete the security check to access archive.ph</body></html>"
      )
    ).toBe(false);
  });

  it("rejects meta refresh redirect pages", () => {
    expect(
      isLikelyWorkingSnapshotHtml(
        '<html><head><meta http-equiv="refresh" content="0;url=https://example.com"></head></html>'
      )
    ).toBe(false);
  });
});
