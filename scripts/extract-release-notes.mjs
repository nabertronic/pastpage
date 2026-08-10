import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const [tag, outputPath] = process.argv.slice(2);

if (!tag || (!outputPath && !process.argv.includes("--check"))) {
  console.error(
    "Usage: node scripts/extract-release-notes.mjs <tag> <output-path|--check>"
  );
  process.exit(1);
}

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error(`Invalid release tag: ${tag}`);
  process.exit(1);
}

const changelog = await readFile(new URL("../docs/CHANGELOG.md", import.meta.url), "utf8");
const heading = `## ${tag}`;
const start = changelog.indexOf(heading);

if (start === -1) {
  console.error(`Missing ${heading} section in docs/CHANGELOG.md`);
  process.exit(1);
}

const bodyStart = start + heading.length;
const nextHeading = changelog.indexOf("\n## ", bodyStart);
const notes = changelog
  .slice(bodyStart, nextHeading === -1 ? changelog.length : nextHeading)
  .trim();

if (!notes) {
  console.error(`Release notes for ${tag} are empty`);
  process.exit(1);
}

if (outputPath !== "--check") {
  await writeFile(outputPath, `${notes}\n`, "utf8");
}
