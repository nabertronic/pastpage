import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

const dryRun = process.argv.includes("--dry-run");
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe"
  });

  if (result.status !== 0 && !options.allowFailure) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return {
    status: result.status,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? ""
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

run("gh", ["auth", "status"]);

const status = run("git", ["status", "--porcelain"]).stdout;
assert(!status, "The working tree must be clean before deployment.");

const branch = run("git", ["branch", "--show-current"]).stdout;
assert(branch === "main", `Deployments must run from main, not ${branch || "detached HEAD"}.`);

run("git", ["fetch", "origin", "main"]);
const localHead = run("git", ["rev-parse", "HEAD"]).stdout;
const remoteHead = run("git", ["rev-parse", "origin/main"]).stdout;
assert(localHead === remoteHead, "Local main and origin/main must point to the same commit.");

const rootPackage = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const extensionPackage = JSON.parse(
  await readFile(new URL("../extension/package.json", import.meta.url), "utf8")
);
const wxtConfig = await readFile(
  new URL("../extension/wxt.config.ts", import.meta.url),
  "utf8"
);

const version = rootPackage.version;
assert(/^\d+\.\d+\.\d+$/.test(version), `Invalid package version: ${version}`);
assert(
  extensionPackage.version === version,
  "package.json and extension/package.json versions do not match."
);
assert(
  wxtConfig.includes(`version: "${version}"`),
  "package.json and extension/wxt.config.ts versions do not match."
);

const tag = `v${version}`;
const releaseNotesCheck = run("node", [
  "scripts/extract-release-notes.mjs",
  tag,
  "--check"
], { allowFailure: true });
assert(releaseNotesCheck.status === 0, `Release notes for ${tag} are invalid.`);

if (!dryRun) {
  const existingRelease = run(
    "gh",
    ["release", "view", tag, "--repo", "nabertronic/pastpage"],
    { allowFailure: true }
  );
  assert(existingRelease.status !== 0, `GitHub release ${tag} already exists.`);

  const existingTag = run(
    "git",
    ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`],
    { allowFailure: true }
  );
  assert(existingTag.status !== 0, `Git tag ${tag} already exists.`);
}

console.log(`${dryRun ? "Validating" : "Deploying"} PastPage ${version} from ${localHead}.`);

const trigger = run("gh", [
  "workflow",
  "run",
  "release-extension.yml",
  "--repo",
  "nabertronic/pastpage",
  "--ref",
  "main",
  "-f",
  `dry_run=${dryRun}`
]);

console.log(trigger.stdout);
const runId = trigger.stdout.match(/\/runs\/(\d+)/)?.[1];
assert(runId, "Could not determine the GitHub Actions run ID.");

let runAvailable = false;
for (let attempt = 0; attempt < 10; attempt += 1) {
  const lookup = run(
    "gh",
    ["run", "view", runId, "--repo", "nabertronic/pastpage"],
    { allowFailure: true }
  );
  if (lookup.status === 0) {
    runAvailable = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
assert(runAvailable, `GitHub Actions run ${runId} did not become available.`);

run(
  "gh",
  ["run", "watch", runId, "--repo", "nabertronic/pastpage", "--exit-status"],
  { inherit: true }
);

if (!dryRun) {
  const release = run("gh", [
    "release",
    "view",
    tag,
    "--repo",
    "nabertronic/pastpage",
    "--json",
    "url",
    "--jq",
    ".url"
  ]).stdout;
  console.log(`Released ${tag}: ${release}`);
}
