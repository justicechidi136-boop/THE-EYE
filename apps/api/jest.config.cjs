module.exports = {
  testEnvironment: "node",
  resolver: "./jest.resolver.js",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.spec.ts"],
  watchman: false,
  haste: {
    enableSymlinks: true,
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.tsx?$": [require.resolve("ts-jest"), { tsconfig: "<rootDir>/tsconfig.json" }],
  },
};
