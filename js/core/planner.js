// @ts-check

/** @typedef {import("./types.js").Recipe} Recipe */

/**
 * One row of the planner. A row without a recipe is empty and ignored.
 * @typedef {Object} PlanRow
 * @property {string | null} recipeId
 * @property {string | null} date Calendar date as "YYYY-MM-DD", or null.
 * @property {number} portions Number of portions this row is calculated for.
 */

/**
 * A planned recipe with the portions it is calculated for.
 * @typedef {Object} PlanEntry
 * @property {Recipe} recipe
 * @property {number} portions
 * @property {string | null} date
 */

/** One entry of the "r" parameter: recipe id, portions and optional date. */
const ROW_PATTERN = /^([a-z0-9-]+):(\d+)(?:@(\d{4}-\d{2}-\d{2}))?$/;

/**
 * True for whole numbers from 1 upwards, the only valid counts of people or portions.
 * @param {number} value
 * @returns {boolean}
 */
export function isWholeNumberAtLeastOne(value) {
  return Number.isInteger(value) && value >= 1;
}

/**
 * Turns the planner rows into entries for the calculation. Empty rows are
 * skipped. The same recipe may appear several times, also on the same day.
 * @param {PlanRow[]} rows
 * @param {Map<string, Recipe>} recipesById
 * @returns {{ entries: PlanEntry[], missingIds: string[] }}
 */
export function resolvePlan(rows, recipesById) {
  /** @type {PlanEntry[]} */
  const entries = [];
  /** @type {string[]} */
  const missingIds = [];

  for (const row of rows) {
    if (row.recipeId === null) continue;

    const recipe = recipesById.get(row.recipeId);
    if (!recipe) {
      missingIds.push(row.recipeId);
      continue;
    }
    if (!isWholeNumberAtLeastOne(row.portions)) {
      throw new Error(`Portions for "${recipe.name}" must be a whole number of at least 1.`);
    }
    entries.push({ recipe, portions: row.portions, date: row.date });
  }

  return { entries, missingIds };
}

/**
 * Writes the number of people, the event name and all non-empty rows into a
 * query string, e.g. "?p=6&e=Nebu%202027&r=chili-sin-carne:6@2025-06-14,pancakes:2".
 * The event name is URL-encoded. It is omitted when empty.
 * @param {{ people: number, eventName?: string, rows: PlanRow[] }} plan
 * @returns {string}
 */
export function encodePlanUrl({ people, eventName = "", rows }) {
  if (!isWholeNumberAtLeastOne(people)) {
    throw new Error("The number of people must be a whole number of at least 1.");
  }

  const planned = rows
    .filter((row) => row.recipeId !== null)
    .map((row) => {
      const date = row.date ? `@${row.date}` : "";
      return `${row.recipeId}:${row.portions}${date}`;
    });

  const parts = [`p=${people}`];
  const name = eventName.trim();
  if (name !== "") {
    parts.push(`e=${encodeURIComponent(name)}`);
  }
  if (planned.length > 0) {
    parts.push(`r=${planned.join(",")}`);
  }
  return `?${parts.join("&")}`;
}

/**
 * Reads the plan from a query string. Unknown recipe ids are reported in
 * missingIds. Malformed entries are skipped and described in warnings.
 * @param {string} search Query string, with or without leading "?".
 * @param {Map<string, Recipe>} recipesById
 * @returns {{
 *   people: number | null,
 *   eventName: string,
 *   rows: PlanRow[],
 *   missingIds: string[],
 *   warnings: string[]
 * }}
 */
export function parsePlanUrl(search, recipesById) {
  const params = new URLSearchParams(search);

  const peopleText = params.get("p");
  const people =
    peopleText !== null && isWholeNumberAtLeastOne(Number(peopleText))
      ? Number(peopleText)
      : null;

  const eventName = params.get("e") ?? "";

  /** @type {PlanRow[]} */
  const rows = [];
  /** @type {string[]} */
  const missingIds = [];
  /** @type {string[]} */
  const warnings = [];

  const parts = (params.get("r") ?? "").split(",").filter((part) => part !== "");
  for (const part of parts) {
    const match = ROW_PATTERN.exec(part);
    if (!match) {
      warnings.push(`Ignored invalid plan entry "${part}".`);
      continue;
    }

    const [, recipeId, portionsText, date] = match;
    const portions = Number(portionsText);
    if (!isWholeNumberAtLeastOne(portions)) {
      warnings.push(`Ignored plan entry "${part}": portions must be at least 1.`);
      continue;
    }
    if (!recipesById.has(recipeId)) {
      missingIds.push(recipeId);
      continue;
    }
    rows.push({ recipeId, date: date ?? null, portions });
  }

  return { people, eventName, rows, missingIds, warnings };
}
