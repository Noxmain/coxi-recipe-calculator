// @ts-check
// Validates the data files in data/ against the JSON Schemas in schemas/ and
// checks the relations between them. Run locally with "npm run validate" and
// in the GitHub Action.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { validateDataset } from "../js/core/validation.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} path
 * @returns {any}
 */
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Checks all data files. Returns error messages, an empty list means valid.
 * @param {{ dataDir?: string, schemaDir?: string }} [options]
 * @returns {string[]}
 */
export function collectDataErrors({
  dataDir = join(projectRoot, "data"),
  schemaDir = join(projectRoot, "schemas"),
} = {}) {
  const ajv = new Ajv2020({ allErrors: true });
  const validateIngredients = ajv.compile(readJson(join(schemaDir, "ingredients.schema.json")));
  const validateRecipe = ajv.compile(readJson(join(schemaDir, "recipe.schema.json")));
  const validateInventory = ajv.compile(readJson(join(schemaDir, "inventory.schema.json")));

  /** @type {string[]} */
  const errors = [];

  // Shape checks: each file against its schema.
  const ingredientsFile = readJson(join(dataDir, "ingredients.json"));
  errors.push(...schemaErrors("ingredients.json", validateIngredients, ingredientsFile));

  const inventoryFile = readJson(join(dataDir, "inventory.example.json"));
  errors.push(...schemaErrors("inventory.example.json", validateInventory, inventoryFile));

  const indexFile = readJson(join(dataDir, "recipes", "index.json"));
  if (
    indexFile.schemaVersion !== 1 ||
    !Array.isArray(indexFile.recipes) ||
    !indexFile.recipes.every((id) => typeof id === "string")
  ) {
    errors.push("recipes/index.json must contain schemaVersion 1 and a list of recipe ids.");
  }

  // Every recipe file in the folder, not only the ones listed in index.json.
  const recipeFileNames = readdirSync(join(dataDir, "recipes"))
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .sort();

  /** @type {{ fileName: string, recipe: import("../js/core/types.js").Recipe }[]} */
  const recipeFiles = [];
  for (const fileName of recipeFileNames) {
    const recipe = readJson(join(dataDir, "recipes", fileName));
    errors.push(...schemaErrors(`recipes/${fileName}`, validateRecipe, recipe));
    recipeFiles.push({ fileName, recipe });
  }

  // Relation checks need correctly shaped data, so stop here if there are errors.
  if (errors.length > 0) {
    return errors;
  }

  return validateDataset({
    ingredients: ingredientsFile.ingredients,
    recipeFiles,
    recipeIndex: indexFile.recipes,
  });
}

/**
 * @param {string} label File name for the error message.
 * @param {import("ajv").ValidateFunction} validate
 * @param {unknown} data
 * @returns {string[]}
 */
function schemaErrors(label, validate, data) {
  if (validate(data)) {
    return [];
  }
  return (validate.errors ?? []).map(
    (error) => `${label}${error.instancePath}: ${error.message}`,
  );
}

function main() {
  const errors = collectDataErrors();
  if (errors.length === 0) {
    console.log("All data files are valid.");
    return;
  }
  console.error(`Found ${errors.length} problem(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
}

// Run main only when this file is executed directly, not when it is imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
