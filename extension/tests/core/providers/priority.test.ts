import { describe, expect, it } from "vitest";
import { buildAutomaticProviderOrder, classifyArchivePriority } from "@/core/providers/priority";
import { arquivoPtProvider } from "@/core/providers/arquivoPt";

describe("provider priority", () => {
  it("does not include Arquivo.pt in the general automatic order", () => {
    expect(buildAutomaticProviderOrder(classifyArchivePriority("https://example.com/story"))).not.toContain(
      "arquivo-pt"
    );
  });

  it("includes WebCite in the general automatic order after Megalodon/Web Gyotaku", () => {
    expect(buildAutomaticProviderOrder(classifyArchivePriority("https://example.com/story"))).toEqual([
      "wayback",
      "archive-today",
      "ghostarchive",
      "perma-cc",
      "web-gyotaku",
      "webcite"
    ]);
  });

  it("includes Software Heritage in the automatic order for repository URLs", () => {
    expect(
      buildAutomaticProviderOrder(classifyArchivePriority("https://github.com/openai/openai"))
    ).toContain("software-heritage");
  });

  it("promotes Arquivo.pt for Portuguese domains", () => {
    expect(buildAutomaticProviderOrder(classifyArchivePriority("https://example.pt/story"))).toContain(
      "arquivo-pt"
    );
    expect(arquivoPtProvider.isRelevant(classifyArchivePriority("https://example.pt/story"))).toBe(true);
  });

  it("does not treat Arquivo.pt as relevant for non-Portuguese domains", () => {
    expect(arquivoPtProvider.isRelevant(classifyArchivePriority("https://example.com/story"))).toBe(
      false
    );
  });
});
