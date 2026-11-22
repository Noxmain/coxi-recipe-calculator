// @ts-check
// The local changes of this browser as files in the format of the repository, so they can
// be added to a pull request. Pure functions, no DOM.
import { buildIngredientsFile } from "./ingredient-editing.js";
import { buildInventoryFile } from "./inventory.js";

/** @typedef {import("./types.js").Ingredient} Ingredient */
/** @typedef {import("./types.js").Inventory} Inventory */
/** @typedef {import("./types.js").Recipe} Recipe */

/**
 * @typedef {Object} ChangeFile
 * @property {string} fileName
 * @property {unknown} content The JSON content of the file.
 */

/**
 * @typedef {Object} LocalChanges
 * @property {Record<string, Recipe>} localRecipes Recipes saved in this browser, by id.
 * @property {Record<string, Ingredient>} localIngredients Ingredients saved in this browser, by id.
 * @property {Ingredient[]} ingredients The complete list: repository ingredients with the local changes.
 * @property {{ name: string, inventory: Inventory } | null} inventory The stored inventory, if any.
 */

/**
 * One file per local recipe, the complete ingredient list if there are local ingredients,
 * and the stored inventory. An empty list means there are no local changes.
 * @param {LocalChanges} changes
 * @returns {ChangeFile[]}
 */
export function buildChangeFiles({ localRecipes, localIngredients, ingredients, inventory }) {
  /** @type {ChangeFile[]} */
  const files = Object.entries(localRecipes).map(([id, recipe]) => ({
    fileName: `${id}.json`,
    content: recipe,
  }));
  if (Object.keys(localIngredients).length > 0) {
    files.push({ fileName: "ingredients.json", content: buildIngredientsFile(ingredients) });
  }
  if (inventory) {
    files.push({
      fileName: inventoryFileName(inventory.name),
      content: buildInventoryFile(inventory.name, inventory.inventory),
    });
  }
  return files;
}

/**
 * @param {string} name
 * @returns {string} For example "inventory-pantry-may.json".
 */
function inventoryFileName(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `inventory-${slug}.json` : "inventory.json";
}
