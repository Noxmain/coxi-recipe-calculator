import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleFactorForChange } from "../js/core/recipe-editing.js";

test("changing only the servings scales by the ratio of the servings", () => {
  const factor = scaleFactorForChange({ servings: 4, portionWeight: 400 }, { servings: 8, portionWeight: 400 });
  assert.equal(factor, 2);
});

test("changing only the portion weight scales by the ratio of the weights", () => {
  const factor = scaleFactorForChange({ servings: 4, portionWeight: 400 }, { servings: 4, portionWeight: 200 });
  assert.equal(factor, 0.5);
});

test("changing both scales by the change of the total food", () => {
  // 4 × 400 g becomes 8 × 200 g: the same amount of food, so the amounts stay.
  const factor = scaleFactorForChange({ servings: 4, portionWeight: 400 }, { servings: 8, portionWeight: 200 });
  assert.equal(factor, 1);
});

test("without a portion weight only the servings count", () => {
  const factor = scaleFactorForChange({ servings: 4 }, { servings: 2, portionWeight: 300 });
  assert.equal(factor, 0.5);
});
