// @ts-check
// Inventory page. Edits the amounts of all ingredients. Every change is saved in the
// local storage of this browser, so the main page uses it. The JSON file is used to
// share an inventory.
import { groupByCategory } from "../core/ingredient-editing.js";
import { DEFAULT_INVENTORY_NAME, buildInventoryFile, parseInventory } from "../core/inventory.js";
import { indexById } from "../core/utils.js";
import { loadAppData } from "../data.js";
import { buildInventoryPdf } from "../pdf/documents.js";
import { loadStoredInventory, saveStoredInventory } from "../storage.js";
import { fitInputWidth } from "../ui/fit-input.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Inventory} Inventory */

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
 * @param {Ingredient[]} ingredients
 */
function start(ingredients) {
  const ingredientsById = indexById(ingredients);
  const groups = groupByCategory(ingredients);

  const stored = loadStoredInventory(ingredientsById);
  /** @type {Inventory} */
  let inventory = stored?.inventory ?? {};
  nameInput.value = stored?.name ?? "";

  fitInputWidth(nameInput, { fullWidthOnFocus: true });
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

  /** Shows all categories with the ingredients that match the search text. */
  function renderList() {
    const query = searchInput.value.trim().toLowerCase();
    const sections = groups
      .map((group) => ({
        title: group.title,
        ingredients: group.ingredients.filter((ingredient) =>
          ingredient.name.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.ingredients.length > 0);

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
        return block;
      }),
    );
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
    const sections = groups
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
 * Replaces the notices with the given messages.
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
