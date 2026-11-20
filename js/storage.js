// @ts-check
// Everything this app keeps in the local storage of this browser.
// The data stays on this device and is never sent anywhere.
import { buildInventoryFile, parseInventory } from "./core/inventory.js";

/** @typedef {import("./core/types.js").Ingredient} Ingredient */
/** @typedef {import("./core/types.js").Inventory} Inventory */

const PLAN_KEY = "coxi-plan";
const INVENTORY_KEY = "coxi-inventory";

/**
 * @typedef {Object} StoredInventory
 * @property {string} name
 * @property {Inventory} inventory
 */

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

/** Deletes all data this app keeps in this browser: the saved plan and the inventory. */
export function clearAllLocalData() {
  clearStoredInventory();
  try {
    localStorage.removeItem(PLAN_KEY);
  } catch {
    // Storage is not available, so there is nothing to remove.
  }
}
