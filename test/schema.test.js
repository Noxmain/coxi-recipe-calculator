import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

/** @param {string} relativePath */
function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const ajv = new Ajv2020({ allErrors: true });
const validateIngredients = ajv.compile(readJson("../schemas/ingredients.schema.json"));
const validateRecipe = ajv.compile(readJson("../schemas/recipe.schema.json"));
const validateInventory = ajv.compile(readJson("../schemas/inventory.schema.json"));

/** @param {(data: unknown) => boolean} validate @param {unknown} data */
function assertValid(validate, data) {
  const ok = validate(data);
  assert.ok(ok, JSON.stringify(validate.errors, null, 2));
}

/** @param {(data: unknown) => boolean} validate @param {unknown} data */
function assertInvalid(validate, data) {
  assert.equal(validate(data), false, "the data should have been rejected");
}

// ---- Valid example data -------------------------------------------------

test("the example ingredients are valid", () => {
  assertValid(validateIngredients, readJson("../data/ingredients.json"));
});

test("the example recipes are valid", () => {
  const { recipes } = readJson("../data/recipes/index.json");
  for (const id of recipes) {
    assertValid(validateRecipe, readJson(`../data/recipes/${id}.json`));
  }
});

test("the example inventory is valid", () => {
  assertValid(validateInventory, readJson("../data/inventory.example.json"));
});

// ---- Valid edge cases ---------------------------------------------------

test("an ingredient without optional fields is valid", () => {
  assertValid(validateIngredients, {
    schemaVersion: 1,
    ingredients: [{ id: "water", name: "Water", unit: "ml" }],
  });
});

test("any free-text unit is valid", () => {
  assertValid(validateIngredients, {
    schemaVersion: 1,
    ingredients: [{ id: "garlic", name: "Garlic", unit: "clove" }],
  });
});

test("a recipe without servings and portionWeight is valid", () => {
  assertValid(validateRecipe, {
    schemaVersion: 1,
    id: "pancakes",
    name: "Pancakes",
    type: "other",
    ingredients: [{ ingredientId: "flour", amount: 60 }],
    steps: ["Fry."],
  });
});

// ---- Invalid ingredients (expected to fail) -----------------------------

/** @type {Record<string, unknown>} */
const invalidIngredients = {
  "missing unit": { id: "salt", name: "Salt" },
  "empty unit": { id: "salt", name: "Salt", unit: "" },
  "numeric unit": { id: "salt", name: "Salt", unit: 1 },
  "id with uppercase letters": { id: "Olive-Oil", name: "Olive oil", unit: "ml" },
  "id with spaces": { id: "olive oil", name: "Olive oil", unit: "ml" },
  "empty name": { id: "salt", name: "", unit: "g" },
  "packageSize without packagePrice": { id: "salt", name: "Salt", unit: "g", packageSize: 1000 },
  "packagePrice without packageSize": { id: "salt", name: "Salt", unit: "g", packagePrice: 0.6 },
  "zero packageSize": { id: "salt", name: "Salt", unit: "g", packageSize: 0, packagePrice: 0.6 },
  "negative packagePrice": { id: "salt", name: "Salt", unit: "g", packageSize: 1000, packagePrice: -1 },
  "misspelled property": { id: "salt", name: "Salt", unit: "g", packageSzie: 1000 },
  "empty whereToBuy": { id: "salt", name: "Salt", unit: "g", whereToBuy: "" },
  "wrong schemaVersion": { id: "salt", name: "Salt", unit: "g", schemaVersion: 2 },
};

for (const [label, ingredient] of Object.entries(invalidIngredients)) {
  test(`ingredient is rejected: ${label}`, () => {
    assertInvalid(validateIngredients, { schemaVersion: 1, ingredients: [ingredient] });
  });
}

// ---- Invalid recipes (expected to fail) ---------------------------------

const validRecipe = {
  schemaVersion: 1,
  id: "soup",
  name: "Soup",
  type: "main",
  servings: 4,
  portionWeight: 400,
  ingredients: [{ ingredientId: "onion", amount: 1 }],
  steps: ["Cook."],
};

/** @type {Record<string, unknown>} */
const invalidRecipes = {
  "old type name dish": { ...validRecipe, type: "dish" },
  "unknown type": { ...validRecipe, type: "dessert" },
  "servings of 0": { ...validRecipe, servings: 0 },
  "fractional servings": { ...validRecipe, servings: 1.5 },
  "portionWeight of 0": { ...validRecipe, portionWeight: 0 },
  "no ingredients": { ...validRecipe, ingredients: [] },
  "amount of 0": { ...validRecipe, ingredients: [{ ingredientId: "onion", amount: 0 }] },
  "amount as text": { ...validRecipe, ingredients: [{ ingredientId: "onion", amount: "100" }] },
  "ingredientId with uppercase letters": { ...validRecipe, ingredients: [{ ingredientId: "Onion", amount: 1 }] },
  "old property amountPerPerson": { ...validRecipe, amountPerPerson: 100 },
  "no steps": { ...validRecipe, steps: [] },
  "empty step": { ...validRecipe, steps: [""] },
  "missing id": { ...validRecipe, id: undefined },
};

for (const [label, recipe] of Object.entries(invalidRecipes)) {
  test(`recipe is rejected: ${label}`, () => {
    assertInvalid(validateRecipe, recipe);
  });
}

// ---- Invalid inventory (expected to fail) -------------------------------

/** @type {Record<string, unknown>} */
const invalidInventories = {
  "old format with unit per item": {
    schemaVersion: 1,
    kind: "inventory",
    items: { "olive-oil": { amount: 500, unit: "ml" } },
  },
  "negative amount": { schemaVersion: 1, kind: "inventory", items: { onion: -1 } },
  "amount as text": { schemaVersion: 1, kind: "inventory", items: { onion: "3" } },
  "wrong kind": { schemaVersion: 1, kind: "recipe", items: { onion: 3 } },
  "id with uppercase letters": { schemaVersion: 1, kind: "inventory", items: { Onion: 3 } },
};

for (const [label, inventory] of Object.entries(invalidInventories)) {
  test(`inventory is rejected: ${label}`, () => {
    assertInvalid(validateInventory, inventory);
  });
}
