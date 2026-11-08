// @ts-check
import { compareNullableText, compareText, requireIngredient } from "./utils.js";

/** @typedef {import("./types.js").Ingredient} Ingredient */
/** @typedef {import("./types.js").Inventory} Inventory */
/** @typedef {import("./types.js").ShoppingItem} ShoppingItem */
/** @typedef {import("./types.js").ShoppingGroup} ShoppingGroup */
/** @typedef {import("./types.js").PriceSummary} PriceSummary */

/**
 * Tolerance for floating point noise. Without it, 500.0000000001 g would
 * need two packages of 500 g.
 */
const FLOAT_TOLERANCE = 1e-9;

/**
 * Builds one shopping item per needed ingredient. Inventory entries that are
 * not needed by the selected recipes are ignored.
 * @param {Map<string, number>} neededAmounts From calculateNeededAmounts().
 * @param {Inventory} inventory
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {ShoppingItem[]}
 */
export function buildShoppingItems(neededAmounts, inventory, ingredientsById) {
  /** @type {ShoppingItem[]} */
  const items = [];
  for (const [id, needed] of neededAmounts) {
    const ingredient = requireIngredient(ingredientsById, id);
    const inStock = Object.hasOwn(inventory, id) ? inventory[id] : 0;
    const toBuy = Math.max(0, needed - inStock);
    items.push(createShoppingItem(ingredient, needed, inStock, toBuy));
  }
  return items;
}

/**
 * @param {Ingredient} ingredient
 * @param {number} needed
 * @param {number} inStock
 * @param {number} toBuy
 * @returns {ShoppingItem}
 */
function createShoppingItem(ingredient, needed, inStock, toBuy) {
  /** @type {ShoppingItem} */
  const base = {
    id: ingredient.id,
    name: ingredient.name,
    unit: ingredient.unit,
    category: ingredient.category ?? null,
    whereToBuy: ingredient.whereToBuy ?? null,
    needed,
    inStock,
    toBuy,
    packageCount: null,
    usedValue: null,
    purchaseCost: null,
  };

  const { packageSize, packagePrice } = ingredient;
  if (packageSize === undefined || packagePrice === undefined) {
    // No price data: the item stays in the list and is shown as unpriced.
    return base;
  }

  const packageCount = toBuy > 0 ? Math.ceil(toBuy / packageSize - FLOAT_TOLERANCE) : 0;
  return {
    ...base,
    packageCount,
    usedValue: (needed / packageSize) * packagePrice,
    purchaseCost: packageCount * packagePrice,
  };
}

/**
 * Sums up the prices. "Absolute" is the value of everything the recipes use.
 * "Purchase" is the price of the whole packages that still have to be bought.
 * Items without price data are skipped and counted separately.
 * @param {ShoppingItem[]} items
 * @param {number} people
 * @returns {PriceSummary}
 */
export function summarizePrices(items, people) {
  let absoluteTotal = 0;
  let purchaseTotal = 0;
  let pricedCount = 0;

  for (const item of items) {
    if (item.usedValue === null || item.purchaseCost === null) continue;
    absoluteTotal += item.usedValue;
    purchaseTotal += item.purchaseCost;
    pricedCount++;
  }

  return {
    absoluteTotal,
    absolutePerPerson: absoluteTotal / people,
    purchaseTotal,
    purchasePerPerson: purchaseTotal / people,
    pricedCount,
    itemCount: items.length,
  };
}

/**
 * Groups the items by shop. Shops are sorted alphabetically, and the group
 * without a shop comes last. Within a group, items are sorted by category
 * (no category last), then by name.
 * @param {ShoppingItem[]} items
 * @returns {ShoppingGroup[]}
 */
export function groupByShop(items) {
  /** @type {Map<string | null, ShoppingItem[]>} */
  const itemsByShop = new Map();
  for (const item of items) {
    const list = itemsByShop.get(item.whereToBuy) ?? [];
    list.push(item);
    itemsByShop.set(item.whereToBuy, list);
  }

  return [...itemsByShop]
    .map(([shop, list]) => ({ shop, items: [...list].sort(compareForShopping) }))
    .sort((a, b) => compareNullableText(a.shop, b.shop));
}

/**
 * @param {ShoppingItem} a
 * @param {ShoppingItem} b
 * @returns {number}
 */
function compareForShopping(a, b) {
  return compareNullableText(a.category, b.category) || compareText(a.name, b.name);
}
