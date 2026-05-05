import { describe, expect, it, vi } from "vitest";
import {
  buildSoftwareHeritageVisitUrl,
  deriveSoftwareHeritageTarget,
  softwareHeritageProvider
} from "@/core/providers/softwareHeritage";

describe("softwareHeritageProvider", () => {
  it("derives a repository-root target for GitHub repositories", () => {
    expect(deriveSoftwareHeritageTarget("https://github.com/openai/openai")).toEqual({
      originUrl: "https://github.com/openai/openai",
      browseUrl:
        "https://archive.softwareheritage.org/browse/origin/directory/?origin_url=https%3A%2F%2Fgithub.com%2Fopenai%2Fopenai"
    });
  });

  it("derives a file target for GitHub blob URLs", () => {
    expect(deriveSoftwareHeritageTarget("https://github.com/openai/openai/blob/main/README.md")).toEqual({
      originUrl: "https://github.com/openai/openai",
      browseUrl:
        "https://archive.softwareheritage.org/browse/content/?origin_url=https%3A%2F%2Fgithub.com%2Fopenai%2Fopenai&path=README.md"
    });
  });

  it("builds the latest-visit API URL", () => {
    expect(buildSoftwareHeritageVisitUrl("https://github.com/openai/openai")).toBe(
      "https://archive.softwareheritage.org/api/1/origin/https://github.com/openai/openai/visit/latest/?require_snapshot=true"
    );
  });

  it("returns a snapshot when the repository has a full archived visit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        date: "2026-04-24T06:21:17.240000+00:00",
        status: "full",
        snapshot: "0419ba84e285829c3b6f1f68d94c06fc547c421a"
      })
    });

    const snapshot = await softwareHeritageProvider.lookup(
      { strategy: "exact", url: "https://github.com/torvalds/linux" },
      fetchImpl as unknown as typeof fetch
    );

    expect(snapshot?.providerId).toBe("software-heritage");
    expect(snapshot?.archiveUrl).toBe(
      "https://archive.softwareheritage.org/browse/origin/directory/?origin_url=https%3A%2F%2Fgithub.com%2Ftorvalds%2Flinux"
    );
    expect(snapshot?.timestamp).toBe("20260424062117");
  });

  it("returns null when Software Heritage has no archived visit for the origin", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    const snapshot = await softwareHeritageProvider.lookup(
      { strategy: "exact", url: "https://github.com/openai/openai" },
      fetchImpl as unknown as typeof fetch
    );

    expect(snapshot).toBeNull();
  });
});
