// @ts-check
// Inventory section of the main page: shows the stored inventory, loads an inventory
// file and removes the inventory. Editing happens on the inventory page.
import { parseInventory } from "../core/inventory.js";
import { clearStoredInventory, loadStoredInventory, saveStoredInventory } from "./inventory-storage.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Inventory} Inventory */

const NO_INVENTORY_TEXT = "No inventory loaded. Everything counts as not in stock.";

/**
 * Connects the inventory controls of the main page.
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
  let name = "";

  const stored = loadStoredInventory(ingredientsById);
  if (stored) {
    name = stored.name;
    inventory = stored.inventory;
  }
  showStatus();
  removeButton.hidden = stored === null;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const result = parseInventory(JSON.parse(await file.text()), ingredientsById);
      name = result.name;
      inventory = result.inventory;
      saveStoredInventory(name, inventory);
      showStatus();
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
    clearStoredInventory();
    inventory = {};
    name = "";
    showStatus();
    removeButton.hidden = true;
    onChange([]);
  });

  function showStatus() {
    status.textContent =
      name === ""
        ? NO_INVENTORY_TEXT
        : `Inventory "${name}" is in use (${Object.keys(inventory).length} items).`;
  }

  return { getInventory: () => inventory };
}
