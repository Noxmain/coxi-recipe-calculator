import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateNeededAmounts } from "../js/core/recipes.js";
import { buildShoppingItems, summarizePrices } from "../js/core/shopping.js";
import { indexById } from "../js/core/utils.js";
import { validateDataset } from "../js/core/validation.js";

/** @param {...string} parts */
function readJson(...parts) {
  return JSON.parse(readFileSync(new URL(`../data/${parts.join("/")}`, import.meta.url), "utf8"));
}

/**
 * @param {number} actual
 * @param {number} expected
 */
function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);
}

test("the example data is consistent", () => {
  const recipeIndex = readJson("recipes", "index.json").recipes;
  const recipeFiles = recipeIndex.map((id) => ({
    fileName: `${id}.json`,
    recipe: readJson("recipes", `${id}.json`),
  }));
  const errors = validateDataset({
    ingredients: readJson("ingredients.json").ingredients,
    recipeFiles,
    recipeIndex,
  });
  assert.deepEqual(errors, []);
});

test("chili sin carne for 6 people matches the control example", () => {
  const ingredientsById = indexById(readJson("ingredients.json").ingredients);
  const chili = readJson("recipes", "chili-sin-carne.json");

  const needed = calculateNeededAmounts([{ recipe: chili, portions: 6 }]);
  const items = buildShoppingItems(needed, {}, ingredientsById);
  const summary = summarizePrices(items, 6);

  assertClose(summary.absoluteTotal, 8.085); // shown as 8.09 €, see note below
  assertClose(summary.absolutePerPerson, 1.3475);
  assertClose(summary.purchaseTotal, 22.92);
  assertClose(summary.purchasePerPerson, 3.82);
  assert.equal(summary.pricedCount, 9);
  assert.equal(summary.itemCount, 10);
});
