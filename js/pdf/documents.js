// @ts-check
// Document definitions for pdfmake. These are pure functions: they return
// plain objects and never call pdfMake. The caller creates the file with
// pdfMake.createPdf(definition).download(fileName).
import {
  NO_PACKAGE_SIZE_TEXT,
  formatAmount,
  formatDate,
  formatMoney,
  formatPercent,
} from "../core/format.js";
import { getScaleFactor } from "../core/recipes.js";
import { compareText, requireIngredient } from "../core/utils.js";

/** @typedef {import("../core/types.js").Ingredient} Ingredient */
/** @typedef {import("../core/types.js").Recipe} Recipe */
/** @typedef {import("../core/types.js").PriceSummary} PriceSummary */
/** @typedef {import("../core/types.js").ShoppingGroup} ShoppingGroup */
/** @typedef {import("../core/types.js").ShoppingItem} ShoppingItem */
/** @typedef {import("../core/planner.js").PlanEntry} PlanEntry */
/** @typedef {import("../core/recipes.js").TypeAmount} TypeAmount */

/**
 * Label grid per A4 portrait page. Only the counts are set here, never a label size.
 * @type {{ columns: number, rows: number }}
 */
export const LABEL_LAYOUT = { columns: 2, rows: 6 };

const A4_HEIGHT = 841.89; // points
const LABEL_PAGE_MARGIN = 30;
const LABEL_ROW_HEIGHT = Math.floor((A4_HEIGHT - 2 * LABEL_PAGE_MARGIN) / LABEL_LAYOUT.rows);
/** Separator between ingredient names on a label. */
const LABEL_SEPARATOR = "      ";
/** Line height of the ingredient names on a label, as a factor of the font size. */
const LABEL_LINE_HEIGHT = 1.8;

const TYPE_ORDER = /** @type {const} */ (["main", "spread", "other"]);
const TYPE_TITLES = { main: "Mains", spread: "Spreads", other: "Others" };
const TYPE_LABELS = { main: "Main dish", spread: "Spread", other: "Other" };
const MUTED = "#6b5d4d";
const ALERT = "#cf3f26";

const styles = {
  title: { fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
  heading: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
  muted: { color: MUTED, margin: [0, 0, 0, 10] },
  tableHeader: { bold: true, color: MUTED },
};

/** Dashed grid for the labels, so they can be cut out. */
const dashedGrid = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => "#999999",
  vLineColor: () => "#999999",
  hLineStyle: () => ({ dash: { length: 4 } }),
  vLineStyle: () => ({ dash: { length: 4 } }),
};

/**
 * One A4 page per planned recipe, with scaled amounts and the working steps.
 * @param {PlanEntry[]} entries
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {Record<string, any>}
 */
export function buildRecipesPdf(entries, ingredientsById) {
  /** @type {any[]} */
  const content = [];
  entries.forEach((entry, index) => {
    if (index > 0) content.push({ text: "", pageBreak: "before" });
    content.push(...recipeContent(entry, ingredientsById));
  });
  return createDocument(content, "Recipes");
}

/**
 * @param {PlanEntry} entry
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {any[]}
 */
function recipeContent({ recipe, portions, date }, ingredientsById) {
  const factor = getScaleFactor(recipe, portions);

  const facts = [TYPE_LABELS[recipe.type], portions === 1 ? "1 portion" : `${portions} portions`];
  if (recipe.portionWeight !== undefined) {
    facts.push(`${recipe.portionWeight} g per portion`);
  }
  if (date) {
    facts.push(formatDate(date));
  }

  const rows = recipe.ingredients.map(({ ingredientId, amount }) => {
    const ingredient = requireIngredient(ingredientsById, ingredientId);
    return [
      ingredient.name,
      { text: `${formatAmount(amount * factor)} ${ingredient.unit}`, alignment: "right" },
    ];
  });

  return [
    { text: recipe.name, style: "title" },
    { text: facts.join("  ·  "), style: "muted" },
    {
      table: {
        headerRows: 1,
        widths: ["*", "auto"],
        body: [
          [
            { text: "Ingredient", style: "tableHeader" },
            { text: "Amount", style: "tableHeader", alignment: "right" },
          ],
          ...rows,
        ],
      },
      layout: "lightHorizontalLines",
    },
    { text: "Working steps", style: "heading" },
    // Each step gets its own paragraph with space below it.
    { ol: recipe.steps.map((step) => ({ text: step, margin: [0, 0, 0, 8] })) },
  ];
}

/**
 * Ingredients per recipe type with the summed amounts, so it is visible how
 * much of each ingredient goes into which type.
 * @param {Record<Recipe["type"], TypeAmount[]>} amountsByType
 * @returns {Record<string, any>}
 */
export function buildSortingPdf(amountsByType) {
  /** @type {any[]} */
  const content = [{ text: "Ingredient sorting list", style: "title" }];
  for (const type of TYPE_ORDER) {
    content.push({ text: TYPE_TITLES[type], style: "heading" });
    content.push(sortingTable(amountsByType[type]));
  }
  return createDocument(content, "Ingredient sorting list");
}

/**
 * @param {TypeAmount[]} items
 * @returns {any}
 */
function sortingTable(items) {
  if (items.length === 0) {
    return { text: "None", style: "muted" };
  }
  return {
    table: {
      headerRows: 1,
      widths: ["*", "auto"],
      body: [
        [
          { text: "Ingredient", style: "tableHeader" },
          { text: "Amount", style: "tableHeader", alignment: "right" },
        ],
        ...items.map((item) => [
          item.name,
          { text: `${formatAmount(item.amount)} ${item.unit}`, alignment: "right" },
        ]),
      ],
    },
    layout: "lightHorizontalLines",
  };
}

/**
 * One label per planned recipe, with the ingredient names but no amounts.
 * Labels are placed in the grid from LABEL_LAYOUT, several pages if needed.
 * @param {PlanEntry[]} entries
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {Record<string, any>}
 */
export function buildLabelsPdf(entries, ingredientsById) {
  const labelsPerPage = LABEL_LAYOUT.columns * LABEL_LAYOUT.rows;
  const labels = entries.map((entry) => labelCell(entry, ingredientsById));

  /** @type {any[]} */
  const content = [];
  for (let start = 0; start < labels.length; start += labelsPerPage) {
    if (start > 0) content.push({ text: "", pageBreak: "before" });
    content.push(labelPage(labels.slice(start, start + labelsPerPage)));
  }
  return createDocument(content, "Ingredient labels", [
    LABEL_PAGE_MARGIN,
    LABEL_PAGE_MARGIN,
    LABEL_PAGE_MARGIN,
    LABEL_PAGE_MARGIN,
  ]);
}

/**
 * @param {PlanEntry} entry
 * @param {Map<string, Ingredient>} ingredientsById
 * @returns {Record<string, any>}
 */
function labelCell({ recipe }, ingredientsById) {
  const names = [
    ...new Set(
      recipe.ingredients.map(({ ingredientId }) => requireIngredient(ingredientsById, ingredientId).name),
    ),
  ].sort(compareText);

  return {
    stack: [
      { text: recipe.name, bold: true, fontSize: 14, margin: [0, 0, 0, 8] },
      { text: names.join(LABEL_SEPARATOR), fontSize: 10, lineHeight: LABEL_LINE_HEIGHT },
    ],
    margin: [12, 12, 12, 12],
  };
}

/**
 * One page of the label grid. Cells that are not used stay empty.
 * @param {Record<string, any>[]} cells
 * @returns {Record<string, any>}
 */
function labelPage(cells) {
  /** @type {any[][]} */
  const body = [];
  for (let start = 0; start < cells.length; start += LABEL_LAYOUT.columns) {
    const row = cells.slice(start, start + LABEL_LAYOUT.columns);
    while (row.length < LABEL_LAYOUT.columns) {
      row.push({ text: "" });
    }
    body.push(row);
  }

  return {
    table: {
      widths: Array.from({ length: LABEL_LAYOUT.columns }, () => "*"),
      heights: LABEL_ROW_HEIGHT,
      body,
    },
    layout: dashedGrid,
  };
}

/**
 * Shopping list grouped by shop, with the price estimate at the end.
 * @param {{ eventName: string, groups: ShoppingGroup[], summary: PriceSummary }} view
 * @returns {Record<string, any>}
 */
export function buildShoppingPdf({ eventName, groups, summary }) {
  const title = eventName ? `Shopping list: ${eventName}` : "Shopping list";

  /** @type {any[]} */
  const content = [{ text: title, style: "title" }];
  for (const group of groups) {
    content.push({ text: group.shop ?? "No shop set", style: "heading" });
    content.push(shoppingTable(group.items));
  }
  content.push(...summaryContent(summary));
  return createDocument(content, title);
}

/**
 * @param {ShoppingItem[]} items
 * @returns {Record<string, any>}
 */
function shoppingTable(items) {
  const header = ["Ingredient", "Needed", "In stock", "To buy", "Packages", "Bought"].map((text) => ({
    text,
    style: "tableHeader",
  }));

  return {
    table: {
      headerRows: 1,
      widths: ["*", 62, 62, 62, 90, 34],
      body: [header, ...items.map(shoppingRow)],
    },
    layout: "lightHorizontalLines",
  };
}

/**
 * @param {ShoppingItem} item
 * @returns {any[]}
 */
function shoppingRow(item) {
  return [
    {
      stack: [item.name, { text: item.category ?? "Uncategorized", fontSize: 8, color: MUTED }],
    },
    `${formatAmount(item.needed)} ${item.unit}`,
    `${formatAmount(item.inStock)} ${item.unit}`,
    `${formatAmount(item.toBuy)} ${item.unit}`,
    item.packageCount === null ? NO_PACKAGE_SIZE_TEXT : String(item.packageCount),
    // Empty box for ticking off the item in the shop.
    { canvas: [{ type: "rect", x: 0, y: 0, w: 11, h: 11, lineWidth: 1 }], margin: [8, 2, 0, 0] },
  ];
}

/**
 * @param {PriceSummary} summary
 * @returns {any[]}
 */
function summaryContent(summary) {
  const content = [
    { text: "Price estimate", style: "heading" },
    {
      table: {
        widths: ["*", "auto"],
        body: [
          [
            "Value of the food used",
            {
              text: `${formatMoney(summary.absoluteTotal)} (${formatMoney(summary.absolutePerPerson)} per person)`,
              alignment: "right",
            },
          ],
          [
            "Purchase total, whole packages",
            {
              text: `${formatMoney(summary.purchaseTotal)} (${formatMoney(summary.purchasePerPerson)} per person)`,
              alignment: "right",
            },
          ],
        ],
      },
      layout: "noBorders",
    },
    {
      text: `Price known for ${summary.pricedCount} of ${summary.itemCount} ingredients (${formatPercent(summary.pricedCount, summary.itemCount)}).`,
      style: "muted",
    },
  ];

  if (summary.pricedCount < summary.itemCount) {
    content.push({
      text: "The totals are lower bounds, because some ingredients have no price.",
      color: ALERT,
    });
  }
  return content;
}

/**
 * @param {any[]} content
 * @param {string} title
 * @param {number[]} [pageMargins]
 * @returns {Record<string, any>}
 */
function createDocument(content, title, pageMargins = [40, 40, 40, 40]) {
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins,
    info: { title },
    defaultStyle: { fontSize: 10 },
    styles,
    content,
  };
}
