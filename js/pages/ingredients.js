// @ts-check
// Ingredient page. Lists all ingredients, creates and edits them in the local storage of
// this browser, and exports or imports the complete ingredient file. A changed unit
// converts the recipes that use the ingredient and its stored inventory amount.
// Repository files change only through pull requests.
import {
  buildIngredientsFile,
  convertRecipeAmounts,
  groupByCategory,
  isSameIngredient,
  mergeIngredients,
  readIngredientFile,
  usingRecipes,
} from "../core/ingredient-editing.js";
import { mergeRecipes } from "../core/recipes.js";
import { indexById } from "../core/utils.js";
import { loadAppData } from "../data.js";
import {
  convertStoredInventoryAmount,
  deleteLocalIngredient,
  readLocalIngredients,
  readLocalRecipes,
  saveLocalIngredient,
  saveLocalRecipes,
} from "../storage.js";
import { askUnitConversions, createIngredientEditor } from "../ui/ingredient-editor.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Recipe} Recipe */

const listView = /** @type {HTMLElement} */ (document.querySelector("#list-view"));
const editorView = /** @type {HTMLElement} */ (document.querySelector("#editor-view"));
const listBox = /** @type {HTMLElement} */ (document.querySelector("#ingredient-list"));
const searchInput = /** @type {HTMLInputElement} */ (document.querySelector("#ingredient-search"));
const newButton = /** @type {HTMLButtonElement} */ (document.querySelector("#new-ingredient"));
const importInput = /** @type {HTMLInputElement} */ (document.querySelector("#ingredient-file"));
const exportButton = /** @type {HTMLButtonElement} */ (document.querySelector("#export-ingredients"));
const noticesBox = /** @type {HTMLElement} */ (document.querySelector("#notices"));

main();

/** Loads the repository data, then starts the page. */
async function main() {
  try {
    const { repoIngredients, repoRecipes } = await loadAppData("../");
    start(repoIngredients, repoRecipes);
  } catch (error) {
    showNotices([`The data could not be loaded. ${/** @type {Error} */ (error).message}`]);
  }
}

/**
 * @param {Ingredient[]} repoIngredients
 * @param {Recipe[]} repoRecipes
 */
function start(repoIngredients, repoRecipes) {
  const repoById = indexById(repoIngredients);
  /** @type {Ingredient[]} */
  let ingredients = [];
  /** @type {Recipe[]} */
  let recipes = [];

  const editor = createIngredientEditor({
    onSave: ({ ingredient, factor }) => save(ingredient, factor),
    onDiscard: discard,
    onBack: () => showList(),
  });

  refresh();
  newButton.addEventListener("click", () => openEditor(null));
  searchInput.addEventListener("input", renderList);
  exportButton.addEventListener("click", exportFile);
  importInput.addEventListener("change", importFile);
  showList();

  /** Recomputes the merged lists from the repository data and the local storage. */
  function refresh() {
    ingredients = mergeIngredients(repoIngredients, readLocalIngredients());
    recipes = mergeRecipes(repoRecipes, readLocalRecipes());
  }

  /** Shows the list and clears the notices. */
  function showList() {
    editorView.hidden = true;
    listView.hidden = false;
    renderList();
    showNotices([]);
    window.scrollTo(0, 0);
  }

  /** @param {Ingredient | null} ingredient Null for a new ingredient. */
  function openEditor(ingredient) {
    const local = readLocalIngredients();
    let discardLabel = null;
    if (ingredient && Object.hasOwn(local, ingredient.id)) {
      discardLabel = repoById.has(ingredient.id) ? "Discard local changes" : "Delete ingredient";
    }
    const usingRecipeNames = ingredient
      ? usingRecipes(recipes, ingredient.id).map((recipe) => recipe.name)
      : [];

    listView.hidden = true;
    editorView.hidden = false;
    window.scrollTo(0, 0);
    editor.open({ ingredient, allIngredients: ingredients, usingRecipeNames, discardLabel });
  }

  /**
   * Saves the ingredient. A changed unit converts the amounts of the recipes that use it.
   * @param {Ingredient} ingredient
   * @param {number | null} factor
   */
  function save(ingredient, factor) {
    if (factor !== null) {
      convertUsage(ingredient.id, factor);
    }
    saveLocalIngredient(ingredient);
    refresh();
    showList();
  }

  /**
   * Multiplies the amounts of an ingredient in all recipes and in the stored inventory.
   * The recipes are read again on every call, so several conversions in a row stack up.
   * @param {string} id
   * @param {number} factor
   */
  function convertUsage(id, factor) {
    const current = mergeRecipes(repoRecipes, readLocalRecipes());
    const converted = usingRecipes(current, id).map((recipe) => convertRecipeAmounts(recipe, id, factor));
    saveLocalRecipes(converted);
    convertStoredInventoryAmount(id, factor);
  }

  /**
   * Discards the local version of a repository ingredient, or deletes a local ingredient
   * that no recipe uses.
   * @param {string} id
   */
  function discard(id) {
    if (repoById.has(id)) {
      const confirmed = window.confirm(
        "Discard your changes? The repository version will be used again. Recipes and inventory amounts that were already converted keep their new values.",
      );
      if (!confirmed) return;
    } else {
      const name = ingredients.find((item) => item.id === id)?.name ?? id;
      const names = usingRecipes(recipes, id).map((recipe) => recipe.name);
      if (names.length > 0) {
        editor.showErrors([
          `"${name}" cannot be deleted, it is used in: ${names.join(", ")}. Remove it from these recipes first.`,
        ]);
        return;
      }
      if (!window.confirm("Delete this ingredient from this browser?")) return;
    }

    deleteLocalIngredient(id);
    refresh();
    showList();
  }

  /** Shows all categories with the ingredients that match the search text. */
  function renderList() {
    const query = searchInput.value.trim().toLowerCase();
    const local = readLocalIngredients();
    const matches = ingredients.filter((item) => item.name.toLowerCase().includes(query));

    if (matches.length === 0) {
      listBox.replaceChildren(el("p", "muted", "No ingredients match your search."));
      return;
    }

    listBox.replaceChildren(
      ...groupByCategory(matches).map((group) => {
        const list = el("ul", "rows");
        list.append(...group.ingredients.map((item) => ingredientRow(item, local)));
        const block = document.createElement("section");
        block.className = "planner-section";
        block.append(el("h3", "", group.title), list);
        return block;
      }),
    );
  }

  /**
   * @param {Ingredient} ingredient
   * @param {Record<string, Ingredient>} local
   * @returns {HTMLElement}
   */
  function ingredientRow(ingredient, local) {
    const button = el("button", "recipe-open", ingredient.name);
    button.type = "button";
    if (Object.hasOwn(local, ingredient.id)) {
      const marker = repoById.has(ingredient.id) ? "Changed in this browser" : "Saved in this browser only";
      button.append(el("span", "recipe-marker", marker));
    }
    button.addEventListener("click", () => openEditor(ingredient));

    const item = el("li", "row recipe-row");
    item.append(button);
    return item;
  }

  /** Downloads the complete ingredient file with all local changes. */
  function exportFile() {
    const file = buildIngredientsFile(ingredients);
    downloadBlob(
      new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: "application/json" }),
      "ingredients.json",
    );
  }

  /**
   * Imports an ingredient file. If a unit differs from the current one, a dialog asks for
   * the conversion first. Cancelling the dialog imports nothing. Identical entries are not
   * stored locally.
   */
  async function importFile() {
    const file = importInput.files?.[0];
    if (!file) return;

    try {
      const imported = readIngredientFile(JSON.parse(await file.text()));
      const current = indexById(ingredients);

      /** @type {{ item: Ingredient, oldUnit: string, usingNames: string[] }[]} */
      const changes = [];
      for (const item of imported) {
        const before = current.get(item.id);
        if (before && before.unit !== item.unit) {
          changes.push({
            item,
            oldUnit: before.unit,
            usingNames: usingRecipes(recipes, item.id).map((recipe) => recipe.name),
          });
        }
      }

      if (changes.length > 0) {
        const factors = await askUnitConversions(
          changes.map((change) => ({
            name: change.item.name,
            oldUnit: change.oldUnit,
            newUnit: change.item.unit,
            usingNames: change.usingNames,
          })),
        );
        if (factors === null) return;
        changes.forEach((change, index) => convertUsage(change.item.id, factors[index]));
      }

      for (const ingredient of imported) {
        const repo = repoById.get(ingredient.id);
        if (repo && isSameIngredient(repo, ingredient)) {
          deleteLocalIngredient(ingredient.id);
        } else {
          saveLocalIngredient(ingredient);
        }
      }
      refresh();
      showList();
    } catch (error) {
      showNotices([`The ingredient file could not be imported. ${/** @type {Error} */ (error).message}`]);
    } finally {
      importInput.value = "";
    }
  }
}

/**
 * @param {string[]} messages
 */
function showNotices(messages) {
  noticesBox.replaceChildren(...messages.map((message) => el("li", "", message)));
}

/**
 * Starts a download of a blob under the given file name.
 * @param {Blob} blob
 * @param {string} name
 */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElementTagNameMap[K]}
 */
function el(tag, className, text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
