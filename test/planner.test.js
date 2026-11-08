import { test } from "node:test";
import assert from "node:assert/strict";
import { encodePlanUrl, parsePlanUrl, resolvePlan } from "../js/core/planner.js";

/** @type {import("../js/core/types.js").Recipe} */
const soup = {
  id: "soup",
  name: "Soup",
  type: "main",
  servings: 4,
  ingredients: [{ ingredientId: "onion", amount: 1 }],
  steps: ["Cook."],
};

/** @type {import("../js/core/types.js").Recipe} */
const pancakes = {
  id: "pancakes",
  name: "Pancakes",
  type: "other",
  ingredients: [{ ingredientId: "flour", amount: 60 }],
  steps: ["Fry."],
};

const recipesById = new Map([
  ["soup", soup],
  ["pancakes", pancakes],
]);

test("empty rows are ignored", () => {
  const { entries, missingIds } = resolvePlan(
    [
      { recipeId: null, date: null, portions: 4 },
      { recipeId: "soup", date: null, portions: 4 },
    ],
    recipesById,
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].recipe, soup);
  assert.deepEqual(missingIds, []);
});

test("the same recipe can be planned several times, also on the same day", () => {
  const rows = [
    { recipeId: "soup", date: "2025-06-14", portions: 4 },
    { recipeId: "soup", date: "2025-06-14", portions: 2 },
  ];
  const { entries } = resolvePlan(rows, recipesById);
  assert.deepEqual(entries.map((entry) => entry.portions), [4, 2]);
});

test("unknown recipe ids are reported instead of failing", () => {
  const { entries, missingIds } = resolvePlan(
    [{ recipeId: "removed-recipe", date: null, portions: 2 }],
    recipesById,
  );
  assert.deepEqual(entries, []);
  assert.deepEqual(missingIds, ["removed-recipe"]);
});

test("portions must be a whole number of at least 1", () => {
  for (const portions of [0, 1.5, Number.NaN]) {
    assert.throws(
      () => resolvePlan([{ recipeId: "soup", date: null, portions }], recipesById),
      /whole number of at least 1/,
    );
  }
});

test("the plan is encoded without empty rows", () => {
  const query = encodePlanUrl({
    people: 6,
    rows: [
      { recipeId: null, date: null, portions: 6 },
      { recipeId: "soup", date: "2025-06-14", portions: 6 },
      { recipeId: "pancakes", date: null, portions: 2 },
    ],
  });
  assert.equal(query, "?p=6&r=soup:6@2025-06-14,pancakes:2");
});

test("a plan without recipes contains only the people", () => {
  assert.equal(encodePlanUrl({ people: 3, rows: [] }), "?p=3");
});

test("the event name is encoded and omitted when empty", () => {
  const rows = [{ recipeId: "soup", date: null, portions: 6 }];
  assert.equal(
    encodePlanUrl({ people: 6, eventName: "Nebu 2027", rows }),
    "?p=6&e=Nebu%202027&r=soup:6",
  );
  assert.equal(encodePlanUrl({ people: 6, eventName: "  ", rows }), "?p=6&r=soup:6");
});

test("parsing reverses encoding", () => {
  const rows = [
    { recipeId: "soup", date: "2025-06-14", portions: 6 },
    { recipeId: "pancakes", date: null, portions: 2 },
  ];
  const parsed = parsePlanUrl(
    encodePlanUrl({ people: 6, eventName: "Nebu 2027", rows }),
    recipesById,
  );
  assert.equal(parsed.people, 6);
  assert.equal(parsed.eventName, "Nebu 2027");
  assert.deepEqual(parsed.rows, rows);
  assert.deepEqual(parsed.missingIds, []);
  assert.deepEqual(parsed.warnings, []);
});

test("unknown recipe ids in the URL are reported as missing", () => {
  const parsed = parsePlanUrl("?p=2&r=removed-recipe:2,soup:2", recipesById);
  assert.deepEqual(parsed.missingIds, ["removed-recipe"]);
  assert.equal(parsed.rows.length, 1);
});

test("invalid entries and people values are skipped with a warning", () => {
  const parsed = parsePlanUrl("?p=abc&r=soup,soup:0,pancakes:2", recipesById);
  assert.equal(parsed.people, null);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.warnings.length, 2);
});
