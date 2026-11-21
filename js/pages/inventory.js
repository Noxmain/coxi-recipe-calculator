// @ts-check
// Inventory page. Edits the amounts of all ingredients. Every change is saved in the
// local storage of this browser, so the main page uses it. The JSON file is used to
// share an inventory. New ingredients can be created in the section Uncategorized. They
// are saved in this browser when the user presses "Save new ingredients".
import {
  UNCATEGORIZED_TITLE,
  createIngredientsFromDrafts,
  groupByCategory,
} from "../core/ingredient-editing.js";
import { DEFAULT_INVENTORY_NAME, buildInventoryFile, parseInventory } from "../core/inventory.js";
import { compareText, indexById } from "../core/utils.js";
import { loadAppData } from "../data.js";
import { buildInventoryPdf } from "../pdf/documents.js";
import { loadStoredInventory, saveLocalIngredient, saveStoredInventory } from "../storage.js";
import { fitInputWidth } from "../ui/fit-input.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Inventory} Inventory */
/** @typedef {import("../core/ingredient-editing.js").NewIngredientDraft} NewIngredientDraft */

const nameInput = /** @type {HTMLInputElement} */ (document.querySelector("#inventory-name"));
const searchInput = /** @type {HTMLInputElement} */ (document.querySelector("#inventory-search"));
const listBox = /** @type {HTMLElement} */ (document.querySelector("#inventory-list"));
const noticesBox = /** @type {HTMLElement} */ (document.querySelector("#notices"));
const exportJsonButton = /** @type {HTMLButtonElement} */ (document.querySelector("#export-json"));
const exportPdfButton = /** @type {HTMLButtonElement} */ (document.querySelector("#export-pdf"));
const fileInput = /** @type {HTMLInputElement} */ (document.querySelector("#inventory-file"));

main();

/** Loads the ingredients (merged with the saved ones), then starts the page. */
async function main() {
  try {
    const { ingredients } = await loadAppData("../");
    start(ingredients);
  } catch (error) {
    showNotices([`The data could not be loaded. ${/** @type {Error} */ (error).message}`]);
  }
}

/**
 * @param {Ingredient[]} allIngredients
 */
function start(allIngredients) {
  const ingredientsById = indexById(allIngredients);
  /** @type {Ingredient[]} */
  let ingredients = allIngredients;
  /** @type {NewIngredientDraft[]} */
  let drafts = [];
  /** @type {string[]} Warnings about the new-ingredient rows. Shown above their buttons. */
  let draftWarnings = [];

  // Suggestions for the unit field of a new ingredient, the same as on the ingredients page.
  const unitOptions = document.createElement("datalist");
  unitOptions.id = "unit-options";
  document.body.append(unitOptions);

  const stored = loadStoredInventory(ingredientsById);
  /** @type {Inventory} */
  let inventory = stored?.inventory ?? {};
  nameInput.value = stored?.name ?? "";

  fitInputWidth(nameInput, { fullWidthOnFocus: true });
  fillUnitOptions();
  renderList();

  nameInput.addEventListener("input", save);
  searchInput.addEventListener("input", renderList);
  exportJsonButton.addEventListener("click", exportJson);
  exportPdfButton.addEventListener("click", exportPdf);
  fileInput.addEventListener("change", loadFile);

  /** Saves the name and all amounts in the local storage. */
  function save() {
    saveStoredInventory(nameInput.value, inventory);
  }

  /**
   * Stores the amount of one ingredient. An empty field removes the entry.
   * Invalid text is ignored and keeps the last valid amount.
   * @param {string} id
   * @param {string} text
   */
  function setAmount(id, text) {
    const trimmed = text.trim();
    if (trimmed === "") {
      delete inventory[id];
    } else {
      const value = Number(trimmed);
      if (!Number.isFinite(value) || value < 0) return;
      inventory[id] = value;
    }
    save();
  }

  /** Fills the unit suggestions with all units of the ingredients, sorted, without duplicates. */
  function fillUnitOptions() {
    const units = [...new Set(ingredients.map((ingredient) => ingredient.unit))].sort(compareText);
    unitOptions.replaceChildren(
      ...units.map((unit) => {
        const option = document.createElement("option");
        option.value = unit;
        return option;
      }),
    );
  }

  /**
   * Shows all categories with the ingredients that match the search text. The group
   * Uncategorized is always shown, even when it is empty, and always comes last. Its new
   * rows, warnings and buttons follow the existing ingredients.
   */
  function renderList() {
    const query = searchInput.value.trim().toLowerCase();
    const sections = withUncategorized(groupByCategory(ingredients))
      .map((group) => ({
        title: group.title,
        ingredients: group.ingredients.filter((ingredient) =>
          ingredient.name.toLowerCase().includes(query),
        ),
      }))
      .filter(
        (section) => section.title === UNCATEGORIZED_TITLE || section.ingredients.length > 0,
      );

    listBox.replaceChildren(
      ...sections.map((section) => {
        const heading = document.createElement("h3");
        heading.textContent = section.title;

        const list = document.createElement("ul");
        list.className = "rows";
        list.append(...section.ingredients.map(renderRow));

        const block = document.createElement("section");
        block.className = "planner-section";
        block.append(heading, list);

        if (section.title === UNCATEGORIZED_TITLE) {
          list.append(...drafts.map(renderDraft));
          if (draftWarnings.length > 0) {
            block.append(draftWarningBox());
          }
          block.append(draftButtons());
        }
        return block;
      }),
    );
  }

  /**
   * The buttons under the new-ingredient rows: "+ New ingredient" always, the save and
   * discard buttons only while there are rows.
   * @returns {HTMLElement}
   */
  function draftButtons() {
    const bar = document.createElement("div");
    bar.className = "inventory-actions";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "button-link";
    addButton.textContent = "+ New ingredient";
    addButton.addEventListener("click", addDraft);
    bar.append(addButton);

    if (drafts.length > 0) {
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "button-link";
      saveButton.textContent = "Save new ingredients";
      saveButton.addEventListener("click", saveDrafts);

      const discardButton = document.createElement("button");
      discardButton.type = "button";
      discardButton.className = "button-link";
      discardButton.textContent = "Discard new ingredients";
      discardButton.addEventListener("click", discardDrafts);

      bar.append(saveButton, discardButton);
    }
    return bar;
  }

  /** Adds an empty row at the bottom of the new ingredients and puts the focus into its name. */
  function addDraft() {
    drafts = [...drafts, { name: "", unit: "", amount: "" }];
    renderList();
    const inputs = listBox.querySelectorAll(".draft-name");
    /** @type {HTMLInputElement | undefined} */ (inputs[inputs.length - 1])?.focus();
  }

  /**
   * Creates the ingredients of the complete rows, stores their amounts and keeps the
   * other rows with their warnings.
   */
  function saveDrafts() {
    const result = createIngredientsFromDrafts(drafts, ingredients);
    for (const { ingredient, amount } of result.created) {
      saveLocalIngredient(ingredient);
      ingredientsById.set(ingredient.id, ingredient);
      if (amount !== null) {
        inventory[ingredient.id] = amount;
      }
    }
    ingredients = [...ingredients, ...result.created.map((item) => item.ingredient)];
    drafts = result.remaining;
    draftWarnings = result.warnings;

    save();
    fillUnitOptions();
    renderList();
  }

  /** Removes all new-ingredient rows and their warnings. Nothing is saved. */
  function discardDrafts() {
    drafts = [];
    draftWarnings = [];
    renderList();
  }

  /** @returns {HTMLUListElement} The warnings about the new-ingredient rows. */
  function draftWarningBox() {
    const box = document.createElement("ul");
    box.className = "notices";
    box.append(
      ...draftWarnings.map((message) => {
        const item = document.createElement("li");
        item.textContent = message;
        return item;
      }),
    );
    return box;
  }

  /**
   * One row for a new ingredient that is not saved yet. The values are kept in the draft,
   * so they survive a new rendering of the list.
   * @param {NewIngredientDraft} draft
   * @returns {HTMLElement}
   */
  function renderDraft(draft) {
    const name = document.createElement("input");
    name.type = "text";
    name.className = "row-recipe draft-name";
    name.placeholder = "Name";
    name.setAttribute("aria-label", "Name of the new ingredient");
    name.value = draft.name;
    name.addEventListener("input", () => {
      draft.name = name.value;
    });

    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "0";
    amount.step = "any";
    amount.placeholder = "0";
    amount.className = "row-portions-input";
    amount.setAttribute("aria-label", "Amount of the new ingredient");
    amount.value = draft.amount;
    amount.addEventListener("input", () => {
      draft.amount = amount.value;
    });

    const unit = document.createElement("input");
    unit.type = "text";
    unit.className = "row-recipe";
    unit.placeholder = "Unit";
    unit.setAttribute("list", "unit-options");
    unit.setAttribute("aria-label", "Unit of the new ingredient");
    unit.value = draft.unit;
    unit.addEventListener("input", () => {
      draft.unit = unit.value;
    });

    const item = document.createElement("li");
    item.className = "row inventory-draft-row";
    item.append(name, amount, unit);
    return item;
  }

  /**
   * @param {Ingredient} ingredient
   * @returns {HTMLElement}
   */
  function renderRow(ingredient) {
    const name = document.createElement("span");
    name.className = "inventory-name";
    name.textContent = ingredient.name;

    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "0";
    amount.step = "any";
    amount.placeholder = "0";
    amount.className = "row-portions-input";
    amount.setAttribute("aria-label", `Amount of ${ingredient.name}`);
    amount.value = Object.hasOwn(inventory, ingredient.id) ? String(inventory[ingredient.id]) : "";
    amount.addEventListener("input", () => setAmount(ingredient.id, amount.value));

    const unit = document.createElement("span");
    unit.className = "inventory-unit muted";
    unit.textContent = ingredient.unit;

    const item = document.createElement("li");
    item.className = "row inventory-row";
    item.append(name, amount, unit);
    return item;
  }

  function exportJson() {
    const file = buildInventoryFile(nameInput.value, inventory);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    downloadBlob(blob, fileName("json"));
  }

  function exportPdf() {
    const sections = groupByCategory(ingredients)
      .map((group) => ({
        title: group.title,
        items: group.ingredients
          .filter((ingredient) => Object.hasOwn(inventory, ingredient.id))
          .map((ingredient) => ({
            name: ingredient.name,
            amount: inventory[ingredient.id],
            unit: ingredient.unit,
          })),
      }))
      .filter((section) => section.items.length > 0);

    const name = nameInput.value.trim() || DEFAULT_INVENTORY_NAME;
    const pdfMake = /** @type {any} */ (window).pdfMake;
    pdfMake.createPdf(buildInventoryPdf(name, sections)).download(fileName("pdf"));
  }

  /** Loads an inventory file into the page and saves it in this browser. */
  async function loadFile() {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const result = parseInventory(JSON.parse(await file.text()), ingredientsById);
      nameInput.value = result.name;
      inventory = result.inventory;
      save();
      renderList();
      // Setting the value does not fire an input event, so the width is updated here.
      nameInput.dispatchEvent(new Event("input"));
      showNotices(result.warnings);
    } catch (error) {
      showNotices([`The inventory file could not be loaded. ${/** @type {Error} */ (error).message}`]);
    } finally {
      fileInput.value = "";
    }
  }

  /**
   * @param {string} extension
   * @returns {string} For example "inventory-pantry-may-2025.json".
   */
  function fileName(extension) {
    const name = nameInput.value.trim() || DEFAULT_INVENTORY_NAME;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return slug ? `inventory-${slug}.${extension}` : `inventory.${extension}`;
  }
}

/**
 * Makes sure the group Uncategorized exists, so it is shown even without ingredients.
 * @param {{ title: string, ingredients: Ingredient[] }[]} groups Sorted by groupByCategory.
 * @returns {{ title: string, ingredients: Ingredient[] }[]}
 */
function withUncategorized(groups) {
  if (groups.some((group) => group.title === UNCATEGORIZED_TITLE)) {
    return groups;
  }
  return [...groups, { title: UNCATEGORIZED_TITLE, ingredients: [] }];
}

/**
 * Replaces the notices at the top of the page with the given messages.
 * @param {string[]} messages
 */
function showNotices(messages) {
  noticesBox.replaceChildren(
    ...messages.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
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
