import nextJest from "next/jest";

const createJestConfig = nextJest({ dir: "./" });

const config = {
  testEnvironment: "jsdom",
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
