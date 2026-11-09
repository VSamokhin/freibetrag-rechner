// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseVersion, commitsSinceBase, derivedVersion, versionOf } from "../scripts/version.mjs";

const dirs: string[] = [];

/** git without the GIT_* variables a pre-commit hook sets, so tests never touch the real repository. */
function git(dir: string, ...args: string[]): string {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return execFileSync("git", args, {
    cwd: dir,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "version-test-"));
  dirs.push(dir);
  return dir;
}

function setVersion(dir: string, version: string): void {
  writeFileSync(join(dir, "package.json"), `{\n  "name": "x",\n  "version": "${version}"\n}\n`);
}

function commit(dir: string, message: string, file = "change.txt"): void {
  writeFileSync(join(dir, file), message);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--no-verify", "-m", message);
}

function repo(version: string): string {
  const dir = tempDir();
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "commit.gpgsign", "false");
  setVersion(dir, version);
  commit(dir, "base");
  return dir;
}

beforeEach(() => {
  vi.stubEnv("GITHUB_ACTIONS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("derivedVersion", () => {
  it("adds the commit count to the build part", () => {
    expect(derivedVersion("0.37.3", 3)).toBe("0.37.6");
    expect(derivedVersion("1.2.0", 0)).toBe("1.2.0");
  });

  it("rejects a base that is not major.minor.build", () => {
    expect(() => derivedVersion("1.2", 1)).toThrow(/major\.minor\.build/);
  });
});

describe("versionOf", () => {
  it("yields the base on the base commit", () => {
    const dir = repo("0.1.0");
    expect(commitsSinceBase(dir)).toBe(0);
    expect(versionOf(dir)).toBe("0.1.0");
  });

  it("raises the build part by one per later commit", () => {
    const dir = repo("0.1.0");
    commit(dir, "one");
    commit(dir, "two");
    commit(dir, "three");
    expect(versionOf(dir)).toBe("0.1.3");
  });

  it("restarts the count when the base changes", () => {
    const dir = repo("0.1.0");
    commit(dir, "one");
    commit(dir, "two");
    setVersion(dir, "0.2.0");
    commit(dir, "new minor");
    expect(versionOf(dir)).toBe("0.2.0");
    commit(dir, "fix");
    expect(versionOf(dir)).toBe("0.2.1");
  });

  it("does not restart the count for other package.json changes", () => {
    const dir = repo("0.1.0");
    writeFileSync(join(dir, "package.json"), `{\n  "name": "renamed",\n  "version": "0.1.0"\n}\n`);
    commit(dir, "rename");
    expect(versionOf(dir)).toBe("0.1.1");
  });

  it("counts a merge commit as one first-parent step", () => {
    const dir = repo("0.1.0");
    git(dir, "checkout", "-q", "-b", "feature");
    commit(dir, "f1", "f1.txt");
    commit(dir, "f2", "f2.txt");
    git(dir, "checkout", "-q", "main");
    git(dir, "merge", "-q", "--no-ff", "--no-verify", "-m", "merge feature", "feature");
    expect(versionOf(dir)).toBe("0.1.1");
  });

  it("falls back to the base with a warning in a shallow clone", () => {
    const source = repo("0.1.0");
    commit(source, "one");
    commit(source, "two");
    const clone = join(tempDir(), "clone");
    git(source, "clone", "-q", "--depth", "1", `file://${source}`, clone);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(versionOf(clone)).toBe("0.1.0");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("fetch-depth: 0"));
  });

  it("fails a shallow clone on GitHub Actions", () => {
    const source = repo("0.1.0");
    commit(source, "one");
    const clone = join(tempDir(), "clone");
    git(source, "clone", "-q", "--depth", "1", `file://${source}`, clone);
    vi.stubEnv("GITHUB_ACTIONS", "true");
    expect(() => versionOf(clone)).toThrow(/fetch-depth: 0/);
  });

  it("validates the committed base", () => {
    const dir = tempDir();
    setVersion(dir, "1.0");
    expect(() => baseVersion(dir)).toThrow(/major\.minor\.build/);
    writeFileSync(join(dir, "package.json"), `{ "version": 1 }`);
    expect(() => baseVersion(dir)).toThrow(/got 1/);
  });

  it("counts all first-parent commits if the version line was never committed", () => {
    const dir = tempDir();
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.name", "Test");
    git(dir, "config", "user.email", "test@example.com");
    commit(dir, "one");
    commit(dir, "two");
    expect(commitsSinceBase(dir)).toBe(2);
  });

  it("falls back to the base outside a git repository", () => {
    const dir = tempDir();
    setVersion(dir, "0.3.0");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(versionOf(dir)).toBe("0.3.0");
    expect(warn).toHaveBeenCalledOnce();
  });
});
