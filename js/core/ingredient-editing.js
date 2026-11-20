// @ts-check
// Rules for ingredients: checking, building the stored record, unit conversion of
// recipes, merging with the ingredients saved in this browser, and grouping.
// Pure functions, no DOM.
import { compareNullableText, compareText, isPlainObject } from "./utils.js";
import { createUniqueId } from "./recipe-editing.js";

/** @typedef {import("./types.js").Ingredient} Ingredient */
/** @typedef {import("./types.js").Recipe} Recipe */

/**
 * An ingredient as it is edited in the form. Empty optional values are empty strings or undefined.
 * @typedef {Object} IngredientDraft
 * @property {string} id
 * @property {string} name
 * @property {string} unit
 * @property {string} category
 * @property {number | undefined} packageSize
 * @property {number | undefined} packagePrice
 * @property {string} whereToBuy
 */

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UNCATEGORIZED = "Uncategorized";
const COMPARED_FIELDS = ["name", "unit", "category", "packageSize", "packagePrice", "whereToBuy"];

/**
 * Rounds away floating point noise, e.g. 0.30000000000000004 becomes 0.3.
 * @param {number} value
 * @returns {number}
 */
export function roundAmount(value) {
  return Number(value.toPrecision(12));
}

/**
 * Checks a draft. takenIds is only given for new ingredients.
 * @param {IngredientDraft} draft
 * @param {Set<string> | null} takenIds
 * @returns {string[]} Messages for the user, empty if the draft is valid.
 */
export function validateIngredientDraft(draft, takenIds) {
  /** @type {string[]} */
  const errors = [];

  if (!ID_PATTERN.test(draft.id)) {
    errors.push("The ingredient id must use lowercase letters, digits and dashes.");
  } else if (takenIds?.has(draft.id)) {
    errors.push(`An ingredient with the id "${draft.id}" already exists.`);
  }
  if (draft.name.trim() === "") {
    errors.push("The ingredient needs a name.");
  }
  if (draft.unit.trim() === "") {
    errors.push("The ingredient needs a unit, for example g, piece or clove.");
  }

  const hasSize = draft.packageSize !== undefined;
  const hasPrice = draft.packagePrice !== undefined;
  if (hasSize !== hasPrice) {
    errors.push("Package size and package price must be given together.");
  }
  if (hasSize && !(/** @type {number} */ (draft.packageSize) > 0)) {
    errors.push("The package size must be greater than 0.");
  }
  if (hasPrice && !(/** @type {number} */ (draft.packagePrice) >= 0)) {
    errors.push("The package price cannot be negative.");
  }
  return [...new Set(errors)];
}

/**
 * The stored form of a checked draft. Empty optional fields are left out.
 * @param {IngredientDraft} draft
 * @returns {Ingredient}
 */
export function buildIngredientRecord(draft) {
  /** @type {Record<string, unknown>} */
  const record = { id: draft.id, name: draft.name.trim(), unit: draft.unit.trim() };
  if (draft.category.trim() !== "") {
    record.category = draft.category.trim();
  }
  if (draft.packageSize !== undefined && draft.packagePrice !== undefined) {
    record.packageSize = draft.packageSize;
    record.packagePrice = draft.packagePrice;
  }
  if (draft.whereToBuy.trim() !== "") {
    record.whereToBuy = draft.whereToBuy.trim();
  }
  return /** @type {Ingredient} */ (record);
}

/**
 * Reads an ingredient list imported by the user. Throws with a message if it is not valid.
 * @param {unknown} data Parsed JSON content of the file.
 * @returns {Ingredient[]}
 */
export function readIngredientFile(data) {
  if (!isPlainObject(data) || data.schemaVersion !== 1 || !Array.isArray(data.ingredients)) {
    throw new Error("This file is not a valid ingredient list.");
  }

  const ids = new Set();
  return data.ingredients.map((entry) => {
    if (
      !isPlainObject(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.name !== "string" ||
      typeof entry.unit !== "string"
    ) {
      throw new Error("This file is not a valid ingredient list: an entry is malformed.");
    }

    /** @type {IngredientDraft} */
    const draft = {
      id: entry.id,
      name: entry.name,
      unit: entry.unit,
      category: typeof entry.category === "string" ? entry.category : "",
      packageSize: typeof entry.packageSize === "number" ? entry.packageSize : undefined,
      packagePrice: typeof entry.packagePrice === "number" ? entry.packagePrice : undefined,
      whereToBuy: typeof entry.whereToBuy === "string" ? entry.whereToBuy : "",
    };
    const errors = validateIngredientDraft(draft, null);
    if (errors.length > 0) {
      throw new Error(`Ingredient "${entry.id}": ${errors.join(" ")}`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`Ingredient "${entry.id}" is listed twice.`);
    }
    ids.add(entry.id);
    return buildIngredientRecord(draft);
  });
}

/**
 * The content of an ingredients.json file.
 * @param {Ingredient[]} ingredients
 * @returns {{ schemaVersion: 1, ingredients: Ingredient[] }}
 */
export function buildIngredientsFile(ingredients) {
  return { schemaVersion: 1, ingredients };
}

/**
 * Combines the repository ingredients with the saved ones. A saved ingredient replaces
 * the repository ingredient with the same id. Saved ingredients without a counterpart are added.
 * @param {Ingredient[]} repoIngredients
 * @param {Record<string, Ingredient>} localIngredients
 * @returns {Ingredient[]}
 */
export function mergeIngredients(repoIngredients, localIngredients) {
  const repoIds = new Set(repoIngredients.map((ingredient) => ingredient.id));
  const replaced = repoIngredients.map((ingredient) =>
    Object.hasOwn(localIngredients, ingredient.id) ? localIngredients[ingredient.id] : ingredient,
  );
  const added = Object.values(localIngredients).filter((ingredient) => !repoIds.has(ingredient.id));
  return [...replaced, ...added];
}

/**
 * True if both ingredients have the same content, regardless of key order.
 * @param {Ingredient} a
 * @param {Ingredient} b
 * @returns {boolean}
 */
export function isSameIngredient(a, b) {
  const left = /** @type {Record<string, unknown>} */ (a);
  const right = /** @type {Record<string, unknown>} */ (b);
  return COMPARED_FIELDS.every((field) => left[field] === right[field]);
}

/**
 * Recipes that use the ingredient.
 * @param {Recipe[]} recipes
 * @param {string} ingredientId
 * @returns {Recipe[]}
 */
export function usingRecipes(recipes, ingredientId) {
  return recipes.filter((recipe) =>
    recipe.ingredients.some((entry) => entry.ingredientId === ingredientId),
  );
}

/**
 * Copy of a recipe with the amounts of one ingredient multiplied by the factor.
 * Used when the unit of the ingredient changes, e.g. 1 clove = 3 g.
 * @param {Recipe} recipe
 * @param {string} ingredientId
 * @param {number} factor
 * @returns {Recipe}
 */
export function convertRecipeAmounts(recipe, ingredientId, factor) {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((entry) =>
      entry.ingredientId === ingredientId
        ? { ...entry, amount: roundAmount(entry.amount * factor) }
        : entry,
    ),
  };
}

/**
 * Groups ingredients by category. Categories are sorted alphabetically, the group
 * without category comes last. Ingredients are sorted by name.
 * @param {Ingredient[]} ingredients
 * @returns {{ title: string, ingredients: Ingredient[] }[]}
 */
export function groupByCategory(ingredients) {
  /** @type {Map<string | null, Ingredient[]>} */
  const byCategory = new Map();
  for (const ingredient of ingredients) {
    const key = ingredient.category ?? null;
    byCategory.set(key, [...(byCategory.get(key) ?? []), ingredient]);
  }

  return [...byCategory]
    .sort(([a], [b]) => compareNullableText(a, b))
    .map(([category, list]) => ({
      title: category ?? UNCATEGORIZED,
      ingredients: [...list].sort((a, b) => compareText(a.name, b.name)),
    }));
}
