// @ts-check
// "Export all local changes" in the settings dialog. Writes one file per change, in the
// format of the repository, so the files can be added to a pull request. The button is
// shown only when this browser has local changes.
import { buildChangeFiles } from "../core/export-changes.js";
import { indexById } from "../core/utils.js";
import { loadAppData } from "../data.js";
import { loadStoredInventory, readLocalIngredients, readLocalRecipes } from "../storage.js";

/** @typedef {import("../core/export-changes.js").ChangeFile} ChangeFile */

const exportButton = /** @type {HTMLButtonElement} */ (document.querySelector("#export-changes"));
const settingsButton = document.querySelector("#share-open");

/**
 * Files of the last check. The export uses them, so the downloads start directly after the click.
 * @type {ChangeFile[]}
 */
let files = [];

settingsButton?.addEventListener("click", refresh);
exportButton.addEventListener("click", exportChanges);

/** Checks for local changes and shows the button only if there are some. */
async function refresh() {
  try {
    files = await collectChanges();
  } catch {
    files = [];
  }
  exportButton.hidden = files.length === 0;
}

/** @returns {Promise<ChangeFile[]>} */
async function collectChanges() {
  const { ingredients } = await loadAppData("");
  return buildChangeFiles({
    localRecipes: readLocalRecipes(),
    localIngredients: readLocalIngredients(),
    ingredients,
    inventory: loadStoredInventory(indexById(ingredients)),
  });
}

/** Downloads the files one after another. A short pause keeps the browser from dropping downloads. */
async function exportChanges() {
  for (const file of files) {
    const blob = new Blob([`${JSON.stringify(file.content, null, 2)}\n`], { type: "application/json" });
    downloadBlob(blob, file.fileName);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
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
