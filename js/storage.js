// @ts-check
// Everything this app keeps in the local storage of this browser.
// The data stays on this device and is never sent anywhere.
import { buildInventoryFile, parseInventory } from "./core/inventory.js";

/** @typedef {import("./core/types.js").Ingredient} Ingredient */
/** @typedef {import("./core/types.js").Inventory} Inventory */
/** @typedef {import("./core/types.js").Recipe} Recipe */

const PLAN_KEY = "coxi-plan";
const INVENTORY_KEY = "coxi-inventory";
const RECIPES_KEY = "coxi-recipes";
const INGREDIENTS_KEY = "coxi-ingredients";

/**
 * @typedef {Object} StoredInventory
 * @property {string} name
 * @property {Inventory} inventory
 */

/**
 * Reads a map of records (by id) from the local storage. Returns {} if nothing is stored or it is unreadable.
 * @param {string} key
 * @returns {Record<string, any>}
 */
function readRecords(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? "{}");
    return data !== null && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

/**
 * @param {string} key
 * @param {Record<string, unknown>} records
 */
function writeRecords(key, records) {
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch {
    // Storage is not available, so the change is not kept.
  }
}

/**
 * Adds or replaces records by their id.
 * @param {string} key
 * @param {{ id: string }[]} items
 */
function upsertRecords(key, items) {
  writeRecords(key, {
    ...readRecords(key),
    ...Object.fromEntries(items.map((item) => [item.id, item])),
  });
}

/**
 * @param {string} key
 * @param {string} id
 */
function removeRecord(key, id) {
  const records = readRecords(key);
  delete records[id];
  writeRecords(key, records);
}

/** @returns {string | null} The saved plan as query string, or null if there is none. */
export function readSavedPlan() {
  try {
    return localStorage.getItem(PLAN_KEY);
  } catch {
    return null;
  }
}

/** @param {string} query The plan as query string. */
export function savePlan(query) {
  try {
    localStorage.setItem(PLAN_KEY, query);
  } catch {
    // Storage is not available, for example in some private browsing modes.
  }
}

/**
 * Reads the stored inventory. Returns null if nothing is stored or the stored data is invalid.
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {StoredInventory | null}
 */
export function loadStoredInventory(ingredientsById) {
  try {
    const text = localStorage.getItem(INVENTORY_KEY);
    if (text === null) return null;
    const { name, inventory } = parseInventory(JSON.parse(text), ingredientsById);
    return { name, inventory };
  } catch {
    return null;
  }
}

/**
 * Stores the inventory. If the name is empty and no amount is set, the stored inventory is removed.
 * @param {string} name
 * @param {Inventory} inventory
 */
export function saveStoredInventory(name, inventory) {
  try {
    if (name.trim() === "" && Object.keys(inventory).length === 0) {
      localStorage.removeItem(INVENTORY_KEY);
    } else {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(buildInventoryFile(name, inventory)));
    }
  } catch {
    // Storage is not available. The inventory still works for the current page view.
  }
}

/** Removes the stored inventory. */
export function clearStoredInventory() {
  try {
    localStorage.removeItem(INVENTORY_KEY);
  } catch {
    // Storage is not available, so there is nothing to remove.
  }
}

/** @returns {Record<string, Recipe>} Recipes saved in this browser, by id. */
export function readLocalRecipes() {
  return readRecords(RECIPES_KEY);
}

/** @param {Recipe} recipe */
export function saveLocalRecipe(recipe) {
  upsertRecords(RECIPES_KEY, [recipe]);
}

/** @param {Recipe[]} recipes */
export function saveLocalRecipes(recipes) {
  upsertRecords(RECIPES_KEY, recipes);
}

/** @param {string} id The saved version is removed. A repository recipe with the same id is used again. */
export function deleteLocalRecipe(id) {
  removeRecord(RECIPES_KEY, id);
}

/** @returns {Record<string, Ingredient>} Ingredients saved in this browser, by id. */
export function readLocalIngredients() {
  return readRecords(INGREDIENTS_KEY);
}

/** @param {Ingredient} ingredient */
export function saveLocalIngredient(ingredient) {
  upsertRecords(INGREDIENTS_KEY, [ingredient]);
}

/** @param {string} id The saved version is removed. A repository ingredient with the same id is used again. */
export function deleteLocalIngredient(id) {
  removeRecord(INGREDIENTS_KEY, id);
}

/** Deletes all data this app keeps in this browser: plan, inventory, saved recipes and saved ingredients. */
export function clearAllLocalData() {
  clearStoredInventory();
  try {
    localStorage.removeItem(PLAN_KEY);
    localStorage.removeItem(RECIPES_KEY);
    localStorage.removeItem(INGREDIENTS_KEY);
  } catch {
    // Storage is not available, so there is nothing to remove.
  }
}

/**
 * Multiplies the stored inventory amount of one ingredient. Used when its unit changes.
 * @param {string} ingredientId
 * @param {number} factor
 */
export function convertStoredInventoryAmount(ingredientId, factor) {
  try {
    const text = localStorage.getItem(INVENTORY_KEY);
    if (text === null) return;
    const file = JSON.parse(text);
    if (file.items && Object.hasOwn(file.items, ingredientId)) {
      file.items[ingredientId] = Number((file.items[ingredientId] * factor).toPrecision(12));
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(file));
    }
  } catch {
    // Storage is not available or the stored data is unreadable. Nothing is converted.
  }
}
