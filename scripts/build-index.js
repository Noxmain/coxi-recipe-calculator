// @ts-check
// Writes recipes/index.json from the recipe files in recipes/. Run locally with
// "npm run build-index". The GitHub Action runs it on every pull request, so the
// index never has to be edited by hand.

import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Lists the ids of all recipe files in a folder, sorted. The file index.json is not a recipe.
 * @param {string} recipesDir
 * @returns {{ schemaVersion: 1, recipes: string[] }}
 */
export function buildRecipeIndex(recipesDir) {
  const recipes = readdirSync(recipesDir)
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .map((name) => name.slice(0, -".json".length))
    .sort();
  return { schemaVersion: 1, recipes };
}

/**
 * @param {string} recipesDir
 */
export function writeRecipeIndex(recipesDir) {
  const index = buildRecipeIndex(recipesDir);
  writeFileSync(join(recipesDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
}

function main() {
  writeRecipeIndex(join(projectRoot, "recipes"));
  console.log("recipes/index.json is up to date.");
}

// Run main only when this file is executed directly, not when it is imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
