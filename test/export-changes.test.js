import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChangeFiles } from "../js/core/export-changes.js";

const empty = { localRecipes: {}, localIngredients: {}, ingredients: [], inventory: null };

test("without local changes there are no files", () => {
  assert.deepEqual(buildChangeFiles(empty), []);
});

test("each local recipe becomes a file named after its id", () => {
  const recipe = { schemaVersion: 1, id: "pesto", name: "Pesto" };
  const files = buildChangeFiles({ ...empty, localRecipes: { pesto: recipe } });
  assert.deepEqual(files, [{ fileName: "pesto.json", content: recipe }]);
});

test("the complete ingredient list is exported only when there are local ingredients", () => {
  const ingredients = [{ id: "basil", name: "Basil", unit: "g" }];
  assert.deepEqual(buildChangeFiles({ ...empty, ingredients }), []);

  const files = buildChangeFiles({
    ...empty,
    localIngredients: { basil: ingredients[0] },
    ingredients,
  });
  assert.deepEqual(files, [
    { fileName: "ingredients.json", content: { schemaVersion: 1, ingredients } },
  ]);
});

test("the inventory gets a file named after its name", () => {
  const files = buildChangeFiles({
    ...empty,
    inventory: { name: "Pantry May", inventory: { basil: 20 } },
  });
  assert.equal(files[0].fileName, "inventory-pantry-may.json");
  assert.deepEqual(files[0].content, {
    schemaVersion: 1,
    kind: "inventory",
    name: "Pantry May",
    items: { basil: 20 },
  });
});
