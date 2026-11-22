import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRecipeFile,
  comparableName,
  createUniqueId,
  findIngredientByName,
  readRecipeFile,
  resolveNewIngredients,
  slugify,
  validateRecipeDraft,
} from "../js/core/recipe-editing.js";
import { mergeRecipes } from "../js/core/recipes.js";
import { indexById } from "../js/core/utils.js";

const ingredients = [{ id: "onion", name: "Onion", unit: "piece" }];
const ingredientsById = indexById(ingredients);

/** @type {import("../js/core/recipe-editing.js").RecipeDraft} */
const draft = {
  id: "red-pesto",
  name: "Red Pesto",
  type: "spread",
  servings: 8,
  ingredients: [{ ingredientId: "onion", amount: 1 }],
  steps: ["Blend."],
};

test("slugify makes kebab-case ids and removes accents", () => {
  assert.equal(slugify("Red Pesto"), "red-pesto");
  assert.equal(slugify("  Crème brûlée!! "), "creme-brulee");
});

test("createUniqueId adds a counter when the id is taken", () => {
  assert.equal(createUniqueId("Red Pesto", new Set(["red-pesto"])), "red-pesto-2");
  assert.equal(createUniqueId("Red Pesto", new Set(["red-pesto", "red-pesto-2"])), "red-pesto-3");
  assert.equal(createUniqueId("!!!", new Set()), "recipe");
});

test("comparable names ignore case and all spaces", () => {
  assert.equal(comparableName(" Bread"), "bread");
  assert.equal(comparableName("Br ead"), "bread");
  assert.equal(comparableName("Bread "), "bread");
  assert.equal(comparableName("Red  Pesto"), comparableName("redpesto"));
});

test("an ingredient is found by name despite case, spaces and typing mistakes of this kind", () => {
  assert.equal(findIngredientByName(ingredients, "  onion ")?.id, "onion");
  assert.equal(findIngredientByName(ingredients, "O n ion")?.id, "onion");
  assert.equal(findIngredientByName(ingredients, "ONION"), ingredients[0]);
  assert.equal(findIngredientByName(ingredients, "Leek"), undefined);
  assert.equal(findIngredientByName(ingredients, "  "), undefined);
});

test("a complete draft is valid", () => {
  assert.deepEqual(validateRecipeDraft(draft, ingredientsById, null), []);
});

test("a draft without name is rejected", () => {
  const errors = validateRecipeDraft({ ...draft, name: "  " }, ingredientsById, null);
  assert.match(errors.join(" "), /needs a name/);
});

test("an unknown ingredient id is reported", () => {
  const errors = validateRecipeDraft(
    { ...draft, ingredients: [{ ingredientId: "leek", amount: 1 }] },
    ingredientsById,
    null,
  );
  assert.match(errors.join(" "), /Unknown ingredient "leek"/);
});

test("an ingredient row without a name is reported", () => {
  const errors = validateRecipeDraft(
    { ...draft, ingredients: [{ ingredientId: "", amount: 1 }] },
    ingredientsById,
    null,
  );
  assert.match(errors.join(" "), /Every ingredient row needs an ingredient name/);
});

test("a new ingredient is valid when it has a unit", () => {
  const errors = validateRecipeDraft(
    { ...draft, ingredients: [{ ingredientId: "", amount: 2, newIngredient: { name: "Basil", unit: "g" } }] },
    ingredientsById,
    null,
  );
  assert.deepEqual(errors, []);
});

test("a new ingredient without a unit is rejected without an example in the message", () => {
  const errors = validateRecipeDraft(
    { ...draft, ingredients: [{ ingredientId: "", amount: 2, newIngredient: { name: "Basil", unit: " " } }] },
    ingredientsById,
    null,
  );
  assert.match(errors.join(" "), /"Basil" needs a unit\./);
  assert.doesNotMatch(errors.join(" "), /for example/);
});

test("new rows with the same name and different units are rejected", () => {
  const errors = validateRecipeDraft(
    {
      ...draft,
      ingredients: [
        { ingredientId: "", amount: 2, newIngredient: { name: "Basil", unit: "g" } },
        { ingredientId: "", amount: 1, newIngredient: { name: "basil", unit: "bunch" } },
      ],
    },
    ingredientsById,
    null,
  );
  assert.match(errors.join(" "), /two different units/);
});

test("an amount of 0 is rejected", () => {
  const errors = validateRecipeDraft(
    { ...draft, ingredients: [{ ingredientId: "onion", amount: 0 }] },
    ingredientsById,
    null,
  );
  assert.match(errors.join(" "), /amount greater than 0/);
});

test("servings below 1 are rejected", () => {
  const errors = validateRecipeDraft({ ...draft, servings: 0 }, ingredientsById, null);
  assert.match(errors.join(" "), /Servings/);
});

test("a portion weight of 0 is rejected", () => {
  const errors = validateRecipeDraft({ ...draft, portionWeight: 0 }, ingredientsById, null);
  assert.match(errors.join(" "), /Portion weight/);
});

test("steps that are empty do not count", () => {
  const errors = validateRecipeDraft({ ...draft, steps: ["   "] }, ingredientsById, null);
  assert.match(errors.join(" "), /working step/);
});

test("a new recipe must not use an existing id", () => {
  const errors = validateRecipeDraft(draft, ingredientsById, new Set(["red-pesto"]));
  assert.match(errors.join(" "), /already exists/);
});

test("an invalid id is rejected", () => {
  const errors = validateRecipeDraft({ ...draft, id: "Red Pesto" }, ingredientsById, null);
  assert.match(errors.join(" "), /lowercase letters/);
});

test("new ingredients are created with ids, and rows with the same name share one", () => {
  const existing = [{ id: "basil", name: "Sweet basil", unit: "g" }];
  const result = resolveNewIngredients(
    {
      ...draft,
      ingredients: [
        { ingredientId: "onion", amount: 1 },
        { ingredientId: "", amount: 5, newIngredient: { name: "Basil", unit: "g" } },
        { ingredientId: "", amount: 3, newIngredient: { name: "basil", unit: "g" } },
      ],
    },
    existing,
  );
  assert.deepEqual(result.created, [{ id: "basil-2", name: "Basil", unit: "g" }]);
  assert.deepEqual(result.draft.ingredients, [
    { ingredientId: "onion", amount: 1 },
    { ingredientId: "basil-2", amount: 5 },
    { ingredientId: "basil-2", amount: 3 },
  ]);
});

test("typing variants of one new name create one ingredient", () => {
  const result = resolveNewIngredients(
    {
      ...draft,
      ingredients: [
        { ingredientId: "", amount: 1, newIngredient: { name: "Sea salt", unit: "g" } },
        { ingredientId: "", amount: 2, newIngredient: { name: "Sea  Salt ", unit: "g" } },
        { ingredientId: "", amount: 3, newIngredient: { name: "Se a salt", unit: "g" } },
      ],
    },
    ingredients,
  );
  assert.equal(result.created.length, 1);
  assert.deepEqual(
    result.draft.ingredients.map((entry) => entry.ingredientId),
    ["sea-salt", "sea-salt", "sea-salt"],
  );
});

test("a recipe without new ingredients creates nothing", () => {
  const result = resolveNewIngredients(draft, ingredients);
  assert.deepEqual(result.created, []);
  assert.deepEqual(result.draft.ingredients, [{ ingredientId: "onion", amount: 1 }]);
});

test("the recipe file of a resolved draft has no new-ingredient fields", () => {
  const resolved = resolveNewIngredients(
    {
      ...draft,
      ingredients: [{ ingredientId: "", amount: 2, newIngredient: { name: "Basil", unit: "g" } }],
    },
    ingredients,
  );
  const file = buildRecipeFile(resolved.draft);
  assert.deepEqual(file.ingredients, [{ ingredientId: "basil", amount: 2 }]);
});

test("the recipe file leaves out an empty portion weight and trims the steps", () => {
  const file = buildRecipeFile({ ...draft, name: " Red Pesto ", steps: ["  Blend.  ", " "] });
  assert.equal(file.name, "Red Pesto");
  assert.deepEqual(file.steps, ["Blend."]);
  assert.equal("portionWeight" in file, false);
  assert.equal(file.schemaVersion, 1);
});

test("a recipe file keeps a portion weight when it is set", () => {
  const file = buildRecipeFile({ ...draft, portionWeight: 400 });
  assert.equal(file.portionWeight, 400);
});

test("an imported recipe file is read and normalized", () => {
  const recipe = readRecipeFile(
    {
      schemaVersion: 1,
      id: "pancakes",
      name: "Pancakes",
      type: "other",
      ingredients: [{ ingredientId: "onion", amount: 2 }],
      steps: ["Fry."],
    },
    ingredientsById,
  );
  assert.equal(recipe.id, "pancakes");
  assert.equal(recipe.servings, 1);
});

test("an imported recipe with an unknown ingredient is rejected with the reason", () => {
  assert.throws(
    () =>
      readRecipeFile(
        {
          schemaVersion: 1,
          id: "soup",
          name: "Soup",
          type: "main",
          ingredients: [{ ingredientId: "leek", amount: 1 }],
          steps: ["Cook."],
        },
        ingredientsById,
      ),
    /Unknown ingredient "leek"/,
  );
});

test("a file without schemaVersion is not a recipe", () => {
  assert.throws(
    () => readRecipeFile({ id: "soup", name: "Soup", type: "main", ingredients: [], steps: [] }, ingredientsById),
    /not a valid recipe/,
  );
});

test("a saved recipe replaces the repository recipe with the same id", () => {
  const repo = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const local = {
    b: { id: "b", name: "B changed" },
    c: { id: "c", name: "C" },
  };
  const merged = mergeRecipes(/** @type {any} */ (repo), /** @type {any} */ (local));
  assert.deepEqual(
    merged.map((recipe) => recipe.name),
    ["A", "B changed", "C"],
  );
});
