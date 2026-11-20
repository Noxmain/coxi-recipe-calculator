// @ts-check
// Keeps the current inventory in the local storage of this browser, in the same
// format as the export file. The data stays on this device unless it is exported.
import { buildInventoryFile, parseInventory } from "../core/inventory.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Inventory} Inventory */

const STORAGE_KEY = "coxi-inventory";

/**
 * @typedef {Object} StoredInventory
 * @property {string} name
 * @property {Inventory} inventory
 */

/**
 * Reads the stored inventory. Returns null if nothing is stored or the stored data is invalid.
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {StoredInventory | null}
 */
export function loadStoredInventory(ingredientsById) {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
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
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildInventoryFile(name, inventory)));
    }
  } catch {
    // Storage is not available. The inventory still works for the current page view.
  }
}

/** Removes the stored inventory. */
export function clearStoredInventory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is not available, so there is nothing to remove.
  }
}
