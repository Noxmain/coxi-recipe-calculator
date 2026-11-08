import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectDataErrors } from "../scripts/validate-data.js";

const realDataDir = fileURLToPath(new URL("../data", import.meta.url));

/**
 * Copies the real data, applies a change to the copy and runs the check on it.
 * @param {(dir: string) => void} change
 * @returns {string[]}
 */
function checkAfterChange(change) {
  const dir = mkdtempSync(join(tmpdir(), "coxi-data-"));
  try {
    cpSync(realDataDir, dir, { recursive: true });
    change(dir);
    return collectDataErrors({ dataDir: dir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Changes one JSON file inside the temporary copy.
 * @param {string} dir
 * @param {string} file Path relative to the data folder.
 * @param {(data: any) => void} edit
 */
function editJson(dir, file, edit) {
  const path = join(dir, file);
  const data = JSON.parse(readFileSync(path, "utf8"));
  edit(data);
  writeFileSync(path, JSON.stringify(data, null, 2));
}

test("the real data passes the validation script", () => {
  assert.deepEqual(checkAfterChange(() => {}), []);
});

test("a misspelled property in an ingredient is reported", () => {
  const errors = checkAfterChange((dir) =>
    editJson(dir, "ingredients.json", (data) => {
      data.ingredients[0].packageSzie = 500;
    }),
  );
  assert.ok(errors.some((error) => error.startsWith("ingredients.json")), errors.join("\n"));
});

test("a recipe with an unknown ingredient is reported", () => {
  const errors = checkAfterChange((dir) =>
    editJson(dir, "recipes/chili-sin-carne.json", (data) => {
      data.ingredients.push({ ingredientId: "leek", amount: 1 });
    }),
  );
  assert.ok(errors.some((error) => /unknown ingredient "leek"/.test(error)), errors.join("\n"));
});

test("a recipe missing in index.json is reported", () => {
  const errors = checkAfterChange((dir) =>
    editJson(dir, "recipes/index.json", (data) => {
      data.recipes = data.recipes.filter((id) => id !== "pancakes");
    }),
  );
  assert.ok(errors.some((error) => /missing in index.json/.test(error)), errors.join("\n"));
});
