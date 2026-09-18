import nextJest from "next/jest.js";

// next/jest arma la config de SWC (JSX/TS) y traduce automáticamente el
// alias "@/*" de tsconfig.json, así los tests importan igual que el resto
// del portal.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  // next/jest solo mapea CSS/imágenes/fuentes; el alias "@/*" de
  // tsconfig.json hay que traducirlo a mano para que los tests lo resuelvan.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Sin esto, jest-haste-map choca entre package.json y el que Next deja
  // en .next/standalone/ al buildear (mismo "name").
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
};

export default createJestConfig(config);
