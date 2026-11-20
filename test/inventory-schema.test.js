import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(
  readFileSync(new URL("../schemas/inventory.schema.json", import.meta.url), "utf8"),
);
const validate = new Ajv2020({ allErrors: true }).compile(schema);

const base = { schemaVersion: 1, kind: "inventory", items: { onion: 3 } };

test("an inventory with a name is valid", () => {
  assert.equal(validate({ ...base, name: "Pantry" }), true);
});

test("an inventory without a name is rejected", () => {
  assert.equal(validate(base), false);
});

test("an empty name is rejected", () => {
  assert.equal(validate({ ...base, name: "" }), false);
});

test("a name that is not text is rejected", () => {
  assert.equal(validate({ ...base, name: 5 }), false);
});
