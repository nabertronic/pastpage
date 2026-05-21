import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const changelogPath = path.join(repoRoot, "docs", "CHANGELOG.md");
const outputPath = path.join(repoRoot, "extension", "src", "generated", "changelog.ts");

export function parseChangelogMarkdown(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const entries = [];
  let currentEntry = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^##\s+v(.+)$/);

    if (headingMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
      }

      currentEntry = {
        version: `v${headingMatch[1].trim()}`,
        changes: []
      };
      continue;
    }

    if (currentEntry && line.trim().startsWith("- ")) {
      currentEntry.changes.push(line.trim().slice(2).trim());
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  if (entries.length === 0) {
    throw new Error("No changelog versions were found. Expected sections like '## v1.2.3'.");
  }

  return entries.map((entry) => {
    if (entry.changes.length === 0) {
      throw new Error(`Changelog version ${entry.version} does not contain any bullet points.`);
    }
    return entry;
  });
}

function createOutput(entries) {
  const serialized = JSON.stringify(entries, null, 2);
  return `import type { WhatsNewEntry } from "../core/whatsNew";

// This file is generated from docs/CHANGELOG.md by extension/scripts/generate-changelog.mjs.
export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = ${serialized};
`;
}

export async function generateChangelogModule() {
  const markdown = await fs.readFile(changelogPath, "utf8");
  const entries = parseChangelogMarkdown(markdown);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, createOutput(entries), "utf8");
}

if (process.argv[1] === __filename) {
  generateChangelogModule().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
