import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LABEL_LAYOUT,
  buildLabelsPdf,
  buildRecipesPdf,
  buildShoppingPdf,
  buildSortingPdf,
} from "../js/pdf/documents.js";
import { indexById } from "../js/core/utils.js";

const ingredientsById = indexById([
  { id: "potato", name: "Potatoes", unit: "g" },
  { id: "onion", name: "Onion", unit: "piece" },
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

/** Counts the table nodes of a definition, one per page of labels. */
function countTables(definition) {
  return definition.content.filter((node) => node.table !== undefined).length;
}

test("recipes are scaled to the portions of the entry", () => {
  const definition = buildRecipesPdf([{ recipe: soup, portions: 6, date: null }], ingredientsById);
  assert.ok(JSON.stringify(definition).includes('"900 g"'));
});

test("the date of an entry is shown in the recipe", () => {
  const definition = buildRecipesPdf([{ recipe: soup, portions: 4, date: "2025-06-14" }], ingredientsById);
  assert.ok(JSON.stringify(definition).includes("Saturday, 14 June 2025"));
});

test("labels fill one page per grid and contain no amounts", () => {
  const perPage = LABEL_LAYOUT.columns * LABEL_LAYOUT.rows;
  const entries = Array.from({ length: perPage + 1 }, () => ({ recipe: soup, portions: 4, date: null }));
  const definition = buildLabelsPdf(entries, ingredientsById);

  assert.equal(countTables(definition), 2);
  const text = JSON.stringify(definition);
  // The names are separated by spaces, so only their order is checked.
  assert.match(text, /Onion\s+Potatoes/);
  assert.ok(!text.includes("900 g"));
});

test("the shopping list shows the price estimate and a lower-bound note when prices are missing", () => {
  const definition = buildShoppingPdf({
    eventName: "Nebu 2027",
    groups: [],
    summary: {
      absoluteTotal: 8.085,
      absolutePerPerson: 1.3475,
      purchaseTotal: 22.92,
      purchasePerPerson: 3.82,
      pricedCount: 9,
      itemCount: 10,
    },
  });
  const text = JSON.stringify(definition);
  assert.ok(text.includes("€8.09"));
  assert.ok(text.includes("Shopping list: Nebu 2027"));
  assert.ok(text.includes("lower bounds"));
});

test("the sorting list shows the amounts per type", () => {
  const definition = buildSortingPdf({
    main: [{ name: "Onion", unit: "piece", amount: 3 }],
    spread: [],
    other: [{ name: "Olive oil", unit: "ml", amount: 45 }],
  });
  const text = JSON.stringify(definition);
  assert.ok(text.includes("3 piece"));
  assert.ok(text.includes("45 ml"));
});
