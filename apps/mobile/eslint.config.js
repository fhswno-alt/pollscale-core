const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**", ".expo/**"],
    rules: {
      // Feed/session bootstrap sets state after an async request. SDK 57 lint is stricter.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      // Reanimated shared values are mutated from worklets and gestures.
      "react-hooks/immutability": "off",
    },
  },
]);
