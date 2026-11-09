declare const __APP_VERSION__: string;

/** App version, injected from package.json at build time (see scripts/build.mjs and vitest.config.ts). */
export const APP_VERSION: string = __APP_VERSION__;
