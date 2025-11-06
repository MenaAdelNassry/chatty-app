export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**"
    ],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      ecmaVersion: 2020,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      semi: [2, "always"],
      "space-before-function-paren": [0, { anonymous: "always", named: "always" }],
      camelcase: 0,
      "no-return-assign": 0,
      quotes: ["error", "single"],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
];
