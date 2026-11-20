// @ts-check
// Form for one ingredient and the unit conversion dialog that the import uses.
// The rules are in js/core/ingredient-editing.js. A changed unit is converted with the
// factor "amount in the new unit / amount in the old unit", e.g. 1 clove = 3 g gives 3.
// The page applies the factor to recipes, package sizes and the stored inventory.
import { buildIngredientRecord, roundAmount, validateIngredientDraft } from "../core/ingredient-editing.js";
import { createUniqueId } from "../core/recipe-editing.js";
import { compareText } from "../core/utils.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/ingredient-editing.js").IngredientDraft} IngredientDraft */

/**
 * @typedef {Object} UnitChange
 * @property {string} name
 * @property {string} oldUnit
 * @property {string} newUnit
 * @property {string[]} usingNames Names of the recipes that use the ingredient.
 */

/**
 * @typedef {Object} EditorOptions
 * @property {(result: { ingredient: Ingredient, factor: number | null }) => void} onSave
 * @property {(id: string) => void} onDiscard Asks the page to discard or delete the ingredient.
 * @property {() => void} onBack
 */

/**
 * @typedef {Object} OpenOptions
 * @property {Ingredient | null} ingredient Null for a new ingredient.
 * @property {Ingredient[]} allIngredients Source of the suggestions and of the ids a new ingredient must not use.
 * @property {string[]} usingRecipeNames Names of the recipes that use this ingredient.
 * @property {string | null} discardLabel Text of the discard button, or null to hide it.
 */

/**
 * Text under a unit conversion. With factor 1 the amounts stay the same.
 * @param {number} factor
 * @param {string[]} recipeNames
 * @returns {string}
 */
export function unitChangeText(factor, recipeNames) {
  if (factor === 1) {
    return "The unit changes, the amounts stay the same.";
  }
  const recipes =
    recipeNames.length === 0
      ? "No recipe uses this ingredient."
      : `This also changes the amounts in ${recipeNames.length} recipe(s): ${recipeNames.join(", ")}.`;
  return `${recipes} Inventory amounts change too.`;
}

/**
 * Factor from "oldAmount old unit = newAmount new unit".
 * @param {HTMLInputElement} oldInput
 * @param {HTMLInputElement} newInput
 * @returns {number | null} Null if an amount is not greater than 0.
 */
function factorFrom(oldInput, newInput) {
  const oldValue = Number(oldInput.value);
  const newValue = Number(newInput.value);
  if (!(oldValue > 0) || !(newValue > 0)) return null;
  return newValue / oldValue;
}

/**
 * Connects the ingredient form in ingredients/index.html.
 * @param {EditorOptions} options
 * @returns {{ open: (options: OpenOptions) => void, showErrors: (messages: string[]) => void }}
 */
export function createIngredientEditor({ onSave, onDiscard, onBack }) {
  const nameInput = /** @type {HTMLInputElement} */ (document.querySelector("#ingredient-name"));
  const unitInput = /** @type {HTMLInputElement} */ (document.querySelector("#ingredient-unit"));
  const categoryInput = /** @type {HTMLInputElement} */ (document.querySelector("#ingredient-category"));
  const sizeInput = /** @type {HTMLInputElement} */ (document.querySelector("#ingredient-package-size"));
  const priceInput = /** @type {HTMLInputElement} */ (document.querySelector("#ingredient-package-price"));
  const shopInput = /** @type {HTMLInputElement} */ (document.querySelector("#ingredient-shop"));
  const unitChange = /** @type {HTMLElement} */ (document.querySelector("#unit-change"));
  const oldUnitText = /** @type {HTMLElement} */ (document.querySelector("#unit-old"));
  const newUnitText = /** @type {HTMLElement} */ (document.querySelector("#unit-new"));
  const oldAmountInput = /** @type {HTMLInputElement} */ (document.querySelector("#unit-old-amount"));
  const newAmountInput = /** @type {HTMLInputElement} */ (document.querySelector("#unit-new-amount"));
  const affectedText = /** @type {HTMLElement} */ (document.querySelector("#unit-affected"));
  const errorsBox = /** @type {HTMLElement} */ (document.querySelector("#editor-errors"));
  const discardButton = /** @type {HTMLButtonElement} */ (document.querySelector("#discard-ingredient"));
  const discardText = /** @type {HTMLElement} */ (document.querySelector("#discard-label"));

  /** Id of the ingredient. Null for a new ingredient until it is saved. */
  let currentId = /** @type {string | null} */ (null);
  /** Unit of the ingredient as it is saved now. Null for a new ingredient. */
  let baseUnit = /** @type {string | null} */ (null);
  /** Ids a new ingredient must not use. Null when an existing ingredient is edited. */
  let takenIds = /** @type {Set<string> | null} */ (null);
  /** @type {string[]} */
  let usingNames = [];

  document.querySelector("#editor-back")?.addEventListener("click", () => onBack());
  document.querySelector("#save-ingredient")?.addEventListener("click", save);
  unitInput.addEventListener("input", updateUnitChange);
  oldAmountInput.addEventListener("input", updateUnitChange);
  newAmountInput.addEventListener("input", updateUnitChange);
  discardButton.addEventListener("click", () => {
    if (currentId !== null) onDiscard(currentId);
  });

  /**
   * Shows the form with the given ingredient, or an empty form for a new one.
   * @param {OpenOptions} options
   */
  function open({ ingredient, allIngredients, usingRecipeNames, discardLabel }) {
    currentId = ingredient ? ingredient.id : null;
    baseUnit = ingredient ? ingredient.unit : null;
    takenIds = ingredient ? null : new Set(allIngredients.map((item) => item.id));
    usingNames = usingRecipeNames;

    nameInput.value = ingredient ? ingredient.name : "";
    unitInput.value = ingredient ? ingredient.unit : "";
    categoryInput.value = ingredient?.category ?? "";
    sizeInput.value = ingredient?.packageSize === undefined ? "" : String(ingredient.packageSize);
    priceInput.value = ingredient?.packagePrice === undefined ? "" : String(ingredient.packagePrice);
    shopInput.value = ingredient?.whereToBuy ?? "";
    oldAmountInput.value = "1";
    newAmountInput.value = "1";
    fillSuggestions(allIngredients);
    updateUnitChange();

    discardButton.hidden = discardLabel === null;
    // Only the text changes, so the trash icon in front of it stays.
    discardText.textContent = discardLabel ?? "";
    showErrors([]);
  }

  /** @param {Ingredient[]} all */
  function fillSuggestions(all) {
    fillList("#unit-options", all.map((item) => item.unit));
    fillList("#category-options", all.flatMap((item) => (item.category ? [item.category] : [])));
    fillList("#shop-options", all.flatMap((item) => (item.whereToBuy ? [item.whereToBuy] : [])));
  }

  /**
   * @param {string} selector
   * @param {string[]} values
   */
  function fillList(selector, values) {
    const list = /** @type {HTMLDataListElement} */ (document.querySelector(selector));
    list.replaceChildren(
      ...[...new Set(values)].sort(compareText).map((value) => {
        const option = document.createElement("option");
        option.value = value;
        return option;
      }),
    );
  }

  /** @returns {boolean} True when an existing ingredient gets another unit. */
  function unitChanged() {
    const unit = unitInput.value.trim();
    return baseUnit !== null && unit !== "" && unit !== baseUnit;
  }

  /** Shows the conversion panel as soon as the unit differs from the saved unit. */
  function updateUnitChange() {
    const changed = unitChanged();
    unitChange.hidden = !changed;
    if (!changed) return;

    oldUnitText.textContent = baseUnit ?? "";
    newUnitText.textContent = unitInput.value.trim();
    const factor = factorFrom(oldAmountInput, newAmountInput);
    affectedText.textContent =
      factor === null ? "Both amounts must be greater than 0." : unitChangeText(factor, usingNames);
  }

  function save() {
    const name = nameInput.value.trim();
    /** @type {IngredientDraft} */
    const draft = {
      id: currentId ?? createUniqueId(name, takenIds ?? new Set()),
      name,
      unit: unitInput.value.trim(),
      category: categoryInput.value.trim(),
      packageSize: optionalNumber(sizeInput),
      packagePrice: optionalNumber(priceInput),
      whereToBuy: shopInput.value.trim(),
    };
    const errors = validateIngredientDraft(draft, takenIds);

    /** @type {number | null} */
    let factor = null;
    if (unitChanged()) {
      factor = factorFrom(oldAmountInput, newAmountInput);
      if (factor === null) {
        errors.push("Both amounts of the unit change must be greater than 0.");
      }
    }
    showErrors(errors);
    if (errors.length > 0) return;

    if (factor !== null && draft.packageSize !== undefined) {
      // The package size is still in the old unit, so it is converted with the same factor.
      draft.packageSize = roundAmount(draft.packageSize * factor);
    }
    currentId = draft.id;
    onSave({ ingredient: buildIngredientRecord(draft), factor });
  }

  /** @param {string[]} messages */
  function showErrors(messages) {
    errorsBox.replaceChildren(...messages.map((message) => el("li", "", message)));
  }

  return { open, showErrors };
}

/**
 * Asks how the units of imported ingredients convert. Resolves with one factor per change,
 * in the same order, or with null if the user cancels. Used by the ingredient import.
 * @param {UnitChange[]} changes
 * @returns {Promise<number[] | null>}
 */
export function askUnitConversions(changes) {
  const dialog = /** @type {HTMLDialogElement} */ (document.querySelector("#unit-dialog"));
  const body = /** @type {HTMLElement} */ (document.querySelector("#unit-dialog-body"));
  const errorsBox = /** @type {HTMLElement} */ (document.querySelector("#unit-dialog-errors"));
  const applyButton = /** @type {HTMLButtonElement} */ (document.querySelector("#unit-dialog-apply"));
  const cancelButton = /** @type {HTMLButtonElement} */ (document.querySelector("#unit-dialog-cancel"));

  const items = changes.map((change) => {
    const { line, oldInput, newInput } = conversionLine(change.oldUnit, change.newUnit);
    const affected = el("p", "muted", "");
    const block = el("div", "unit-change");
    block.append(el("p", "", `${change.name}: the unit changes.`), line, affected);

    const refresh = () => {
      const factor = factorFrom(oldInput, newInput);
      affected.textContent =
        factor === null ? "Both amounts must be greater than 0." : unitChangeText(factor, change.usingNames);
    };
    oldInput.addEventListener("input", refresh);
    newInput.addEventListener("input", refresh);
    refresh();
    return { block, oldInput, newInput };
  });

  body.replaceChildren(...items.map((item) => item.block));
  errorsBox.replaceChildren();
  dialog.showModal();

  return new Promise((resolve) => {
    applyButton.onclick = () => {
      const factors = items.map((item) => factorFrom(item.oldInput, item.newInput));
      if (factors.some((factor) => factor === null)) {
        errorsBox.replaceChildren(el("li", "", "Both amounts of every unit change must be greater than 0."));
        return;
      }
      dialog.close();
      resolve(/** @type {number[]} */ (factors));
    };
    cancelButton.onclick = () => {
      dialog.close();
      resolve(null);
    };
    // Escape closes the dialog without a choice, which cancels the import.
    dialog.oncancel = () => resolve(null);
  });
}

/**
 * Creates the amount fields of a conversion, "[1] old = [1] new", both starting at 1.
 * @param {string} oldUnit
 * @param {string} newUnit
 * @returns {{ line: HTMLElement, oldInput: HTMLInputElement, newInput: HTMLInputElement }}
 */
function conversionLine(oldUnit, newUnit) {
  const oldInput = numberInput(`Amount in ${oldUnit}`);
  const newInput = numberInput(`Amount in ${newUnit}`);
  const line = el("p", "unit-conversion", "");
  line.append(oldInput, ` ${oldUnit} = `, newInput, ` ${newUnit}`);
  return { line, oldInput, newInput };
}

/**
 * @param {string} label
 * @returns {HTMLInputElement}
 */
function numberInput(label) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "any";
  input.value = "1";
  input.setAttribute("aria-label", label);
  return input;
}

/**
 * @param {HTMLInputElement} input
 * @returns {number | undefined} The number, or undefined for an empty field.
 */
function optionalNumber(input) {
  const text = input.value.trim();
  return text === "" ? undefined : Number(text);
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
