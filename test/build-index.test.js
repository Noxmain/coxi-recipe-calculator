import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRecipeIndex } from "../scripts/build-index.js";

test("the index lists every recipe file except index.json, sorted by id", () => {
  const dir = mkdtempSync(join(tmpdir(), "coxi-recipes-"));
  try {
    for (const name of ["pancakes.json", "chili.json", "index.json", "notes.txt"]) {
      writeFileSync(join(dir, name), "{}");
    }
    assert.deepEqual(buildRecipeIndex(dir), { schemaVersion: 1, recipes: ["chili", "pancakes"] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the committed index matches the recipe files", () => {
  const dir = fileURLToPath(new URL("../recipes", import.meta.url));
  const committed = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  assert.deepEqual(buildRecipeIndex(dir), committed);
});
