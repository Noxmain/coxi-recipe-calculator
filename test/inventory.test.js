import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInventory } from "../js/core/inventory.js";
import { indexById } from "../js/core/utils.js";

const ingredientsById = indexById([
  { id: "olive-oil", name: "Olive oil", unit: "ml" },
  { id: "onion", name: "Onion", unit: "piece" },
]);

test("a valid inventory is accepted", () => {
  const data = { schemaVersion: 1, kind: "inventory", items: { "olive-oil": 500, onion: 3 } };
  const result = parseInventory(data, ingredientsById);
  assert.deepEqual(result.inventory, { "olive-oil": 500, onion: 3 });
  assert.deepEqual(result.warnings, []);
});

test("unknown ingredient ids are skipped with a warning", () => {
  const data = { schemaVersion: 1, kind: "inventory", items: { onion: 3, "ghost-item": 1 } };
  const result = parseInventory(data, ingredientsById);
  assert.deepEqual(result.inventory, { onion: 3 });
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /ghost-item/);
});

test("a file of another kind is rejected", () => {
  const data = { schemaVersion: 1, kind: "recipe", items: {} };
  assert.throws(() => parseInventory(data, ingredientsById), /not a valid inventory/);
});

test("negative amounts are rejected", () => {
  const data = { schemaVersion: 1, kind: "inventory", items: { onion: -1 } };
  assert.throws(() => parseInventory(data, ingredientsById), /Invalid amount/);
});
