import { test } from "node:test";
import assert from "node:assert/strict";
import { comparableName, existingSpelling } from "../js/core/utils.js";
import {
  groupByCategory,
  hasIngredientName,
  validateIngredientDraft,
} from "../js/core/ingredient-editing.js";
import { comparableName as comparableNameFromRecipes } from "../js/core/recipe-editing.js";

const bread = { id: "bread", name: "Bread", unit: "piece" };
const whiteBread = { id: "white-bread", name: "White bread", unit: "g" };

/** @type {import("../js/core/ingredient-editing.js").IngredientDraft} */
const draft = {
  id: "bread",
  name: "Bread",
  unit: "piece",
  category: "",
  packageSize: undefined,
  packagePrice: undefined,
  whereToBuy: "",
};

test("comparable names ignore case and all spaces", () => {
  assert.equal(comparableName(" Bread"), "bread");
  assert.equal(comparableName("Br ead"), "bread");
  assert.equal(comparableName("Bread "), "bread");
  assert.equal(comparableName("White  Bread"), "whitebread");
});

test("the recipe module uses the same comparison function", () => {
  assert.equal(comparableNameFromRecipes, comparableName);
});

test("an existing spelling is reused for a value that differs only in case or spaces", () => {
  assert.equal(existingSpelling(" chick  peas ", ["Chickpeas", "Rye"]), "Chickpeas");
  assert.equal(existingSpelling("Supermarket", ["Weekly market"]), "Supermarket");
  assert.equal(existingSpelling("   ", ["Weekly market"]), "");
});

test("an ingredient name that matches another ingredient is refused", () => {
  const errors = validateIngredientDraft({ ...draft, id: "bread-2", name: " br ead " }, new Set(["bread"]), [
    bread,
  ]);
  assert.match(errors.join(" "), /already exists/);
});

test("an ingredient keeps its own name when it is saved again", () => {
  const errors = validateIngredientDraft(draft, null, [bread]);
  assert.deepEqual(errors, []);
});

test("a different name is accepted", () => {
  const errors = validateIngredientDraft({ ...draft, id: "rye", name: "Rye" }, new Set(["bread"]), [
    bread,
    whiteBread,
  ]);
  assert.deepEqual(errors, []);
});

test("categories that differ only in case or spaces form one group", () => {
  const groups = groupByCategory(
    /** @type {any} */ ([
      { id: "a", name: "A", unit: "g", category: "Vegetables" },
      { id: "b", name: "B", unit: "g", category: "vegetables " },
      { id: "c", name: "C", unit: "g" },
    ]),
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0].ingredients.length, 2);
  assert.equal(groups[1].title, "Uncategorized");
});

test("the inventory check finds names with typing variants", () => {
  assert.equal(hasIngredientName([bread], "B r e a d "), true);
  assert.equal(hasIngredientName([bread], "Rye"), false);
});
