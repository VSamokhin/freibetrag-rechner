// Production build: bundles src/main.ts and copies static files from public/ into dist/,
// stamping the version from package.json into the bundle and the service worker cache name.
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const version = pkg.version;
const out = new URL("../dist/", import.meta.url);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL("../public/", import.meta.url), out, { recursive: true });

const swUrl = new URL("sw.js", out);
const sw = await readFile(swUrl, "utf8");
await writeFile(swUrl, sw.replaceAll("__APP_VERSION__", version));

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ["es2020"],
  format: "iife",
  outfile: "dist/app.js",
  define: { __APP_VERSION__: JSON.stringify(version) },
  logLevel: "info",
});

console.log(`Built Freibetrag-Rechner v${version} into dist/`);
