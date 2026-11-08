// @ts-check
// Entry point of the main page. Loads the data, wires the planner, the
// inventory import, the Calculate button, the PDF downloads and the share dialog.
// Results are never recalculated in the background. A relevant change hides
// them, and the user has to press Calculate again.
// The plan is also kept in the local storage of this browser, so the home screen
// app still has it when it starts without a query string.
import { isWholeNumberAtLeastOne, resolvePlan } from "./core/planner.js";
import { calculateNeededAmounts, sumAmountsByType } from "./core/recipes.js";
import { buildShoppingItems, groupByShop, summarizePrices } from "./core/shopping.js";
import { indexById } from "./core/utils.js";
import {
  buildLabelsPdf,
  buildRecipesPdf,
  buildShoppingPdf,
  buildSortingPdf,
} from "./pdf/documents.js";
import { fitInputWidth } from "./ui/fit-input.js";
import { initInventoryImport } from "./ui/inventory-import.js";
import { initPlanner } from "./ui/planner.js";
import { renderResults } from "./ui/results.js";
import { initShare } from "./ui/share.js";

/** @typedef {import("./core/types.js").Recipe} Recipe */
/** @typedef {import("./core/types.js").Ingredient} Ingredient */
/** @typedef {import("./core/planner.js").PlanEntry} PlanEntry */

/** Key in the local storage of this browser that holds the last plan query string. */
const PLAN_STORAGE_KEY = "coxi-plan";

const calculateButton = /** @type {HTMLButtonElement} */ (document.querySelector("#calculate"));
const eventNameInput = /** @type {HTMLInputElement} */ (document.querySelector("#event-name"));
const peopleInput = /** @type {HTMLInputElement} */ (document.querySelector("#people"));
const noticesBox = /** @type {HTMLElement} */ (document.querySelector("#notices"));
const resultsBox = /** @type {HTMLElement} */ (document.querySelector("#results"));

/**
 * Messages shown above the Calculate button. Each source replaces only its own list.
 * @type {{ loading: string[], plan: string[], inventory: string[], calculation: string[] }}
 */
const notices = { loading: [], plan: [], inventory: [], calculation: [] };

main();

/** Loads all data files, then starts the page. Shows an error notice if loading fails. */
async function main() {
  try {
    const { ingredients } = await loadJson("data/ingredients.json");
    const { recipes: recipeIds } = await loadJson("data/recipes/index.json");
    const recipes = await Promise.all(recipeIds.map((id) => loadJson(`data/recipes/${id}.json`)));
    start(ingredients, recipes);
  } catch (error) {
    notices.loading = [`The data could not be loaded. ${/** @type {Error} */ (error).message}`];
    renderNotices();
  }
}

/**
 * @param {string} path Relative to index.html.
 * @returns {Promise<any>}
 */
async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (HTTP ${response.status}).`);
  }
  return response.json();
}

/** Shows all notices in the order: loading, plan, inventory, calculation. */
function renderNotices() {
  const messages = [
    ...notices.loading,
    ...notices.plan,
    ...notices.inventory,
    ...notices.calculation,
  ];
  noticesBox.replaceChildren(
    ...messages.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
}

/**
 * Restores the saved plan if the page was opened without a query string, for
 * example from the home screen. A link with a query string always wins.
 */
function restoreSavedPlan() {
  if (location.search !== "") return;
  const saved = readSavedPlan();
  if (saved) {
    history.replaceState(null, "", saved);
  }
}

/** @returns {string | null} The saved query string, or null if there is none or storage is unavailable. */
function readSavedPlan() {
  try {
    return localStorage.getItem(PLAN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** @param {string} query */
function savePlan(query) {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, query);
  } catch {
    // Storage is not available, for example in some private browsing modes. The plan still works.
  }
}

/**
 * @param {Ingredient[]} ingredients
 * @param {Recipe[]} recipes
 */
function start(ingredients, recipes) {
  const ingredientsById = indexById(ingredients);
  const recipesById = indexById(recipes);

  // Must run before the planner reads the address.
  restoreSavedPlan();

  /** Snapshot of the plan and the people at the last calculation. Null when no result is shown. */
  let calculatedPlanKey = null;

  fitInputWidth(eventNameInput, { fullWidthOnFocus: true });
  fitInputWidth(peopleInput);

  const planner = initPlanner(recipes, updateControls);
  notices.plan = planner.notices;

  const inventoryImport = initInventoryImport(ingredientsById, (messages) => {
    notices.inventory = messages;
    hideResults();
  });

  initShare({
    getLink: () => {
      const url = new URL(location.href);
      url.search = planner.getQuery();
      url.hash = "";
      return url.href;
    },
    readPlanFromText,
    hasPlanContent: () =>
      planner.getRows().some((row) => row.recipeId !== null) ||
      Object.keys(inventoryImport.getInventory()).length > 0,
    replacePlan: (search) => {
      // Loading the address with the new query reloads the page with that plan.
      location.search = search;
    },
  });

  calculateButton.addEventListener("click", calculate);
  updateControls();
  renderNotices();

  /** @returns {string} Everything that changes the calculation. The event name is not part of it. */
  function planKey() {
    return JSON.stringify({ people: planner.getPeople(), rows: planner.getRows() });
  }

  /**
   * Called after every change of the plan: hides outdated results, updates the
   * button, the address bar and the saved plan.
   */
  function updateControls() {
    if (calculatedPlanKey !== null && calculatedPlanKey !== planKey()) {
      hideResults();
    }
    calculateButton.disabled = readEntries().length === 0;
    try {
      const query = planner.getQuery();
      history.replaceState(null, "", query);
      savePlan(query);
    } catch {
      // The number of people is invalid right now. Keep the last valid address and saved plan.
    }
  }

  /**
   * @returns {PlanEntry[]} The planned entries, or an empty list if the plan is invalid.
   */
  function readEntries() {
    try {
      return resolvePlan(planner.getRows(), recipesById).entries;
    } catch {
      return [];
    }
  }

  /** Removes the results and their notices. The Calculate button is ready again. */
  function hideResults() {
    calculatedPlanKey = null;
    resultsBox.hidden = true;
    resultsBox.replaceChildren();
    notices.calculation = [];
    renderNotices();
  }

  /** @returns {string} The event name as typed now, used for titles and file names. */
  function currentEventName() {
    return eventNameInput.value.trim();
  }

  function calculate() {
    notices.calculation = [];

    const people = planner.getPeople();
    if (!isWholeNumberAtLeastOne(people)) {
      showCalculationProblem("The number of people must be a whole number of at least 1.");
      return;
    }

    /** @type {ReturnType<typeof resolvePlan>} */
    let plan;
    try {
      plan = resolvePlan(planner.getRows(), recipesById);
    } catch (error) {
      showCalculationProblem(/** @type {Error} */ (error).message);
      return;
    }
    if (plan.entries.length === 0) {
      showCalculationProblem("Select at least one recipe.");
      return;
    }

    const entries = plan.entries;
    const needed = calculateNeededAmounts(entries);
    const items = buildShoppingItems(needed, inventoryImport.getInventory(), ingredientsById);
    const groups = groupByShop(items);
    const summary = summarizePrices(items, people);

    notices.calculation = plan.missingIds.map(
      (id) => `Recipe "${id}" no longer exists and was skipped.`,
    );
    renderResults(resultsBox, {
      summary,
      downloads: {
        recipes: () =>
          downloadPdf(buildRecipesPdf(entries, ingredientsById), fileName("recipes", currentEventName())),
        sorting: () =>
          downloadPdf(
            buildSortingPdf(sumAmountsByType(entries, ingredientsById)),
            fileName("sorting-list", currentEventName()),
          ),
        labels: () =>
          downloadPdf(buildLabelsPdf(entries, ingredientsById), fileName("labels", currentEventName())),
        shopping: () =>
          downloadPdf(
            buildShoppingPdf({ eventName: currentEventName(), groups, summary }),
            fileName("shopping-list", currentEventName()),
          ),
      },
    });

    calculatedPlanKey = planKey();
    resultsBox.hidden = false;
    renderNotices();
  }

  /**
   * Shows a problem that prevents the calculation and hides the old results.
   * @param {string} message
   */
  function showCalculationProblem(message) {
    hideResults();
    notices.calculation = [message];
    renderNotices();
  }
}

/**
 * Accepts a full link or only its query string. Only the query string is used,
 * so the link can come from any deployment of the app.
 * @param {string} text
 * @returns {{ search: string }}
 * @throws {Error} With a message for the user if the text is no plan link.
 */
function readPlanFromText(text) {
  /** @type {URL} */
  let url;
  try {
    url = new URL(text.trim(), location.href);
  } catch {
    throw new Error("The text is not a link.");
  }

  const params = new URLSearchParams(url.search);
  if (!params.has("p") && !params.has("r")) {
    throw new Error("The text does not contain a plan link.");
  }
  return { search: url.search };
}

/**
 * Creates a PDF from a pdfmake definition and starts the download.
 * pdfMake is loaded as a classic script in index.html.
 * @param {Record<string, any>} definition
 * @param {string} name
 */
function downloadPdf(definition, name) {
  const pdfMake = /** @type {any} */ (window).pdfMake;
  pdfMake.createPdf(definition).download(name);
}

/**
 * Builds a file name such as "shopping-list-nebu-2027.pdf".
 * @param {string} base
 * @param {string} eventName
 * @returns {string}
 */
function fileName(base, eventName) {
  const slug = eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${base}-${slug}.pdf` : `${base}.pdf`;
}
