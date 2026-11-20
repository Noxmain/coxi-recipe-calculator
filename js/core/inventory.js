// @ts-check
import { compareText, isPlainObject } from "./utils.js";

/** @typedef {import("./types.js").Ingredient} Ingredient */
/** @typedef {import("./types.js").Inventory} Inventory */

/** Name used when an inventory is exported without a name. */
export const DEFAULT_INVENTORY_NAME = "Inventory";

/**
 * @typedef {Object} ParsedInventory
 * @property {string} name
 * @property {Inventory} inventory
 * @property {string[]} warnings Messages about skipped entries.
 */

/**
 * Validates the content of an inventory file and converts it.
 * Unknown ingredient ids are skipped and reported as warnings.
 * @param {unknown} data Parsed JSON content of the file.
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {ParsedInventory}
 */
export function parseInventory(data, ingredientsById) {
  if (
    !isPlainObject(data) ||
    data.schemaVersion !== 1 ||
    data.kind !== "inventory" ||
    !isPlainObject(data.items)
  ) {
    throw new Error("This file is not a valid inventory export.");
  }
  if (typeof data.name !== "string" || data.name.trim() === "") {
    throw new Error("The inventory file has no name.");
  }

  /** @type {Inventory} */
  const inventory = {};
  /** @type {string[]} */
  const warnings = [];

  for (const [id, amount] of Object.entries(data.items)) {
    if (typeof amount !== "number" || !(amount >= 0)) {
      throw new Error(`Invalid amount for "${id}".`);
    }
    if (!ingredientsById.has(id)) {
      warnings.push(`Unknown ingredient "${id}" was skipped.`);
      continue;
    }
    inventory[id] = amount;
  }

  return { name: data.name.trim(), inventory, warnings };
}

/**
 * Builds the content of an inventory export. Items are sorted by id, and an
 * empty name is replaced by DEFAULT_INVENTORY_NAME.
 * @param {string} name
 * @param {Inventory} inventory
 * @returns {{ schemaVersion: 1, kind: "inventory", name: string, items: Inventory }}
 */
export function buildInventoryFile(name, inventory) {
  const items = Object.fromEntries(
    Object.entries(inventory).sort(([a], [b]) => compareText(a, b)),
  );
  return {
    schemaVersion: 1,
    kind: "inventory",
    name: name.trim() || DEFAULT_INVENTORY_NAME,
    items,
  };
}
