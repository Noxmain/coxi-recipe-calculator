import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInventoryFile, parseInventory } from "../js/core/inventory.js";
import { indexById } from "../js/core/utils.js";

const ingredientsById = indexById([
  { id: "olive-oil", name: "Olive oil", unit: "ml" },
  { id: "onion", name: "Onion", unit: "piece" },
]);

test("a valid inventory is accepted and returns its name", () => {
  const data = {
    schemaVersion: 1,
    kind: "inventory",
    name: "Pantry",
    items: { "olive-oil": 500, onion: 3 },
  };
  const result = parseInventory(data, ingredientsById);
  assert.equal(result.name, "Pantry");
  assert.deepEqual(result.inventory, { "olive-oil": 500, onion: 3 });
  assert.deepEqual(result.warnings, []);
});

test("unknown ingredient ids are skipped with a warning", () => {
  const data = {
    schemaVersion: 1,
    kind: "inventory",
    name: "Pantry",
    items: { onion: 3, "ghost-item": 1 },
  };
  const result = parseInventory(data, ingredientsById);
  assert.deepEqual(result.inventory, { onion: 3 });
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /ghost-item/);
});

test("an inventory without a name is rejected", () => {
  const data = { schemaVersion: 1, kind: "inventory", name: "  ", items: {} };
  assert.throws(() => parseInventory(data, ingredientsById), /has no name/);
});

test("a file of another kind is rejected", () => {
  const data = { schemaVersion: 1, kind: "recipe", name: "Pantry", items: {} };
  assert.throws(() => parseInventory(data, ingredientsById), /not a valid inventory/);
});

test("negative amounts are rejected", () => {
  const data = { schemaVersion: 1, kind: "inventory", name: "Pantry", items: { onion: -1 } };
  assert.throws(() => parseInventory(data, ingredientsById), /Invalid amount/);
});

test("an export contains the trimmed name and the items sorted by id", () => {
  const file = buildInventoryFile("  Pantry  ", { onion: 3, "olive-oil": 500 });
  assert.deepEqual(file, {
    schemaVersion: 1,
    kind: "inventory",
    name: "Pantry",
    items: { "olive-oil": 500, onion: 3 },
  });
  assert.deepEqual(Object.keys(file.items), ["olive-oil", "onion"]);
});

test("an empty name is replaced by the default name", () => {
  assert.equal(buildInventoryFile("   ", {}).name, "Inventory");
});

test("an exported file can be read again", () => {
  const file = buildInventoryFile("Pantry", { onion: 3 });
  const result = parseInventory(JSON.parse(JSON.stringify(file)), ingredientsById);
  assert.equal(result.name, "Pantry");
  assert.deepEqual(result.inventory, { onion: 3 });
});
