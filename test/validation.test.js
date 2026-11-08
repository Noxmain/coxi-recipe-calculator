import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDataset } from "../js/core/validation.js";

const ingredients = [{ id: "onion", name: "Onion", unit: "piece" }];

/** @param {string} id @param {string} [ingredientId] */
function recipeFile(id, ingredientId = "onion") {
  return {
    fileName: `${id}.json`,
    recipe: {
      id,
      name: id,
      type: /** @type {const} */ ("main"),
      ingredients: [{ ingredientId, amount: 1 }],
      steps: ["Cook."],
    },
  };
}

test("consistent data produces no errors", () => {
  const errors = validateDataset({
    ingredients,
    recipeFiles: [recipeFile("soup")],
    recipeIndex: ["soup"],
  });
  assert.deepEqual(errors, []);
});

test("duplicate ingredient ids are reported", () => {
  const errors = validateDataset({
    ingredients: [...ingredients, ...ingredients],
    recipeFiles: [],
    recipeIndex: [],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Duplicate ingredient id/);
});

test("unknown ingredient references are reported", () => {
  const errors = validateDataset({
    ingredients,
    recipeFiles: [recipeFile("soup", "leek")],
    recipeIndex: ["soup"],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unknown ingredient "leek"/);
});

test("a file name that does not match the recipe id is reported", () => {
  const file = { ...recipeFile("soup"), fileName: "other.json" };
  const errors = validateDataset({ ingredients, recipeFiles: [file], recipeIndex: ["soup"] });
  assert.match(errors[0], /does not match recipe id/);
});

test("a recipe missing in index.json is reported", () => {
  const errors = validateDataset({
    ingredients,
    recipeFiles: [recipeFile("soup")],
    recipeIndex: [],
  });
  assert.match(errors[0], /missing in index.json/);
});

test("an index entry without a recipe file is reported", () => {
  const errors = validateDataset({
    ingredients,
    recipeFiles: [],
    recipeIndex: ["ghost"],
  });
  assert.match(errors[0], /no such recipe file/);
});
