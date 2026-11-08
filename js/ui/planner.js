// @ts-check
import { encodePlanUrl, isWholeNumberAtLeastOne, parsePlanUrl } from "../core/planner.js";
import { compareText } from "../core/utils.js";

/** @typedef {import("../core/types.js").Recipe} Recipe */
/** @typedef {import("../core/planner.js").PlanRow} PlanRow */

/** Number of people when the URL does not set one. Change here if needed. */
const DEFAULT_PEOPLE = 100;

/** @type {Recipe["type"][]} */
const SECTION_TYPES = ["main", "spread", "other"];

const weekdayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/**
 * Builds the planner: the number of people, the event name and one section per
 * recipe type. Loads the initial state from the URL and calls onChange after every edit.
 * @param {Recipe[]} recipes
 * @param {() => void} onChange
 * @returns {{
 *   getPeople: () => number,
 *   getRows: () => PlanRow[],
 *   getQuery: () => string,
 *   notices: string[]
 * }}
 */
export function initPlanner(recipes, onChange) {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const recipesByName = [...recipes].sort((a, b) => compareText(a.name, b.name));
  const peopleInput = /** @type {HTMLInputElement} */ (document.querySelector("#people"));
  const eventInput = /** @type {HTMLInputElement} */ (document.querySelector("#event-name"));
  const rowTemplate = /** @type {HTMLTemplateElement} */ (document.querySelector("#row-template"));

  /** @param {Recipe["type"]} type */
  function sectionElement(type) {
    return /** @type {HTMLElement} */ (document.querySelector(`.planner-section[data-type="${type}"]`));
  }

  /** @param {Recipe["type"]} type */
  function rowList(type) {
    return /** @type {HTMLElement} */ (sectionElement(type).querySelector(".rows"));
  }

  /** @param {HTMLElement} item @param {string} selector */
  function field(item, selector) {
    return /** @type {HTMLInputElement} */ (item.querySelector(selector));
  }

  /** @param {HTMLElement} item @param {string} selector */
  function element(item, selector) {
    return /** @type {HTMLElement} */ (item.querySelector(selector));
  }

  /** @param {Recipe["type"]} type @param {string} name */
  function findRecipe(type, name) {
    return recipes.find((recipe) => recipe.type === type && recipe.name === name);
  }

  function getPeople() {
    return Number(peopleInput.value);
  }

  /**
   * Shows the weekday for the chosen date and marks a recipe name that matches nothing.
   * @param {HTMLElement} item
   * @param {Recipe["type"]} type
   */
  function refreshRow(item, type) {
    const dateInput = field(item, ".row-date-input");
    const recipeInput = field(item, ".row-recipe");

    element(item, ".row-weekday").textContent = dateInput.value
      ? weekdayFormat.format(parseDate(dateInput.value))
      : "No date";

    const known = recipeInput.value === "" || findRecipe(type, recipeInput.value) !== undefined;
    recipeInput.classList.toggle("row-unmatched", !known);
  }

  /**
   * Reads one row from the page. A row with an unmatched recipe name has recipeId null.
   * @param {HTMLElement} item
   * @param {Recipe["type"]} type
   * @returns {PlanRow}
   */
  function readRow(item, type) {
    const recipe = findRecipe(type, field(item, ".row-recipe").value);
    return {
      recipeId: recipe ? recipe.id : null,
      date: field(item, ".row-date-input").value || null,
      portions: Number(field(item, ".row-portions-input").value),
    };
  }

  /**
   * Shows the recipes of the row's section that contain the typed text.
   * If the text is exactly a recipe name, all recipes are shown instead.
   * The list is hidden when nothing matches.
   * @param {HTMLElement} item
   * @param {Recipe["type"]} type
   */
  function showOptions(item, type) {
    const input = field(item, ".row-recipe");
    const typed = findRecipe(type, input.value) ? "" : input.value.trim().toLowerCase();
    const matches = recipesByName.filter(
      (recipe) => recipe.type === type && recipe.name.toLowerCase().includes(typed),
    );

    const list = element(item, ".row-options");
    list.replaceChildren(
      ...matches.map((recipe) => {
        const option = document.createElement("li");
        option.className = "option";
        option.textContent = recipe.name;
        // mousedown instead of click, and preventDefault keeps the input focused.
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          chooseRecipe(item, type, recipe);
        });
        return option;
      }),
    );
    list.hidden = matches.length === 0;
  }

  /** @param {HTMLElement} item */
  function hideOptions(item) {
    element(item, ".row-options").hidden = true;
  }

  /**
   * Selects a recipe for the row. The portions do not change here; they were set when the row was added.
   * @param {HTMLElement} item
   * @param {Recipe["type"]} type
   * @param {Recipe} recipe
   */
  function chooseRecipe(item, type, recipe) {
    field(item, ".row-recipe").value = recipe.name;
    refreshRow(item, type);
    hideOptions(item);
    onChange();
  }

  /**
   * Opens the native date picker of the hidden date input.
   * Falls back to focusing and clicking the input in browsers without showPicker().
   * @param {HTMLInputElement} input
   */
  function openDatePicker(input) {
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  }

  /**
   * Adds one row to the section of the given type and returns it.
   * @param {Recipe["type"]} type
   * @param {PlanRow} row
   * @returns {HTMLElement}
   */
  function addRow(type, row) {
    const fragment = /** @type {DocumentFragment} */ (rowTemplate.content.cloneNode(true));
    const item = /** @type {HTMLElement} */ (fragment.firstElementChild);
    const dateInput = field(item, ".row-date-input");
    const recipeInput = field(item, ".row-recipe");
    const portionsInput = field(item, ".row-portions-input");

    dateInput.value = row.date ?? "";
    recipeInput.value = row.recipeId ? recipesById.get(row.recipeId)?.name ?? "" : "";
    portionsInput.value = String(row.portions);
    refreshRow(item, type);

    dateInput.addEventListener("input", () => {
      refreshRow(item, type);
      onChange();
    });
    element(item, ".row-weekday").addEventListener("click", () => openDatePicker(dateInput));

    portionsInput.addEventListener("input", onChange);

    recipeInput.addEventListener("input", () => {
      refreshRow(item, type);
      showOptions(item, type);
      onChange();
    });
    recipeInput.addEventListener("focus", () => showOptions(item, type));
    recipeInput.addEventListener("click", () => showOptions(item, type));
    recipeInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideOptions(item);
    });

    // The toggle shows the full list, even when text is typed.
    element(item, ".row-toggle").addEventListener("click", () => {
      recipeInput.focus();
      showOptions(item, type);
    });

    // Close the list when the focus leaves the row.
    item.addEventListener("focusout", (event) => {
      if (!item.contains(/** @type {Node | null} */ (event.relatedTarget))) {
        hideOptions(item);
      }
    });

    element(item, ".row-delete").addEventListener("click", () => {
      item.remove();
      onChange();
    });

    rowList(type).append(item);
    return item;
  }

  /** @returns {PlanRow[]} All rows in section order. Rows without a matched recipe have recipeId null. */
  function getRows() {
    return SECTION_TYPES.flatMap((type) =>
      [...rowList(type).children].map((item) => readRow(/** @type {HTMLElement} */ (item), type)),
    );
  }

  // Load the state from the URL. Without rows, every section starts empty.
  const loaded = parsePlanUrl(location.search, recipesById);
  peopleInput.value = String(loaded.people ?? DEFAULT_PEOPLE);
  eventInput.value = loaded.eventName;
  for (const row of loaded.rows) {
    const recipe = recipesById.get(row.recipeId ?? "");
    if (recipe) {
      addRow(recipe.type, row);
    }
  }

  // "+ Add ..." creates an empty row whose portions equal the global number of people.
  for (const type of SECTION_TYPES) {
    const addButton = /** @type {HTMLButtonElement} */ (sectionElement(type).querySelector(".add-row"));
    addButton.addEventListener("click", () => {
      const item = addRow(type, { recipeId: null, date: null, portions: getPeople() });
      field(item, ".row-recipe").focus();
      onChange();
    });
  }

  peopleInput.addEventListener("input", onChange);
  eventInput.addEventListener("input", onChange);

  /** @type {string[]} */
  const notices = [
    ...loaded.missingIds.map((id) => `Recipe "${id}" no longer exists and was removed from the plan.`),
    ...loaded.warnings,
  ];

  return {
    getPeople,
    getRows,
    getQuery: () =>
      encodePlanUrl({ people: getPeople(), eventName: eventInput.value, rows: getRows() }),
    notices,
  };
}

/**
 * Parses a "YYYY-MM-DD" string as a local date, so no time zone shift happens.
 * @param {string} value
 * @returns {Date}
 */
function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
