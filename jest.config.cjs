module.exports = {
  testEnvironment: "jsdom",
  testMatch: [
    "**/__tests__/**/*.test.js",
    "**/*.test.js"
  ],
  moduleFileExtensions: ["js", "json"],
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@jest)/)"
  ],
  setupFilesAfterEnv: [],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/main.js",
    "!**/node_modules/**"
  ]
};