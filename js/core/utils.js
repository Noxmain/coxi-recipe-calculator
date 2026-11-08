// @ts-check

/**
 * Creates a lookup map from a list of entries that have an `id`.
 * @template {{ id: string }} T
 * @param {T[]} entries
 * @returns {Map<string, T>}
 */
export function indexById(entries) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

/**
 * Returns the ingredient for an id, or throws if it does not exist.
 * @param {Map<string, import("./types.js").Ingredient>} ingredientsById
 * @param {string} id
 * @returns {import("./types.js").Ingredient}
 */
export function requireIngredient(ingredientsById, id) {
  const ingredient = ingredientsById.get(id);
  if (!ingredient) {
    throw new Error(`Unknown ingredient id "${id}".`);
  }
  return ingredient;
}

/**
 * Locale-aware comparison of two texts. Used for all sorting.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareText(a, b) {
  return a.localeCompare(b, "en");
}

/**
 * Like compareText, but null sorts after all texts.
 * @param {string | null} a
 * @param {string | null} b
 * @returns {number}
 */
export function compareNullableText(a, b) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compareText(a, b);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
