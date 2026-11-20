// @ts-check
// Recipe page. Lists all recipes, creates and edits them in the local storage of this
// browser, imports recipe files and downloads single recipes as JSON or PDF. The main
// page uses saved recipes after it is reloaded. Repository files change only through
// pull requests.
import { readRecipeFile } from "../core/recipe-editing.js";
import { getServings, mergeRecipes } from "../core/recipes.js";
import { compareText, indexById } from "../core/utils.js";
import { loadAppData } from "../data.js";
import { buildRecipesPdf } from "../pdf/documents.js";
import { deleteLocalRecipe, readLocalRecipes, saveLocalRecipe } from "../storage.js";
import { createRecipeEditor } from "../ui/recipe-editor.js";

/** @typedef {import("../core/types.js").Recipe} Recipe */
/** @typedef {import("../core/types.js").Ingredient} Ingredient */

const TYPE_ORDER = /** @type {const} */ (["main", "spread", "other"]);
const TYPE_TITLES = { main: "Mains", spread: "Spreads", other: "Others" };
const DOWNLOAD_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>';

const listView = /** @type {HTMLElement} */ (document.querySelector("#list-view"));
const editorView = /** @type {HTMLElement} */ (document.querySelector("#editor-view"));
const listBox = /** @type {HTMLElement} */ (document.querySelector("#recipe-list"));
const searchInput = /** @type {HTMLInputElement} */ (document.querySelector("#recipe-search"));
const newButton = /** @type {HTMLButtonElement} */ (document.querySelector("#new-recipe"));
const fileInput = /** @type {HTMLInputElement} */ (document.querySelector("#recipe-file"));
const noticesBox = /** @type {HTMLElement} */ (document.querySelector("#notices"));

main();

/** Loads the ingredients and the repository recipes, then starts the page. */
async function main() {
  try {
    const { repoRecipes, ingredients } = await loadAppData("../");
    start(ingredients, repoRecipes);
  } catch (error) {
    showNotices([`The data could not be loaded. ${/** @type {Error} */ (error).message}`]);
  }
}

/**
 * @param {Ingredient[]} ingredients Merged with the saved ingredients.
 * @param {Recipe[]} repoRecipes
 */
function start(ingredients, repoRecipes) {
  const ingredientsById = indexById(ingredients);
  const repoById = indexById(repoRecipes);

  const editor = createRecipeEditor({
    ingredients,
    onSave: (recipe) => {
      saveLocalRecipe(recipe);
      showList();
    },
    onDiscard: (id) => {
      const message = repoById.has(id)
        ? "Discard your changes? The repository version will be used again."
        : "Delete this recipe from this browser?";
      if (!window.confirm(message)) return;
      deleteLocalRecipe(id);
      showList();
    },
    onBack: () => showList(),
  });

  newButton.addEventListener("click", () => openEditor(null));
  searchInput.addEventListener("input", renderList);
  fileInput.addEventListener("change", importFile);
  showList();

  function showList() {
    editorView.hidden = true;
    listView.hidden = false;
    renderList();
    window.scrollTo(0, 0);
  }

  /** @param {Recipe | null} recipe Null for a new recipe. */
  function openEditor(recipe) {
    const local = readLocalRecipes();
    const isNew = recipe === null;

    let discardLabel = null;
    if (recipe && Object.hasOwn(local, recipe.id)) {
      discardLabel = repoById.has(recipe.id) ? "Discard local changes" : "Delete recipe";
    }
    const takenIds = isNew ? new Set(mergeRecipes(repoRecipes, local).map((r) => r.id)) : null;

    listView.hidden = true;
    editorView.hidden = false;
    window.scrollTo(0, 0);
    editor.open({ recipe, takenIds, discardLabel });
  }

  /** Shows all recipes by type, filtered by the search text. */
  function renderList() {
    const query = searchInput.value.trim().toLowerCase();
    const local = readLocalRecipes();
    const matches = mergeRecipes(repoRecipes, local).filter((recipe) =>
      recipe.name.toLowerCase().includes(query),
    );

    const sections = TYPE_ORDER.map((type) => ({
      type,
      recipes: matches
        .filter((recipe) => recipe.type === type)
        .sort((a, b) => compareText(a.name, b.name)),
    })).filter((section) => section.recipes.length > 0);

    if (sections.length === 0) {
      listBox.replaceChildren(el("p", "muted", "No recipes match your search."));
      return;
    }

    listBox.replaceChildren(
      ...sections.map((section) => {
        const block = document.createElement("section");
        block.className = "planner-section";
        const list = el("ul", "rows");
        list.append(...section.recipes.map((recipe) => recipeRow(recipe, local)));
        block.append(el("h3", "", TYPE_TITLES[section.type]), list);
        return block;
      }),
    );
  }

  /**
   * @param {Recipe} recipe
   * @param {Record<string, Recipe>} local
   * @returns {HTMLElement}
   */
  function recipeRow(recipe, local) {
    const open = el("button", "recipe-open", recipe.name);
    open.type = "button";
    if (Object.hasOwn(local, recipe.id)) {
      const marker = repoById.has(recipe.id) ? "Changed in this browser" : "Saved in this browser only";
      open.append(el("span", "recipe-marker", marker));
    }
    open.addEventListener("click", () => openEditor(recipe));

    const json = downloadButton("JSON");
    json.addEventListener("click", () => {
      // The same content as the file in recipes/, so it can be added by pull request.
      const blob = new Blob([`${JSON.stringify(recipe, null, 2)}\n`], { type: "application/json" });
      downloadBlob(blob, `${recipe.id}.json`);
    });

    const pdf = downloadButton("PDF");
    pdf.addEventListener("click", () => {
      // Base amounts: the recipe is printed for its own number of servings.
      const entries = [{ recipe, portions: getServings(recipe), date: null }];
      downloadPdf(buildRecipesPdf(entries, ingredientsById), `recipe-${recipe.id}.pdf`);
    });

    const actions = el("div", "recipe-actions");
    actions.append(json, pdf);

    const item = el("li", "row recipe-row");
    item.append(open, actions);
    return item;
  }

  async function importFile() {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const recipe = readRecipeFile(JSON.parse(await file.text()), ingredientsById);
      saveLocalRecipe(recipe);
      showNotices([
        `Recipe "${recipe.name}" is saved in this browser and used on the main page after a reload. Delete it from the recipe page to remove it again.`,
      ]);
      renderList();
    } catch (error) {
      showNotices([`The recipe file could not be imported. ${/** @type {Error} */ (error).message}`]);
    } finally {
      fileInput.value = "";
    }
  }
}

/**
 * Creates a button with the download icon in front of the text.
 * @param {string} text
 * @returns {HTMLButtonElement}
 */
function downloadButton(text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button-link";
  button.innerHTML = DOWNLOAD_ICON;
  button.append(text);
  return button;
}

/**
 * @param {string[]} messages
 */
function showNotices(messages) {
  noticesBox.replaceChildren(...messages.map((message) => el("li", "", message)));
}

/**
 * Creates a PDF from a pdfmake definition and starts the download.
 * @param {Record<string, any>} definition
 * @param {string} name
 */
function downloadPdf(definition, name) {
  const pdfMake = /** @type {any} */ (window).pdfMake;
  pdfMake.createPdf(definition).download(name);
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
