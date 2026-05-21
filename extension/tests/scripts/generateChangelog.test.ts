import { describe, expect, it } from "vitest";
// @ts-expect-error test imports the Node generator directly
import { parseChangelogMarkdown } from "../../scripts/generate-changelog.mjs";

describe("parseChangelogMarkdown", () => {
  it("parses the repository changelog into version entries", () => {
    const parsed = parseChangelogMarkdown(`
# Changelog

## v1.0.2

- Second change
- Third change

## v1.0.1

- First change
`);

    expect(parsed).toEqual([
      {
        version: "v1.0.2",
        changes: ["Second change", "Third change"]
      },
      {
        version: "v1.0.1",
        changes: ["First change"]
      }
    ]);
  });

  it("throws when a version section has no bullet list", () => {
    expect(() =>
      parseChangelogMarkdown(`
# Changelog

## v1.0.1

No bullets here
`)
    ).toThrow(/does not contain any bullet points/i);
  });
});
