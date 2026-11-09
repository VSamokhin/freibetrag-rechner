export function baseVersion(dir: string): string;
export function commitsSinceBase(dir: string): number;
export function derivedVersion(base: string, commits: number): string;
export function versionOf(dir: string): string;
export const ROOT: string;
