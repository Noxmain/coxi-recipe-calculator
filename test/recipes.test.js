import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateNeededAmounts,
  changePortionWeight,
  getServings,
  groupIngredientNamesByType,
  sumAmountsByType,
} from "../js/core/recipes.js";
import { indexById } from "../js/core/utils.js";

const ingredientsById = indexById([
  { id: "potato", name: "Potatoes", unit: "g" },
  { id: "onion", name: "Onion", unit: "piece" },
  { id: "flour", name: "Wheat flour", unit: "g" },
]);

/** @type {import("../js/core/types.js").Recipe} */
const soup = {
  id: "soup",
  name: "Soup",
  type: "main",
  servings: 4,
  portionWeight: 400,
  ingredients: [
    { ingredientId: "potato", amount: 600 },
    { ingredientId: "onion", amount: 1 },
  ],
  steps: ["Cook."],
};

/** @type {import("../js/core/types.js").Recipe} */
const pancakes = {
  id: "pancakes",
  name: "Pancakes",
  type: "other",
  ingredients: [
    { ingredientId: "flour", amount: 60 },
    { ingredientId: "onion", amount: 1 },
  ],
  steps: ["Fry."],
};

test("servings default to 1", () => {
  assert.equal(getServings(pancakes), 1);
  assert.equal(getServings(soup), 4);
});

test("base amounts are scaled to the portions of the entry", () => {
  const needed = calculateNeededAmounts([{ recipe: soup, portions: 6 }]);
  assert.equal(needed.get("potato"), 900);
  assert.equal(needed.get("onion"), 1.5);
});

test("amounts of several entries are added up", () => {
  const needed = calculateNeededAmounts([
    { recipe: soup, portions: 4 },
    { recipe: pancakes, portions: 4 },
  ]);
  assert.equal(needed.get("potato"), 600);
  assert.equal(needed.get("onion"), 1 + 4); // soup: factor 1, pancakes: factor 4
  assert.equal(needed.get("flour"), 240);
});

test("the same recipe in two entries is added up", () => {
  const needed = calculateNeededAmounts([
    { recipe: soup, portions: 4 },
    { recipe: soup, portions: 2 },
  ]);
  assert.equal(needed.get("potato"), 600 + 300);
});

test("amounts are not rounded", () => {
  const needed = calculateNeededAmounts([{ recipe: soup, portions: 3 }]);
  assert.equal(needed.get("onion"), 0.75);
});

test("changing the portion weight without scaling keeps the amounts", () => {
  const changed = changePortionWeight(soup, 200, false);
  assert.equal(changed.portionWeight, 200);
  assert.deepEqual(changed.ingredients, soup.ingredients);
});

test("changing the portion weight with scaling scales all amounts linearly", () => {
  const changed = changePortionWeight(soup, 200, true);
  assert.equal(changed.portionWeight, 200);
  assert.deepEqual(changed.ingredients, [
    { ingredientId: "potato", amount: 300 },
    { ingredientId: "onion", amount: 0.5 },
  ]);
  assert.equal(soup.portionWeight, 400, "the input recipe must not change");
});

test("scaling requires an existing portion weight", () => {
  assert.throws(() => changePortionWeight(pancakes, 200, true), /no portion weight/);
});

test("portion weight must be greater than 0", () => {
  assert.throws(() => changePortionWeight(soup, 0, false), /greater than 0/);
});

test("ingredient names are grouped by recipe type and sorted", () => {
  const names = groupIngredientNamesByType([soup, pancakes], ingredientsById);
  assert.deepEqual(names, {
    main: ["Onion", "Potatoes"],
    spread: [],
    other: ["Onion", "Wheat flour"],
  });
});

test("amounts are summed per recipe type and sorted by name", () => {
  const sums = sumAmountsByType(
    [
      { recipe: soup, portions: 4 },
      { recipe: pancakes, portions: 4 },
      { recipe: soup, portions: 8 },
    ],
    ingredientsById,
  );
  assert.deepEqual(sums.main, [
    { name: "Onion", unit: "piece", amount: 3 },
    { name: "Potatoes", unit: "g", amount: 1800 },
  ]);
  assert.deepEqual(sums.spread, []);
  assert.deepEqual(sums.other, [
    { name: "Onion", unit: "piece", amount: 4 },
    { name: "Wheat flour", unit: "g", amount: 240 },
  ]);
});
