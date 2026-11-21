// @ts-check
// Form for one recipe: name, type, servings, portion weight, ingredients and working
// steps. The form shows and reads the data. The rules are in js/core/recipe-editing.js.
// Saving, downloading and discarding are handed to the page through callbacks.
import {
  buildRecipeFile,
  createUniqueId,
  scaleFactorForChange,
  validateRecipeDraft,
} from "../core/recipe-editing.js";
import { compareText } from "../core/utils.js";
import { createIcon } from "./icon.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Recipe} Recipe */
/** @typedef {import("../core/recipe-editing.js").RecipeDraft} RecipeDraft */

/**
 * @typedef {Object} EditorOptions
 * @property {Ingredient[]} ingredients
 * @property {(recipe: Recipe) => void} onSave Receives the checked recipe file content.
 * @property {(id: string) => void} onDiscard Asks the page to discard or delete the recipe.
 * @property {() => void} onBack
 */

/**
 * @typedef {Object} OpenOptions
 * @property {Recipe | null} recipe Null for a new recipe.
 * @property {Set<string> | null} takenIds Ids a new recipe must not use. Null when editing.
 * @property {string | null} discardLabel Text of the discard button, or null to hide it.
 */

/**
 * Connects the recipe form in recipes/index.html.
 * @param {EditorOptions} options
 * @returns {{ open: (options: OpenOptions) => void }}
 */
export function createRecipeEditor({ ingredients, onSave, onDiscard, onBack }) {
  const nameInput = /** @type {HTMLInputElement} */ (document.querySelector("#recipe-name"));
  const typeSelect = /** @type {HTMLSelectElement} */ (document.querySelector("#recipe-type"));
  const servingsInput = /** @type {HTMLInputElement} */ (document.querySelector("#recipe-servings"));
  const portionInput = /** @type {HTMLInputElement} */ (document.querySelector("#recipe-portion-weight"));
  const scaleButton = /** @type {HTMLButtonElement} */ (document.querySelector("#scale-button"));
  const ingredientsBox = /** @type {HTMLElement} */ (document.querySelector("#editor-ingredients"));
  const stepsBox = /** @type {HTMLElement} */ (document.querySelector("#editor-steps"));
  const errorsBox = /** @type {HTMLElement} */ (document.querySelector("#editor-errors"));
  const discardButton = /** @type {HTMLButtonElement} */ (document.querySelector("#discard-recipe"));
  const discardText = /** @type {HTMLElement} */ (document.querySelector("#discard-label"));

  const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const sortedIngredients = [...ingredients].sort((a, b) => compareText(a.name, b.name));

  /** Id of the recipe. Null for a new recipe until its first successful save or download. */
  let currentId = /** @type {string | null} */ (null);
  /** @type {Set<string> | null} */
  let takenIds = null;
  /**
   * Servings and portion weight the amounts in the form belong to. The scale button
   * appears when the form differs from this and disappears after scaling.
   * @type {{ servings: number, portionWeight: number | undefined }}
   */
  let base = { servings: 1, portionWeight: undefined };

  document.querySelector("#editor-back")?.addEventListener("click", () => onBack());
  document.querySelector("#add-ingredient")?.addEventListener("click", () => {
    addIngredientRow(null).focus();
  });
  document.querySelector("#add-step")?.addEventListener("click", () => {
    addStepRow("").focus();
  });
  servingsInput.addEventListener("input", updateScaleButton);
  portionInput.addEventListener("input", updateScaleButton);
  scaleButton.addEventListener("click", scaleToNewValues);
  document.querySelector("#save-recipe")?.addEventListener("click", save);
  document.querySelector("#download-recipe")?.addEventListener("click", download);
  discardButton.addEventListener("click", () => {
    if (currentId !== null) onDiscard(currentId);
  });

  /**
   * Shows the form with the given recipe, or an empty form for a new recipe.
   * @param {OpenOptions} options
   */
  function open({ recipe, takenIds: taken, discardLabel }) {
    takenIds = taken;
    currentId = recipe ? recipe.id : null;
    nameInput.value = recipe ? recipe.name : "";
    typeSelect.value = recipe ? recipe.type : "main";
    servingsInput.value = String(recipe?.servings ?? 1);
    portionInput.value = recipe?.portionWeight === undefined ? "" : String(recipe.portionWeight);
    base = { servings: recipe?.servings ?? 1, portionWeight: recipe?.portionWeight };
    updateScaleButton();

    ingredientsBox.replaceChildren();
    for (const entry of recipe?.ingredients ?? []) {
      addIngredientRow(entry);
    }
    if (ingredientsBox.children.length === 0) {
      addIngredientRow(null);
    }

    stepsBox.replaceChildren();
    for (const step of recipe?.steps ?? []) {
      addStepRow(step);
    }
    if (stepsBox.children.length === 0) {
      addStepRow("");
    }

    discardButton.hidden = discardLabel === null;
    // Only the text changes, so the trash icon in front of it stays.
    discardText.textContent = discardLabel ?? "";
    showErrors([]);
  }

  /** @returns {{ servings: number, portionWeight: number | undefined }} The values as typed now. */
  function currentScaleValues() {
    const weightText = portionInput.value.trim();
    return {
      servings: Number(servingsInput.value),
      portionWeight: weightText === "" ? undefined : Number(weightText),
    };
  }

  /** Shows the scale button when servings or portion weight differ from the base and a scaling makes sense. */
  function updateScaleButton() {
    const next = currentScaleValues();
    const changed = next.servings !== base.servings || next.portionWeight !== base.portionWeight;
    const factor = scaleFactorForChange(base, next);
    scaleButton.hidden = !changed || !Number.isFinite(factor) || !(factor > 0) || factor === 1;
  }

  /** Scales all amounts live. Nothing is saved, and the new values become the base. */
  function scaleToNewValues() {
    const next = currentScaleValues();
    scaleAmounts(scaleFactorForChange(base, next));
    base = next;
    updateScaleButton();
  }

  /** @param {number} factor */
  function scaleAmounts(factor) {
    for (const input of amountInputs()) {
      const value = Number(input.value);
      if (value > 0) {
        // toPrecision removes floating point noise such as 0.30000000000000004.
        input.value = String(Number((value * factor).toPrecision(12)));
      }
    }
  }

  /** @returns {HTMLInputElement[]} */
  function amountInputs() {
    return /** @type {HTMLInputElement[]} */ ([...ingredientsBox.querySelectorAll(".row-portions-input")]);
  }

  /**
   * Adds one ingredient row: a search field, an amount and the unit of the ingredient.
   * @param {{ ingredientId: string, amount: number } | null} entry
   * @returns {HTMLInputElement} The search field of the new row.
   */
  function addIngredientRow(entry) {
    const item = el("li", "row ingredient-row");

    const field = el("div", "row-recipe-field");
    const search = el("input", "row-recipe");
    search.type = "text";
    search.placeholder = "Search ingredient…";
    search.autocomplete = "off";
    search.setAttribute("aria-label", "Ingredient");
    const options = el("ul", "row-options");
    options.hidden = true;
    field.append(search, options);

    const amountLabel = el("label", "row-portions");
    const amount = el("input", "row-portions-input");
    amount.type = "number";
    amount.min = "0";
    amount.step = "any";
    amount.setAttribute("aria-label", "Amount");
    amountLabel.append(amount);

    const unit = el("span", "ingredient-unit muted");
    const remove = el("button", "row-delete");
    remove.append(createIcon("close"));
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove ingredient");

    /** @param {Ingredient} ingredient */
    function choose(ingredient) {
      item.dataset.ingredientId = ingredient.id;
      search.value = ingredient.name;
      unit.textContent = ingredient.unit;
      options.hidden = true;
    }

    function showOptions() {
      // A chosen ingredient shows the full list, so another one can be picked.
      const typed = item.dataset.ingredientId ? "" : search.value.trim().toLowerCase();
      const matches = sortedIngredients.filter((ingredient) =>
        ingredient.name.toLowerCase().includes(typed),
      );
      options.replaceChildren(
        ...matches.map((ingredient) => {
          const option = el("li", "option", ingredient.name);
          // mousedown keeps the focus in the search field until the choice is made.
          option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            choose(ingredient);
          });
          return option;
        }),
      );
      options.hidden = matches.length === 0;
    }

    search.addEventListener("input", () => {
      delete item.dataset.ingredientId;
      unit.textContent = "";
      showOptions();
    });
    search.addEventListener("focus", showOptions);
    search.addEventListener("click", showOptions);
    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") options.hidden = true;
    });
    item.addEventListener("focusout", (event) => {
      if (!item.contains(/** @type {Node | null} */ (event.relatedTarget))) {
        options.hidden = true;
      }
    });
    remove.addEventListener("click", () => item.remove());

    if (entry) {
      const ingredient = ingredientsById.get(entry.ingredientId);
      if (ingredient) choose(ingredient);
      amount.value = String(entry.amount);
    }

    item.append(field, amountLabel, unit, remove);
    ingredientsBox.append(item);
    return search;
  }

  /**
   * Adds one working step as a text area with a remove button.
   * @param {string} text
   * @returns {HTMLTextAreaElement}
   */
  function addStepRow(text) {
    const item = el("li", "step-row");
    const area = el("textarea", "step-text");
    area.rows = 2;
    area.value = text;
    area.setAttribute("aria-label", "Working step");
    const remove = el("button", "row-delete");
    remove.append(createIcon("close"));
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove step");
    remove.addEventListener("click", () => item.remove());
    item.append(area, remove);
    stepsBox.append(item);
    return area;
  }

  /** @returns {RecipeDraft} The content of the form, not checked yet. */
  function readDraft() {
    const ingredientEntries = [...ingredientsBox.children].map((child) => {
      const item = /** @type {HTMLElement} */ (child);
      const amount = /** @type {HTMLInputElement} */ (item.querySelector(".row-portions-input"));
      return { ingredientId: item.dataset.ingredientId ?? "", amount: Number(amount.value) };
    });
    const steps = [...stepsBox.querySelectorAll("textarea")].map((area) => area.value);
    const { servings, portionWeight } = currentScaleValues();

    return {
      id: currentId ?? "",
      name: nameInput.value.trim(),
      type: /** @type {RecipeDraft["type"]} */ (typeSelect.value),
      servings,
      portionWeight,
      ingredients: ingredientEntries,
      steps,
    };
  }

  /**
   * Reads and checks the form. Shows the problems and returns null if something is wrong.
   * @returns {Recipe | null}
   */
  function checkedRecipe() {
    const draft = readDraft();
    // The id is fixed by the first successful save or download, so later name changes keep it.
    draft.id = currentId ?? createUniqueId(draft.name, takenIds ?? new Set());
    const errors = validateRecipeDraft(draft, ingredientsById, takenIds);
    showErrors(errors);
    if (errors.length > 0) return null;

    currentId = draft.id;
    return buildRecipeFile(draft);
  }

  function save() {
    const recipe = checkedRecipe();
    if (recipe) onSave(recipe);
  }

  /** Downloads the recipe as a file that can be added to recipes/ by pull request. */
  function download() {
    const recipe = checkedRecipe();
    if (!recipe) return;

    const blob = new Blob([`${JSON.stringify(recipe, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${recipe.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** @param {string[]} messages */
  function showErrors(messages) {
    errorsBox.replaceChildren(...messages.map((message) => el("li", "", message)));
  }

  return { open };
}

/**
 * Creates an element with a class name and optional text.
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
