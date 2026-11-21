// @ts-check
// Renders the PDF download buttons and the price estimate on the main page.
// The shopping list itself is only available as PDF.
import { formatMoney, formatPercent } from "../core/format.js";
import { createIcon } from "./icon.js";

/** @typedef {import("../core/types.js").PriceSummary} PriceSummary */

/**
 * @typedef {Object} ResultsView
 * @property {PriceSummary} summary
 * @property {{ recipes: () => void, sorting: () => void, labels: () => void, shopping: () => void }} downloads
 */

/**
 * Replaces the content of the results box.
 * @param {HTMLElement} container
 * @param {ResultsView} view
 */
export function renderResults(container, view) {
  container.replaceChildren(
    el("h2", "", "Results"),
    renderDownloads(view.downloads),
    renderSummary(view.summary),
  );
}

/** @param {ResultsView["downloads"]} downloads */
function renderDownloads(downloads) {
  return el(
    "div",
    "downloads",
    downloadButton("Recipes PDF", downloads.recipes),
    downloadButton("Sorting list PDF", downloads.sorting),
    downloadButton("Labels PDF", downloads.labels),
    downloadButton("Shopping list PDF", downloads.shopping),
  );
}

/**
 * @param {string} text
 * @param {() => void} onClick
 * @returns {HTMLButtonElement}
 */
function downloadButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "download-button";
  button.append(createIcon("download"), text);
  button.addEventListener("click", onClick);
  return button;
}

/** @param {PriceSummary} summary */
function renderSummary(summary) {
  const complete = summary.pricedCount === summary.itemCount;

  return el(
    "section",
    "summary",
    el("h3", "", "Price estimate"),
    el(
      "dl",
      "",
      el("dt", "", "Value of the food used"),
      el(
        "dd",
        "",
        `${formatMoney(summary.absoluteTotal)} (${formatMoney(summary.absolutePerPerson)} per person)`,
      ),
      el("dt", "", "Purchase total, whole packages"),
      el(
        "dd",
        "",
        `${formatMoney(summary.purchaseTotal)} (${formatMoney(summary.purchasePerPerson)} per person)`,
      ),
    ),
    el(
      "p",
      "muted",
      `Price known for ${summary.pricedCount} of ${summary.itemCount} ingredients (${formatPercent(summary.pricedCount, summary.itemCount)}).`,
    ),
    complete
      ? ""
      : el("p", "notice-text", "The price estimates are lower bounds, because some ingredients have no price."),
  );
}

/**
 * Creates an element with an optional class name and children (nodes or text).
 * @param {string} tag
 * @param {string} className Empty string for no class.
 * @param {(Node | string)[]} children
 * @returns {HTMLElement}
 */
function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  node.append(...children);
  return node;
}
