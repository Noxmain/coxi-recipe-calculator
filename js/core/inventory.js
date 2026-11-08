// @ts-check
import { isPlainObject } from "./utils.js";

/** @typedef {import("./types.js").Ingredient} Ingredient */
/** @typedef {import("./types.js").Inventory} Inventory */

/**
 * Validates the content of an inventory export and converts it.
 * Unknown ingredient ids are skipped and reported as warnings.
 * @param {unknown} data Parsed JSON content of the file.
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {{ inventory: Inventory, warnings: string[] }}
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

  return { inventory, warnings };
}
