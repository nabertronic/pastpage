declare module "../../scripts/generate-changelog.mjs" {
  export function parseChangelogMarkdown(markdown: string): Array<{
    version: string;
    changes: string[];
  }>;
}
