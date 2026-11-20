import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildIngredientRecord,
  convertRecipeAmounts,
  groupByCategory,
  isSameIngredient,
  mergeIngredients,
  readIngredientFile,
  roundAmount,
  usingRecipes,
  validateIngredientDraft,
} from "../js/core/ingredient-editing.js";

const garlic = {
  id: "garlic",
  name: "Garlic",
  unit: "clove",
  category: "Vegetables",
  packageSize: 10,
  packagePrice: 0.45,
  whereToBuy: "Weekly market",
};

test("a complete ingredient is valid", () => {
  assert.deepEqual(validateIngredientDraft(garlic, null), []);
});

test("package size and package price must be given together", () => {
  const errors = validateIngredientDraft({ ...garlic, packagePrice: undefined }, null);
  assert.match(errors.join(" "), /together/);
});

test("an id that already exists is rejected for a new ingredient", () => {
  const errors = validateIngredientDraft(garlic, new Set(["garlic"]));
  assert.match(errors.join(" "), /already exists/);
});

test("an empty unit is rejected", () => {
  const errors = validateIngredientDraft({ ...garlic, unit: " " }, null);
  assert.match(errors.join(" "), /needs a unit/);
});

test("empty optional fields are left out of the record", () => {
  const record = buildIngredientRecord({
    id: "water",
    name: "Water",
    unit: "ml",
    category: "",
    packageSize: undefined,
    packagePrice: undefined,
    whereToBuy: "",
  });
  assert.deepEqual(record, { id: "water", name: "Water", unit: "ml" });
});

test("converting a recipe multiplies only the amounts of that ingredient", () => {
  const recipe = {
    id: "chili",
    name: "Chili",
    type: "main",
    ingredients: [
      { ingredientId: "garlic", amount: 2 },
      { ingredientId: "onion", amount: 1 },
    ],
    steps: ["Cook."],
  };
  const converted = convertRecipeAmounts(recipe, "garlic", 3);
  assert.deepEqual(converted.ingredients, [
    { ingredientId: "garlic", amount: 6 },
    { ingredientId: "onion", amount: 1 },
  ]);
  assert.equal(recipe.ingredients[0].amount, 2, "the input must not change");
});

test("recipes that use an ingredient are found", () => {
  const recipes = [
    { id: "a", name: "A", ingredients: [{ ingredientId: "garlic", amount: 1 }] },
    { id: "b", name: "B", ingredients: [{ ingredientId: "onion", amount: 1 }] },
  ];
  assert.deepEqual(
    usingRecipes(/** @type {any} */ (recipes), "garlic").map((recipe) => recipe.name),
    ["A"],
  );
});

test("a saved ingredient replaces the repository ingredient and new ones are added", () => {
  const repo = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const local = {
    b: { id: "b", name: "B changed" },
    c: { id: "c", name: "C" },
  };
  const merged = mergeIngredients(/** @type {any} */ (repo), /** @type {any} */ (local));
  assert.deepEqual(
    merged.map((item) => item.name),
    ["A", "B changed", "C"],
  );
});

test("an ingredient file is read", () => {
  const list = readIngredientFile({
    schemaVersion: 1,
    ingredients: [{ id: "garlic", name: "Garlic", unit: "clove", packageSize: 10, packagePrice: 0.45 }],
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].unit, "clove");
});

test("an ingredient file with a duplicate id is rejected", () => {
  assert.throws(
    () =>
      readIngredientFile({
        schemaVersion: 1,
        ingredients: [
          { id: "garlic", name: "Garlic", unit: "clove" },
          { id: "garlic", name: "Garlic", unit: "g" },
        ],
      }),
    /listed twice/,
  );
});

test("a malformed ingredient file is rejected", () => {
  assert.throws(() => readIngredientFile({ schemaVersion: 1, ingredients: [{ id: 5 }] }), /malformed/);
  assert.throws(() => readIngredientFile({ schemaVersion: 2, ingredients: [] }), /not a valid/);
});

test("two ingredients with the same content are the same", () => {
  assert.equal(isSameIngredient(garlic, { ...garlic }), true);
  assert.equal(isSameIngredient(garlic, { ...garlic, packagePrice: 0.5 }), false);
});

test("ingredients are grouped by category, without category last", () => {
  const groups = groupByCategory(
    /** @type {any} */ ([
      { id: "water", name: "Water", unit: "ml" },
      { id: "lemon", name: "Lemon", unit: "piece", category: "Fruit" },
      garlic,
    ]),
  );
  assert.deepEqual(
    groups.map((group) => group.title),
    ["Fruit", "Vegetables", "Uncategorized"],
  );
});

test("rounding removes floating point noise", () => {
  assert.equal(roundAmount(0.1 * 3), 0.3);
});
