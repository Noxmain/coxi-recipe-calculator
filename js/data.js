// @ts-check
// Loads the repository data and merges it with the changes saved in this browser.
// Every page uses it, so all pages see the same ingredients and recipes.
import { mergeIngredients } from "./core/ingredient-editing.js";
import { mergeRecipes } from "./core/recipes.js";
import { readLocalIngredients, readLocalRecipes } from "./storage.js";

/** @typedef {import("./core/types.js").Ingredient} Ingredient */
/** @typedef {import("./core/types.js").Recipe} Recipe */

/**
 * @param {string} prefix Path from the page to the project root: "" on the main page, "../" on subpages.
 * @returns {Promise<{
 *   repoIngredients: Ingredient[],
 *   repoRecipes: Recipe[],
 *   ingredients: Ingredient[],
 *   recipes: Recipe[]
 * }>}
 */
export async function loadAppData(prefix) {
  const { ingredients: repoIngredients } = await loadJson(`${prefix}ingredients/ingredients.json`);
  const { recipes: recipeIds } = await loadJson(`${prefix}recipes/index.json`);
  const repoRecipes = await Promise.all(
    recipeIds.map((id) => loadJson(`${prefix}recipes/${id}.json`)),
  );

  return {
    repoIngredients,
    repoRecipes,
    ingredients: mergeIngredients(repoIngredients, readLocalIngredients()),
    recipes: mergeRecipes(repoRecipes, readLocalRecipes()),
  };
}

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (HTTP ${response.status}).`);
  }
  return response.json();
}
