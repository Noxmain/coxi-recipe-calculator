// @ts-check
// Form for one recipe: name, type, servings, portion weight, ingredients and working
// steps. The form shows and reads the data. The rules are in js/core/recipe-editing.js.
// Ingredients that do not exist yet are created when the recipe is saved or downloaded.
// The form lists them above the save button. Saving, downloading and discarding are
// handed to the page through callbacks.
import {
  buildRecipeFile,
  comparableName,
  createUniqueId,
  findIngredientByName,
  resolveNewIngredients,
  scaleFactorForChange,
  validateRecipeDraft,
} from "../core/recipe-editing.js";
import { compareText, indexById } from "../core/utils.js";
import { createIcon } from "./icon.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Recipe} Recipe */
/** @typedef {import("../core/recipe-editing.js").DraftIngredient} DraftIngredient */
/** @typedef {import("../core/recipe-editing.js").RecipeDraft} RecipeDraft */

/**
 * @typedef {Object} EditorOptions
 * @property {Ingredient[]} ingredients All ingredients, merged with the saved ones.
 * @property {(recipe: Recipe, created: Ingredient[]) => void} onSave Receives the recipe file
 *   and the ingredients that the recipe creates.
 * @property {(created: Ingredient[]) => void} onIngredientsCreated Called when a download
 *   created ingredients.
 * @property {(id: string) => void} onDiscard Asks the page to discard or delete the recipe.
 * @property {() => void} onBack
 */

/**
 * @typedef {Object} OpenOptions
 * @property {Recipe | null} recipe Null for a new recipe.
 * @property {Set<string> | null} takenIds Ids a new recipe must not use. Null when editing.
 * @property {string | null} discardLabel Text of the discard button, or null to hide it.
 */

const UNIT_LIST_ID = "recipe-unit-options";

/**
 * Connects the recipe form in recipes/index.html.
 * @param {EditorOptions} options
 * @returns {{ open: (options: OpenOptions) => void }}
 */
export function createRecipeEditor({ ingredients, onSave, onIngredientsCreated, onDiscard, onBack }) {
  const nameInput = /** @type {HTMLInputElement} */ (document.querySelector("#recipe-name"));
  const typeSelect = /** @type {HTMLSelectElement} */ (document.querySelector("#recipe-type"));
  const servingsInput = /** @type {HTMLInputElement} */ (document.querySelector("#recipe-servings"));
  const portionInput = /** @type {HTMLInputElement} */ (document.querySelector("#recipe-portion-weight"));
  const scaleButton = /** @type {HTMLButtonElement} */ (document.querySelector("#scale-button"));
  const ingredientsBox = /** @type {HTMLElement} */ (document.querySelector("#editor-ingredients"));
  const stepsBox = /** @type {HTMLElement} */ (document.querySelector("#editor-steps"));
  const errorsBox = /** @type {HTMLElement} */ (document.querySelector("#editor-errors"));
  const saveButton = /** @type {HTMLButtonElement} */ (document.querySelector("#save-recipe"));
  const discardButton = /** @type {HTMLButtonElement} */ (document.querySelector("#discard-recipe"));
  const discardText = /** @type {HTMLElement} */ (document.querySelector("#discard-label"));

  /** Ingredients that exist, including the ones created in this session. */
  const known = [...ingredients];

  /** Suggestions for the unit of a new ingredient, the same as on the inventory page. */
  const unitOptions = document.createElement("datalist");
  unitOptions.id = UNIT_LIST_ID;
  document.body.append(unitOptions);

  /** Note above the save button that lists the ingredients the recipe creates. */
  const newIngredientNote = el("p", "muted", "");
  newIngredientNote.hidden = true;
  saveButton.before(newIngredientNote);

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
  saveButton.addEventListener("click", save);
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
    fillUnitOptions();

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
    updateNewIngredientNote();
  }

  /** Fills the unit suggestions with the units of all known ingredients. */
  function fillUnitOptions() {
    const units = [...new Set(known.map((ingredient) => ingredient.unit))].sort(compareText);
    unitOptions.replaceChildren(
      ...units.map((unit) => {
        const option = document.createElement("option");
        option.value = unit;
        return option;
      }),
    );
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
   * Adds one ingredient row: a search field, an amount and the unit. The unit is shown as text
   * for a known ingredient and as a text field for every other row.
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

    const unitText = el("span", "ingredient-unit muted");
    const unitInput = el("input", "ingredient-unit-input");
    unitInput.type = "text";
    unitInput.placeholder = "Unit";
    unitInput.setAttribute("list", UNIT_LIST_ID);
    unitInput.setAttribute("aria-label", "Unit");

    const remove = el("button", "row-delete");
    remove.append(createIcon("close"));
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove ingredient");

    /** Shows the unit as text for a known ingredient, and as a text field for every other row. */
    function showUnit() {
      const isKnown = Boolean(item.dataset.ingredientId);
      unitText.hidden = !isKnown;
      unitInput.hidden = isKnown;
    }

    /** @param {Ingredient} ingredient */
    function choose(ingredient) {
      item.dataset.ingredientId = ingredient.id;
      search.value = ingredient.name;
      unitText.textContent = ingredient.unit;
      options.hidden = true;
      showUnit();
    }

    function showOptions() {
      // A chosen ingredient shows the full list, so another one can be picked.
      const typed = item.dataset.ingredientId ? "" : comparableName(search.value);
      const matches = [...known]
        .sort((a, b) => compareText(a.name, b.name))
        .filter((ingredient) => comparableName(ingredient.name).includes(typed));
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
      const match = findIngredientByName(known, search.value);
      if (match) {
        item.dataset.ingredientId = match.id;
        unitText.textContent = match.unit;
      } else {
        delete item.dataset.ingredientId;
        unitText.textContent = "";
      }
      showUnit();
      showOptions();
      updateNewIngredientNote();
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
    unitInput.addEventListener("input", updateNewIngredientNote);
    remove.addEventListener("click", () => {
      item.remove();
      updateNewIngredientNote();
    });

    if (entry) {
      const ingredient = known.find((candidate) => candidate.id === entry.ingredientId);
      if (ingredient) choose(ingredient);
      amount.value = String(entry.amount);
    }
    showUnit();

    item.append(field, amountLabel, unitText, unitInput, remove);
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

  /**
   * Reads the content of the form, not checked yet. A row that is completely empty is left
   * out without a message. A row with a name that matches no ingredient is a new ingredient
   * with the typed name and unit. A row with an amount or unit but no name is passed on, so
   * validation reports it.
   * @returns {RecipeDraft}
   */
  function readDraft() {
    /** @type {DraftIngredient[]} */
    const entries = [];
    for (const child of [...ingredientsBox.children]) {
      const item = /** @type {HTMLElement} */ (child);
      const typed = /** @type {HTMLInputElement} */ (item.querySelector(".row-recipe")).value.trim();
      const unit = /** @type {HTMLInputElement} */ (item.querySelector(".ingredient-unit-input")).value.trim();
      const amountText = /** @type {HTMLInputElement} */ (item.querySelector(".row-portions-input")).value.trim();
      const amount = Number(amountText);

      if (typed === "" && unit === "" && amountText === "") continue;
      if (typed === "") {
        entries.push({ ingredientId: "", amount });
        continue;
      }

      const ingredientId = item.dataset.ingredientId ?? findIngredientByName(known, typed)?.id;
      if (ingredientId) {
        entries.push({ ingredientId, amount });
      } else {
        entries.push({ ingredientId: "", amount, newIngredient: { name: typed, unit } });
      }
    }

    const steps = [...stepsBox.querySelectorAll("textarea")].map((area) => area.value);
    const { servings, portionWeight } = currentScaleValues();

    return {
      id: currentId ?? "",
      name: nameInput.value.trim(),
      type: /** @type {RecipeDraft["type"]} */ (typeSelect.value),
      servings,
      portionWeight,
      ingredients: entries,
      steps,
    };
  }

  /**
   * Lists the ingredients that the recipe creates, above the save button. Names that differ
   * only in case or spaces are listed once.
   */
  function updateNewIngredientNote() {
    /** @type {Map<string, string>} */
    const names = new Map();
    for (const entry of readDraft().ingredients) {
      if (entry.newIngredient) {
        const key = comparableName(entry.newIngredient.name);
        if (!names.has(key)) names.set(key, entry.newIngredient.name);
      }
    }
    newIngredientNote.hidden = names.size === 0;
    newIngredientNote.textContent = `New ingredients: ${[...names.values()].join(", ")}. Created locally when saved.`;
  }

  /**
   * Reads and checks the form. Shows the problems and returns null if something is wrong.
   * Otherwise returns the recipe file and the ingredients that it creates.
   * @returns {{ recipe: Recipe, created: Ingredient[] } | null}
   */
  function checkedRecipe() {
    const draft = readDraft();
    // The id is fixed by the first successful save or download, so later name changes keep it.
    draft.id = currentId ?? createUniqueId(draft.name, takenIds ?? new Set());
    const errors = validateRecipeDraft(draft, indexById(known), takenIds);
    showErrors(errors);
    if (errors.length > 0) return null;

    const resolved = resolveNewIngredients(draft, known);
    currentId = draft.id;
    return { recipe: buildRecipeFile(resolved.draft), created: resolved.created };
  }

  function save() {
    const result = checkedRecipe();
    if (!result) return;
    known.push(...result.created);
    fillUnitOptions();
    onSave(result.recipe, result.created);
  }

  /** Downloads the recipe as a file that can be added to recipes/ by pull request. */
  function download() {
    const result = checkedRecipe();
    if (!result) return;

    if (result.created.length > 0) {
      known.push(...result.created);
      fillUnitOptions();
      onIngredientsCreated(result.created);
    }
    updateNewIngredientNote();

    const blob = new Blob([`${JSON.stringify(result.recipe, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.recipe.id}.json`;
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
