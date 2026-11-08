// @ts-check
// Loads an inventory export from the user's disk. The inventory is kept in
// memory only and is never written to the URL.
import { parseInventory } from "../core/inventory.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Inventory} Inventory */

const NO_INVENTORY_TEXT = "No inventory loaded. Everything counts as not in stock.";

/**
 * Connects the inventory file input and the remove button of the main page.
 * @param {Map<string, Ingredient>} ingredientsById
 * @param {(messages: string[]) => void} onChange Called after every load or removal
 *   with the warnings or errors to show.
 * @returns {{ getInventory: () => Inventory }}
 */
export function initInventoryImport(ingredientsById, onChange) {
  const fileInput = /** @type {HTMLInputElement} */ (document.querySelector("#inventory-file"));
  const removeButton = /** @type {HTMLButtonElement} */ (document.querySelector("#inventory-remove"));
  const status = /** @type {HTMLElement} */ (document.querySelector("#inventory-status"));

  /** @type {Inventory} */
  let inventory = {};

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());
      const result = parseInventory(data, ingredientsById);
      inventory = result.inventory;
      status.textContent = `Loaded ${file.name}: ${Object.keys(inventory).length} items.`;
      removeButton.hidden = false;
      onChange(result.warnings);
    } catch (error) {
      // The previously loaded inventory stays in place.
      onChange([`The inventory file could not be loaded. ${/** @type {Error} */ (error).message}`]);
    } finally {
      // Lets the user load the same file again.
      fileInput.value = "";
    }
  });

  removeButton.addEventListener("click", () => {
    inventory = {};
    status.textContent = NO_INVENTORY_TEXT;
    removeButton.hidden = true;
    onChange([]);
  });

  return { getInventory: () => inventory };
}
