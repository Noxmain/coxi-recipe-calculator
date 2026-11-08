import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildShoppingItems,
  groupByShop,
  summarizePrices,
} from "../js/core/shopping.js";
import { indexById } from "../js/core/utils.js";

const ingredientsById = indexById([
  { id: "rice", name: "Rice", unit: "g", category: "Dry goods", packageSize: 500, packagePrice: 2, whereToBuy: "Supermarket" },
  { id: "salt", name: "Salt", unit: "g", packageSize: 1000, packagePrice: 0.6, whereToBuy: "Supermarket" },
  { id: "lemon", name: "Lemon", unit: "piece", category: "Fruit", packageSize: 1, packagePrice: 0.5 },
  { id: "water", name: "Water", unit: "ml" },
]);

test("the inventory is subtracted and only the rest is bought", () => {
  const items = buildShoppingItems(new Map([["rice", 600]]), { rice: 100 }, ingredientsById);
  const [rice] = items;
  assert.equal(rice.toBuy, 500);
  assert.equal(rice.packageCount, 1);
  assert.equal(rice.purchaseCost, 2);
  assert.ok(Math.abs(rice.usedValue - 2.4) < 1e-9);
});

test("packages are rounded up", () => {
  const [rice] = buildShoppingItems(new Map([["rice", 180]]), {}, ingredientsById);
  assert.equal(rice.packageCount, 1);
  assert.equal(rice.purchaseCost, 2);
});

test("an exact multiple of the package size does not add a package", () => {
  const [rice] = buildShoppingItems(new Map([["rice", 1000]]), {}, ingredientsById);
  assert.equal(rice.packageCount, 2);
});

test("floating point noise does not add a package", () => {
  const [rice] = buildShoppingItems(new Map([["rice", 500.0000000001]]), {}, ingredientsById);
  assert.equal(rice.packageCount, 1);
});

test("inventory that is not needed does not appear in the shopping list", () => {
  const items = buildShoppingItems(new Map([["rice", 100]]), { salt: 1000 }, ingredientsById);
  assert.deepEqual(items.map((item) => item.id), ["rice"]);
});

test("items without price data are kept and marked with null", () => {
  const [water] = buildShoppingItems(new Map([["water", 1500]]), {}, ingredientsById);
  assert.equal(water.toBuy, 1500);
  assert.equal(water.packageCount, null);
  assert.equal(water.usedValue, null);
  assert.equal(water.purchaseCost, null);
});

test("price summary counts only priced items and divides by people", () => {
  const items = buildShoppingItems(
    new Map([["rice", 600], ["water", 1000]]),
    { rice: 100 },
    ingredientsById,
  );
  const summary = summarizePrices(items, 2);
  assert.ok(Math.abs(summary.absoluteTotal - 2.4) < 1e-9);
  assert.ok(Math.abs(summary.absolutePerPerson - 1.2) < 1e-9);
  assert.equal(summary.purchaseTotal, 2);
  assert.equal(summary.purchasePerPerson, 1);
  assert.equal(summary.pricedCount, 1);
  assert.equal(summary.itemCount, 2);
});

test("groups are sorted by shop, with the group without shop last", () => {
  const items = buildShoppingItems(
    new Map([["lemon", 2], ["rice", 100], ["salt", 5], ["water", 1]]),
    {},
    ingredientsById,
  );
  const groups = groupByShop(items);

  assert.equal(groups[0].shop, "Supermarket");
  assert.equal(groups[1].shop, null);
});

test("items within a shop are sorted by category, then name, with no category last", () => {
  const items = buildShoppingItems(
    new Map([["lemon", 2], ["rice", 100], ["salt", 5], ["water", 1]]),
    {},
    ingredientsById,
  );
  const groups = groupByShop(items);

  assert.deepEqual(groups[0].items.map((item) => item.name), ["Rice", "Salt"]);
  assert.deepEqual(groups[1].items.map((item) => item.name), ["Lemon", "Water"]);
});
