// @ts-check
import js from "@eslint/js";
import security from "eslint-plugin-security";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "node_modules/"] },
  js.configs.recommended,
  security.configs.recommended,
  {
    files: ["**/*.ts"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Quality gates
      complexity: ["error", 12],
      "max-depth": ["error", 4],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", 4],
      eqeqeq: "error",
      "no-console": "error",
      // Security hardening beyond eslint-plugin-security
      "no-eval": "error",
      "no-implied-eval": "off",
      "@typescript-eslint/no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Use textContent or <template> to avoid XSS." },
        { property: "outerHTML", message: "Use DOM APIs to avoid XSS." },
        { property: "insertAdjacentHTML", message: "Use DOM APIs to avoid XSS." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='write'][callee.object.name='document']",
          message: "No document.write.",
        },
      ],
      // Typed keys only (Record<Mode, …>, numeric years); this rule flags every bracket access.
      "security/detect-object-injection": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "max-lines-per-function": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      // Tests build fixed fixture DOM from the app's own index.html.
      "no-restricted-properties": "off",
      "@typescript-eslint/no-unnecessary-type-parameters": "off",
    },
  },
  {
    // Build tooling and tests only read repo files at fixed, code-defined paths.
    files: ["scripts/**", "tests/**", "*.config.ts"],
    rules: { "security/detect-non-literal-fs-filename": "off" },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
);
