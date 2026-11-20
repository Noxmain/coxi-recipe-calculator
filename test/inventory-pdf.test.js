import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInventoryPdf } from "../js/pdf/inventory-pdf.js";

test("the title contains the inventory name and the amounts carry their unit", () => {
  const definition = buildInventoryPdf("Pantry", [
    { title: "Oils", items: [{ name: "Olive oil", amount: 500, unit: "ml" }] },
  ]);
  const text = JSON.stringify(definition);
  assert.ok(text.includes("Inventory: Pantry"));
  assert.ok(text.includes("500 ml"));
  assert.ok(text.includes("Oils"));
});

test("an empty inventory says that nothing is in stock", () => {
  const definition = buildInventoryPdf("Pantry", []);
  assert.ok(JSON.stringify(definition).includes("Nothing in stock."));
});
