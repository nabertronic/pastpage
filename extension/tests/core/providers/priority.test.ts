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

  it("promotes the Government of Canada Web Archive for canada.ca URLs", () => {
    const order = buildAutomaticProviderOrder(classifyArchivePriority("https://www.canada.ca/en.html"));
    expect(order).toContain("canada-gov-web-archive");
    expect(order.indexOf("canada-gov-web-archive")).toBeLessThan(order.indexOf("ghostarchive"));
  });

  it("promotes Vefsafn for Icelandic domains", () => {
    const order = buildAutomaticProviderOrder(classifyArchivePriority("https://www.stjornarradid.is/"));
    expect(order).toContain("vefsafn");
    expect(order.indexOf("vefsafn")).toBeLessThan(order.indexOf("ghostarchive"));
  });

  it("promotes NTUWAS for Taiwanese domains", () => {
    const order = buildAutomaticProviderOrder(classifyArchivePriority("https://www.ntu.edu.tw/"));
    expect(order).toContain("ntuwas");
    expect(order.indexOf("ntuwas")).toBeLessThan(order.indexOf("ghostarchive"));
  });

  it("promotes PADICAT for Catalan domains", () => {
    const order = buildAutomaticProviderOrder(classifyArchivePriority("https://www.vilaweb.cat/"));
    expect(order).toContain("padicat");
    expect(order.indexOf("padicat")).toBeLessThan(order.indexOf("ghostarchive"));
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
