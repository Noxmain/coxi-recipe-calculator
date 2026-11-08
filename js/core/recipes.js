// @ts-check
import { compareText, requireIngredient } from "./utils.js";

/** @typedef {import("./types.js").Recipe} Recipe */
/** @typedef {import("./types.js").Ingredient} Ingredient */
/** @typedef {import("./planner.js").PlanEntry} PlanEntry */

/**
 * @typedef {Object} TypeAmount
 * @property {string} name
 * @property {string} unit
 * @property {number} amount Summed amount, not rounded.
 */

/**
 * Number of people the ingredient amounts of a recipe are written for.
 * @param {Recipe} recipe
 * @returns {number}
 */
export function getServings(recipe) {
  return recipe.servings ?? 1;
}

/**
 * Factor by which all base amounts of a recipe are multiplied for a number of people.
 * @param {Recipe} recipe
 * @param {number} people
 * @returns {number}
 */
export function getScaleFactor(recipe, people) {
  return people / getServings(recipe);
}

/**
 * Adds up the amounts of all planned entries. Each entry is scaled by its own
 * number of portions. The result is not rounded.
 * @param {{ recipe: Recipe, portions: number }[]} entries
 * @returns {Map<string, number>} Ingredient id to needed amount.
 */
export function calculateNeededAmounts(entries) {
  /** @type {Map<string, number>} */
  const needed = new Map();
  for (const { recipe, portions } of entries) {
    const factor = getScaleFactor(recipe, portions);
    for (const { ingredientId, amount } of recipe.ingredients) {
      needed.set(ingredientId, (needed.get(ingredientId) ?? 0) + amount * factor);
    }
  }
  return needed;
}

/**
 * Returns a copy of the recipe with a new portion weight.
 * If scaleIngredients is true, all ingredient amounts are multiplied by
 * newPortionWeight / oldPortionWeight. The input recipe is not modified.
 * @param {Recipe} recipe
 * @param {number} newPortionWeight Weight in g.
 * @param {boolean} scaleIngredients
 * @returns {Recipe}
 */
export function changePortionWeight(recipe, newPortionWeight, scaleIngredients) {
  if (!(newPortionWeight > 0)) {
    throw new Error("Portion weight must be greater than 0.");
  }
  if (!scaleIngredients) {
    return { ...recipe, portionWeight: newPortionWeight };
  }
  if (recipe.portionWeight === undefined) {
    throw new Error("Cannot scale the ingredients: the recipe has no portion weight.");
  }

  const factor = newPortionWeight / recipe.portionWeight;
  return {
    ...recipe,
    portionWeight: newPortionWeight,
    ingredients: recipe.ingredients.map((entry) => ({
      ...entry,
      amount: entry.amount * factor,
    })),
  };
}

/**
 * Lists the names of all ingredients used in the selected recipes, grouped by
 * recipe type. Names are sorted alphabetically. An ingredient used in several
 * types appears in each of them. No amounts are included.
 * @param {Recipe[]} recipes
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {Record<Recipe["type"], string[]>}
 */
export function groupIngredientNamesByType(recipes, ingredientsById) {
  /** @type {Record<Recipe["type"], Set<string>>} */
  const namesByType = { main: new Set(), spread: new Set(), other: new Set() };

  for (const recipe of recipes) {
    for (const { ingredientId } of recipe.ingredients) {
      const ingredient = requireIngredient(ingredientsById, ingredientId);
      namesByType[recipe.type].add(ingredient.name);
    }
  }

  return {
    main: sortedNames(namesByType.main),
    spread: sortedNames(namesByType.spread),
    other: sortedNames(namesByType.other),
  };
}

/**
 * @param {Set<string>} names
 * @returns {string[]}
 */
function sortedNames(names) {
  return [...names].sort(compareText);
}

/**
 * Sums up the amounts of each ingredient per recipe type, for the planned entries.
 * Each list is sorted by name. Used for the sorting list.
 * @param {PlanEntry[]} entries
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {Record<Recipe["type"], TypeAmount[]>}
 */
export function sumAmountsByType(entries, ingredientsById) {
  /** @type {Record<Recipe["type"], Map<string, number>>} */
  const totals = { main: new Map(), spread: new Map(), other: new Map() };

  for (const { recipe, portions } of entries) {
    const factor = getScaleFactor(recipe, portions);
    const sums = totals[recipe.type];
    for (const { ingredientId, amount } of recipe.ingredients) {
      sums.set(ingredientId, (sums.get(ingredientId) ?? 0) + amount * factor);
    }
  }

  /** @param {Map<string, number>} sums @returns {TypeAmount[]} */
  const toSortedList = (sums) =>
    [...sums]
      .map(([id, amount]) => {
        const ingredient = requireIngredient(ingredientsById, id);
        return { name: ingredient.name, unit: ingredient.unit, amount };
      })
      .sort((a, b) => compareText(a.name, b.name));

  return {
    main: toSortedList(totals.main),
    spread: toSortedList(totals.spread),
    other: toSortedList(totals.other),
  };
}
