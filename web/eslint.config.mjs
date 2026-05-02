import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test config files use require()
    "jest.config.js",
    "jest.setup.js",
    "src/__tests__/**",
  ]),
  {
    rules: {
      // Calling async load functions from useEffect is valid React practice.
      // The rule aggressively flags any function call that internally calls setState.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
