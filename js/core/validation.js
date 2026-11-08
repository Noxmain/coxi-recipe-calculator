// @ts-check

/** @typedef {import("./types.js").Ingredient} Ingredient */
/** @typedef {import("./types.js").Recipe} Recipe */

/**
 * @typedef {Object} RecipeFile
 * @property {string} fileName For example "chili-sin-carne.json".
 * @property {Recipe} recipe
 */

/**
 * Checks relations between the data files. JSON Schema cannot check these.
 * @param {{ ingredients: Ingredient[], recipeFiles: RecipeFile[], recipeIndex: string[] }} data
 * @returns {string[]} Error messages. Empty if the data is consistent.
 */
export function validateDataset({ ingredients, recipeFiles, recipeIndex }) {
  /** @type {string[]} */
  const errors = [];

  /** @type {Set<string>} */
  const ingredientIds = new Set();
  for (const ingredient of ingredients) {
    if (ingredientIds.has(ingredient.id)) {
      errors.push(`Duplicate ingredient id "${ingredient.id}".`);
    }
    ingredientIds.add(ingredient.id);
  }

  /** @type {Set<string>} */
  const recipeIds = new Set();
  for (const { fileName, recipe } of recipeFiles) {
    if (fileName !== `${recipe.id}.json`) {
      errors.push(`File "${fileName}" does not match recipe id "${recipe.id}".`);
    }
    if (recipeIds.has(recipe.id)) {
      errors.push(`Duplicate recipe id "${recipe.id}".`);
    }
    recipeIds.add(recipe.id);

    for (const { ingredientId } of recipe.ingredients) {
      if (!ingredientIds.has(ingredientId)) {
        errors.push(`Recipe "${recipe.id}" uses unknown ingredient "${ingredientId}".`);
      }
    }
  }

  /** @type {Set<string>} */
  const listedIds = new Set();
  for (const id of recipeIndex) {
    if (listedIds.has(id)) {
      errors.push(`Recipe "${id}" is listed twice in index.json.`);
    }
    listedIds.add(id);
    if (!recipeIds.has(id)) {
      errors.push(`index.json lists "${id}", but no such recipe file exists.`);
    }
  }
  for (const id of recipeIds) {
    if (!listedIds.has(id)) {
      errors.push(`Recipe "${id}" is missing in index.json.`);
    }
  }

  return errors;
}
