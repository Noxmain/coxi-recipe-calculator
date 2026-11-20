// @ts-check
// Document definition for the inventory PDF. A pure function that returns a plain
// object. The caller creates the file with pdfMake.createPdf(definition).download(name).
import { formatAmount } from "../core/format.js";

/**
 * @typedef {Object} InventoryPdfItem
 * @property {string} name
 * @property {number} amount
 * @property {string} unit
 */

/**
 * @typedef {Object} InventoryPdfSection
 * @property {string} title Category name.
 * @property {InventoryPdfItem[]} items
 */

const MUTED = "#6b5d4d";

const styles = {
  title: { fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
  heading: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
  muted: { color: MUTED, margin: [0, 0, 0, 10] },
  tableHeader: { bold: true, color: MUTED },
};

/**
 * One section per category, listing the amounts that are in stock.
 * @param {string} name
 * @param {InventoryPdfSection[]} sections
 * @returns {Record<string, any>}
 */
export function buildInventoryPdf(name, sections) {
  const title = `Inventory: ${name}`;

  /** @type {any[]} */
  const content = [{ text: title, style: "title" }];
  if (sections.length === 0) {
    content.push({ text: "Nothing in stock.", style: "muted" });
  }
  for (const section of sections) {
    content.push({ text: section.title, style: "heading" });
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", "auto"],
        body: [
          [
            { text: "Ingredient", style: "tableHeader" },
            { text: "Amount", style: "tableHeader", alignment: "right" },
          ],
          ...section.items.map((item) => [
            item.name,
            { text: `${formatAmount(item.amount)} ${item.unit}`, alignment: "right" },
          ]),
        ],
      },
      layout: "lightHorizontalLines",
    });
  }

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [40, 40, 40, 40],
    info: { title },
    defaultStyle: { fontSize: 10 },
    styles,
    content,
  };
}
