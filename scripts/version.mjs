#!/usr/bin/env node
// The app version, derived from the git history (see "Versioning" in README.md and CLAUDE.md).
//   node scripts/version.mjs           the version of HEAD
//   node scripts/version.mjs --base    the committed base in package.json
// The committed base is package.json's "version" (major.minor.build). A commit's version is that base
// with its build part raised by the first-parent commits since the commit that last changed the
// "version" line, so every commit that reaches main gets a higher version without anyone editing files.
// Minor and major are raised by hand (npm version minor|major --no-git-tag-version), which restarts
// the count. It needs the full history: in a shallow clone it fails on GitHub Actions (checkouts there
// use fetch-depth: 0) and falls back to the base, with a warning, elsewhere.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** The committed base version from package.json, validated as major.minor.build. */
export function baseVersion(dir) {
  const version = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;
  if (typeof version !== "string" || !SEMVER.test(version)) {
    throw new Error(`package.json version must be major.minor.build, got ${String(version)}`);
  }
  return version;
}

/** Runs git in `dir` without the GIT_* variables a hook sets (GIT_DIR, GIT_INDEX_FILE, ...). */
function git(dir, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return execFileSync("git", args, {
    cwd: dir,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** First-parent commits since the commit that last changed the "version" line of package.json. */
export function commitsSinceBase(dir) {
  if (git(dir, "rev-parse", "--is-shallow-repository") === "true") {
    throw new Error("the version is derived from the git history: fetch it in full (fetch-depth: 0)");
  }
  const base = git(
    dir,
    "log",
    "--first-parent",
    "-G",
    '"version":',
    "--format=%H",
    "-1",
    "--",
    "package.json",
  );
  return Number(git(dir, "rev-list", "--count", "--first-parent", base ? `${base}..HEAD` : "HEAD"));
}

/** The base with its build part raised by `commits`. */
export function derivedVersion(base, commits) {
  const match = SEMVER.exec(base);
  if (!match) throw new Error(`base version must be major.minor.build, got ${base}`);
  const [, major, minor, build] = match;
  return `${major}.${minor}.${String(Number(build) + commits)}`;
}

/** The version of HEAD in `dir`; on CI any error fails, locally it falls back to the base. */
export function versionOf(dir) {
  const base = baseVersion(dir);
  try {
    return derivedVersion(base, commitsSinceBase(dir));
  } catch (error) {
    if (process.env.GITHUB_ACTIONS) throw error;
    console.warn(
      `version: ${error instanceof Error ? error.message : String(error)}; using the base ${base}`,
    );
    return base;
  }
}

/** Repository root (the parent of scripts/). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(process.argv[2] === "--base" ? baseVersion(ROOT) : versionOf(ROOT));
}
