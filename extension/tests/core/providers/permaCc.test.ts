import { describe, expect, it, vi } from "vitest";
import { permaCcProvider, buildPermaCcUrl } from "@/core/providers/permaCc";

describe("permaCcProvider", () => {
  it("queries the public archives endpoint", () => {
    expect(buildPermaCcUrl("https://example.com")).toContain("api.perma.cc/v1/public/archives");
    expect(buildPermaCcUrl("https://example.com")).toContain("limit=10");
  });

  it("returns the most recent archive as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          objects: [
            {
              guid: "ABCD-1234",
              creation_timestamp: "2023-05-01T12:00:00Z",
              url: "https://example.com"
            },
            {
              guid: "EFGH-5678",
              creation_timestamp: "2024-09-01T08:00:00Z",
              url: "https://example.com"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const snapshot = await permaCcProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(snapshot?.providerId).toBe("perma-cc");
    expect(snapshot?.archiveUrl).toBe("https://perma.cc/EFGH-5678");
    expect(snapshot?.timestamp).toBe("20240901080000");
  });

  it("returns null when no objects come back", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ objects: [] })
    });
    const snapshot = await permaCcProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );
    expect(snapshot).toBeNull();
  });

  it("returns null when objects are for a different URL (false-positive guard)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        objects: [
          {
            guid: "ZZZZ-9999",
            creation_timestamp: "2024-01-01T00:00:00Z",
            url: "https://completely-different.com/page"
          }
        ]
      })
    });
    const snapshot = await permaCcProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );
    expect(snapshot).toBeNull();
  });

  it("does not expose a manual direct link", () => {
    expect(permaCcProvider.buildDirectLinkUrl("https://example.com/path")).toBeNull();
  });
});
