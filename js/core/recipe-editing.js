// @ts-check
// Rules for creating, importing and editing recipes. Pure functions, no DOM.
// A recipe file has the same shape as recipes/<id>.json (see schemas/recipe.schema.json).
import { isPlainObject } from "./utils.js";
import { isWholeNumberAtLeastOne } from "./planner.js";

/** @typedef {import("./types.js").Recipe} Recipe */
/** @typedef {import("./types.js").Ingredient} Ingredient */

/**
 * A recipe as it is edited in the form. Empty optional numbers are undefined.
 * @typedef {Object} RecipeDraft
 * @property {string} id
 * @property {string} name
 * @property {"main" | "spread" | "other"} type
 * @property {number} [servings]
 * @property {number} [portionWeight]
 * @property {{ ingredientId: string, amount: number }[]} ingredients
 * @property {string[]} steps
 */

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RECIPE_TYPES = ["main", "spread", "other"];

/**
 * Turns a name into an id, e.g. "Red Pesto" becomes "red-pesto".
 * Accents are removed and every other character becomes a dash.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Creates an id from a name that is not in takenIds yet.
 * "recipe" is used when the name gives no usable id.
 * @param {string} name
 * @param {Set<string>} takenIds
 * @returns {string}
 */
export function createUniqueId(name, takenIds) {
  const base = slugify(name) || "recipe";
  let id = base;
  for (let counter = 2; takenIds.has(id); counter++) {
    id = `${base}-${counter}`;
  }
  return id;
}

/**
 * Checks a draft against the recipe rules. Returns messages for the user, an
 * empty list if the draft is valid. takenIds is only given for new recipes, so
 * their id must not exist yet.
 * @param {RecipeDraft} draft
 * @param {Map<string, Ingredient>} ingredientsById
 * @param {Set<string> | null} takenIds
 * @returns {string[]}
 */
export function validateRecipeDraft(draft, ingredientsById, takenIds) {
  /** @type {string[]} */
  const errors = [];

  if (!ID_PATTERN.test(draft.id)) {
    errors.push("The recipe id must use lowercase letters, digits and dashes.");
  } else if (takenIds?.has(draft.id)) {
    errors.push(`A recipe with the id "${draft.id}" already exists.`);
  }
  if (draft.name.trim() === "") {
    errors.push("The recipe needs a name.");
  }
  if (!RECIPE_TYPES.includes(draft.type)) {
    errors.push("Choose a type: main, spread or other.");
  }
  if (draft.servings !== undefined && !isWholeNumberAtLeastOne(draft.servings)) {
    errors.push("Servings must be a whole number of at least 1.");
  }
  if (draft.portionWeight !== undefined && !(draft.portionWeight > 0)) {
    errors.push("Portion weight must be greater than 0.");
  }

  if (draft.ingredients.length === 0) {
    errors.push("Add at least one ingredient.");
  }
  for (const { ingredientId, amount } of draft.ingredients) {
    if (ingredientId === "") {
      errors.push("Choose every ingredient from the list.");
    } else if (!ingredientsById.has(ingredientId)) {
      errors.push(`Unknown ingredient "${ingredientId}".`);
    }
    if (!(amount > 0)) {
      errors.push("Every ingredient needs an amount greater than 0.");
    }
  }

  if (!draft.steps.some((step) => step.trim() !== "")) {
    errors.push("Add at least one working step.");
  }
  return [...new Set(errors)];
}

/**
 * The content of a recipe file for a checked draft. Empty optional fields are
 * left out, the steps are trimmed and empty steps are removed.
 * @param {RecipeDraft} draft
 * @returns {Recipe}
 */
export function buildRecipeFile(draft) {
  /** @type {Record<string, unknown>} */
  const file = {
    schemaVersion: 1,
    id: draft.id,
    name: draft.name.trim(),
    type: draft.type,
    servings: draft.servings ?? 1,
  };
  if (draft.portionWeight !== undefined) {
    file.portionWeight = draft.portionWeight;
  }
  file.ingredients = draft.ingredients.map(({ ingredientId, amount }) => ({ ingredientId, amount }));
  file.steps = draft.steps.map((step) => step.trim()).filter((step) => step !== "");
  return /** @type {any} */ (file);
}

/**
 * Reads a recipe file imported by the user. Throws with a message if the file is not a valid recipe.
 * @param {unknown} data Parsed JSON content of the file.
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {Recipe}
 */
export function readRecipeFile(data, ingredientsById) {
  if (
    !isPlainObject(data) ||
    data.schemaVersion !== 1 ||
    typeof data.id !== "string" ||
    typeof data.name !== "string" ||
    typeof data.type !== "string" ||
    !Array.isArray(data.ingredients) ||
    !Array.isArray(data.steps) ||
    !data.steps.every((step) => typeof step === "string")
  ) {
    throw new Error("This file is not a valid recipe.");
  }

  const ingredients = data.ingredients.map((entry) => {
    if (!isPlainObject(entry) || typeof entry.ingredientId !== "string" || typeof entry.amount !== "number") {
      throw new Error("This file is not a valid recipe: an ingredient entry is malformed.");
    }
    return { ingredientId: entry.ingredientId, amount: entry.amount };
  });

  /** @type {RecipeDraft} */
  const draft = {
    id: data.id,
    name: data.name,
    type: /** @type {RecipeDraft["type"]} */ (data.type),
    servings: data.servings ?? 1,
    portionWeight: data.portionWeight,
    ingredients,
    steps: data.steps,
  };

  const errors = validateRecipeDraft(draft, ingredientsById, null);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
  return buildRecipeFile(draft);
}

/**
 * Factor for the ingredient amounts when the servings or the portion weight change.
 * The amounts follow the total food, which is servings × portion weight. Without a
 * portion weight only the servings count.
 * @param {{ servings: number, portionWeight?: number }} from The values the amounts belong to.
 * @param {{ servings: number, portionWeight?: number }} to The values to scale to.
 * @returns {number}
 */
export function scaleFactorForChange(from, to) {
  let factor = to.servings / from.servings;
  if (from.portionWeight !== undefined && to.portionWeight !== undefined) {
    factor *= to.portionWeight / from.portionWeight;
  }
  return factor;
}
