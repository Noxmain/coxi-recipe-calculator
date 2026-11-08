# Coxi Recipe Calculator: Project Specification

---

## 1. Purpose

The Coxi Recipe Calculator is a static web app that plans cooking for a group of people. Given a number of people and a set of selected recipes, it:

- scales all ingredient amounts linearly,
- calculates how much of each ingredient is needed,
- subtracts what is already in stock,
- calculates packages to buy and prices,
- groups the shopping list by shop and category,
- produces printable A4 PDFs (recipes, ingredient lists by type, ingredient labels, shopping list).

It replaces an earlier Excel spreadsheet that became too complicated and error-prone.

---

## 2. Technical Constraints

| Topic                    | Decision                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting                  | GitHub Pages, static files only. No backend, no server-side storage.                                                                                                        |
| Language                 | Plain JavaScript (ES modules). **No TypeScript, no build step.**                                                                                                            |
| Type safety              | JSDoc type annotations and `// @ts-check` at the top of each file.                                                                                                          |
| Dependencies in the site | None at runtime, except **pdfmake** (with the Roboto font) which is shipped inside the repository so it works offline.                                                      |
| Dev dependencies         | `ajv` (JSON Schema validation, used only in tests and in the validation script).                                                                                            |
| Test runner              | Node's built-in test runner: `node --test`, run via `npm test`.                                                                                                             |
| Platforms                | Must work well on desktop and on mobile (responsive layout).                                                                                                                |
| Offline                  | Progressive Web App: manifest and service worker, so the app works without internet.                                                                                        |
| Language of content      | **Everything** is in English: UI texts, ingredient and recipe names, cooking steps, PDF texts, code comments, error messages.                                               |
| Privacy                  | Calculation data (people, selected recipes, inventory, dates) is processed only locally in the browser. Only the public recipe and ingredient data lives in the repository. |

---

## 3. Repository Structure

```
package.json
package-lock.json
data/
  ingredients.json            All ingredients (one file)
  inventory.example.json      Example inventory export
  recipes/
    index.json                List of all recipe ids (required, because a static site cannot list folders)
    <recipe-id>.json          One file per recipe, file name equals the recipe id
schemas/
  ingredients.schema.json
  recipe.schema.json
  inventory.schema.json
js/core/
  types.js                    JSDoc typedefs only
  utils.js                    Lookup, sorting and type helpers
  recipes.js                  Scaling, needed amounts, portion change, recipe resolution, names by type
  shopping.js                 Shopping items, price summary, grouping by shop
  inventory.js                Parsing and validating inventory files
  validation.js               Consistency checks between data files
scripts/
  validate-data.js            CLI: schema check and consistency check of data/
test/
  recipes.test.js
  shopping.test.js
  inventory.test.js
  validation.test.js
  example-data.test.js        Checks example data and the control calculation
  schema.test.js              Checks example data is valid and bad examples are rejected
  validate-script.test.js     Checks the validation script on modified copies of the data
.github/workflows/
  validate.yml                GitHub Action
```

UI files (HTML, CSS, page scripts, PDF code, service worker, manifest) are not yet written. Their location is **OPEN**, but they must not depend on a build step.

---

## 4. Data Model

### 4.1 General rules

- Every file has `"schemaVersion": 1`.
- All IDs (ingredients, recipes) are **stable**, lowercase kebab-case, and match the pattern `^[a-z0-9]+(-[a-z0-9]+)*$`. An ID is never changed after release, even if the name changes.
- The recipe file name equals the recipe `id` plus `.json`.
- Units are **free text**. There is no enum in the schema or in the code. Examples: `g`, `kg`, `l`, `ml`, `piece`, `can`, `clove`, `bulb`.
- **No unit conversion** exists anywhere in the system. Each ingredient has exactly one unit, used consistently in recipes, inventory, shopping list and price. A garlic clove and a garlic bulb are different ingredients or the same ingredient in clove units, never converted.
- There is **no allergen field**. Labels list all ingredients; allergens are highlighted by hand after printing.
- Recipe amounts are **never rounded** in the data or in the calculation.

### 4.2 Ingredient (`data/ingredients.json`)

```json
{
  "schemaVersion": 1,
  "ingredients": [
    { "id": "garlic", "name": "Garlic", "unit": "clove", "category": "Vegetables", "packageSize": 10, "packagePrice": 0.45, "whereToBuy": "Weekly market" }
  ]
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `id` | yes | string, kebab-case | Stable identifier |
| `name` | yes | non-empty string | Display name |
| `unit` | yes | non-empty string | Unit of all amounts for this ingredient |
| `category` | no | non-empty string | Free text, e.g. "Vegetables", used for sorting the shopping list |
| `packageSize` | no | number > 0 | Content of one package, in `unit` |
| `packagePrice` | no | number ≥ 0 | Price of one package |
| `whereToBuy` | no | non-empty string | The one shop where this ingredient is bought |

Rules:
- `packageSize` and `packagePrice` must be given together (JSON Schema `dependentRequired`).
- Ingredients without price data, shop or category are valid. The calculation and the PDFs must still work. The UI shows "No price", "No shop set" or "Uncategorized".
- The file is not required to be sorted, but may be.
- No ingredient may have a `null` or `0` placeholder for a missing price. Missing means the field is absent.

### 4.3 Recipe (`data/recipes/<id>.json`)

```json
{
  "schemaVersion": 1,
  "id": "chili-sin-carne",
  "name": "Chili Sin Carne",
  "type": "main",
  "servings": 4,
  "portionWeight": 400,
  "ingredients": [
    { "ingredientId": "onion", "amount": 2 }
  ],
  "steps": ["Dice the onion.", "Sauté it in oil."]
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `schemaVersion` | yes | `1` | |
| `id` | yes | kebab-case | Equals file name |
| `name` | yes | non-empty string | |
| `type` | yes | `"main"`, `"spread"` or `"other"` | Grouping for ingredient list and PDFs |
| `servings` | no | integer ≥ 1 | Number of people the amounts are written for. **Default: 1** |
| `portionWeight` | no | number > 0 | Weight of one finished portion in g. Display only, except when used for a portion change |
| `ingredients` | yes | array, at least 1 entry | Each entry: `ingredientId` (string) and `amount` (number > 0) |
| `steps` | yes | array of non-empty strings, at least 1 | Cooking steps |

Type meanings:
- `main`: main meals (earlier called "dish").
- `spread`: spreads, e.g. pesto (earlier called "brunch").
- `other`: everything else, e.g. pancakes, cakes.

Recipes in the repository are added or changed by pull request. The app itself does not write files into the repository.

### 4.4 Recipe index (`data/recipes/index.json`)

```json
{ "schemaVersion": 1, "recipes": ["chili-sin-carne", "pancakes", "red-pesto"] }
```

Lists every recipe id once. The validation requires that the list matches the recipe files exactly.

### 4.5 Inventory (export/import file)

```json
{
  "schemaVersion": 1,
  "kind": "inventory",
  "items": {
    "olive-oil": 500,
    "onion": 3
  }
}
```

- `kind` must be `"inventory"`, so a file can be recognized on import.
- `items` maps ingredient id to amount.
- **Amounts are always in the unit of the ingredient** (from `ingredients.json`), never in packages. There is no unit field in the inventory file.
- Ingredient ids that do not exist are skipped on import with a warning.
- Amount must be a number ≥ 0.

### 4.6 Example data (must stay consistent)

- `ingredients.json`: 16 ingredients, all vegan. Includes `water` without price and without shop, and `lemon` with price but without shop, to test the "missing data" paths. Includes `chickpeas-dried`, which is in stock in the example inventory but not used by any recipe, to test that unused stock is ignored.
- Recipes: `chili-sin-carne` (main, 4 servings, 400 g portion), `red-pesto` (spread, 8 servings, no portion weight), `pancakes` (other, no servings, so 1 person, no portion weight).
- `inventory.example.json`: chickpeas (10000 g), olive oil (500 ml), red kidney beans (2 cans), onion (3 pieces).
- All example data is vegan and in English.

---

## 5. Calculation Logic

All of this lives in `js/core/` as pure functions without DOM access.

### 5.1 Scaling

- `getServings(recipe)` returns `recipe.servings ?? 1`.
- `getScaleFactor(recipe, people) = people / servings`.
- All amounts scale linearly. No other formula exists.

### 5.2 Needed amounts

For every ingredient `i`, with the selected recipes `R` and `P` people:

```
needed[i] = Σ over R of ( amount[i] × P / servings(R) )
```

- The result is not rounded.
- Ingredients that appear in several recipes are added up.

### 5.3 Shopping items

For each needed ingredient:

```
inStock = inventory[i] or 0
toBuy   = max(0, needed − inStock)
```

If the ingredient has price data (`packageSize` and `packagePrice` both present):

```
packageCount = ceil(toBuy / packageSize − 1e-9)   (0 if toBuy is 0)
usedValue    = needed / packageSize × packagePrice          (value of what the recipes use, no package rounding)
purchaseCost = packageCount × packagePrice                  (what is paid at the checkout)
```

If price data is missing: `packageCount`, `usedValue` and `purchaseCost` are `null`. The item stays in the list.

The tolerance `1e-9` prevents floating point noise, e.g. `500.0000000001` g, from requiring an extra package.

Inventory entries for ingredients that are not needed by the selected recipes do **not** appear in the shopping list and do not affect the price.

### 5.4 Price summary

- `absoluteTotal` = sum of `usedValue` over items with price data. This is the value of the food actually used. A partly used package counts only with its used share.
- `purchaseTotal` = sum of `purchaseCost` over items with price data. This is the amount to pay at the checkout. Partly used packages count as whole packages.
- `absolutePerPerson = absoluteTotal / P`, `purchasePerPerson = purchaseTotal / P`.
- `pricedCount` = number of items with price data, `itemCount` = number of all needed items.
- The UI must show coverage, e.g.: "Price known for 9 of 10 ingredients (90 %)". If coverage is not complete, the totals are lower bounds and this must be visible.

### 5.5 Grouping for the shopping list

- Grouped by `whereToBuy`. Groups are sorted alphabetically, the group without a shop comes last and is labeled "No shop set".
- Within each group, items are sorted by `category` (alphabetically, no category last, labeled "Uncategorized"), then by `name`.
- All sorting uses locale-aware comparison with `"en"`.

### 5.6 Ingredient names by recipe type

- For the selected recipes, collect ingredient names per `type` (`main`, `spread`, `other`).
- Names are sorted alphabetically and deduplicated per type.
- An ingredient used in several types appears in each of them.
- No amounts are included.

### 5.7 Portion change (recipe editing)

- `changePortionWeight(recipe, newPortionWeight, scaleIngredients)` returns a new recipe object; the input is not modified.
- Without scaling: only `portionWeight` changes; amounts stay.
- With scaling: `factor = newPortionWeight / oldPortionWeight`; every `amount` is multiplied by `factor`.
- Scaling requires an existing `portionWeight`; otherwise an error is thrown.
- `newPortionWeight` must be > 0.
- This is a feature of the recipe editor (see 7.4). The UI provides a checkbox "scale ingredients".

### 5.8 Recipe resolution

- `resolveRecipes(ids, recipesById)` removes duplicate ids and returns `{ recipes, missingIds }`.
- Ids without a matching recipe (e.g. from an old link) are reported in `missingIds`. The app must not crash; it shows a notice.

### 5.9 Control example

Selection: `chili-sin-carne`, 6 people, empty inventory. Factor 1.5.

| Ingredient | Needed | Packages | usedValue | purchaseCost |
|---|---|---|---|---|
| Textured soy granules | 180 g | 1 × 500 g | 1.08 € | 2.99 € |
| Vegetable stock powder | 30 g | 1 × 1000 g | 0.14 € | 4.50 € |
| Onion | 3 pieces | 3 × 1 | 1.05 € | 1.05 € |
| Garlic | 3 cloves | 1 × 10 cloves | 0.135 € | 0.45 € |
| Olive oil | 45 ml | 1 × 1000 ml | 0.31 € | 6.90 € |
| Red kidney beans | 3 cans | 3 × 1 | 2.67 € | 2.67 € |
| Chopped tomatoes | 3 cans | 3 × 1 | 2.37 € | 2.37 € |
| Chili powder | 12 g | 1 × 50 g | 0.33 € | 1.39 € |
| Salt | 7.5 g | 1 × 1000 g | 0.0045 € | 0.60 € |
| Water | 1500 ml | no price | – | – |

- `absoluteTotal` = 8.085 € (display 8.09 €), `absolutePerPerson` = 1.3475 €
- `purchaseTotal` = 22.92 €, `purchasePerPerson` = 3.82 €
- `pricedCount` = 9, `itemCount` = 10

These values are checked by `example-data.test.js`. The display rounds only at the last step.

---

## 6. Inventory Handling

- The **main page** only loads an inventory file (import). It does not create or edit inventory.
- The **inventory subpage** creates and edits inventory and exports/imports the JSON file. Its exact UX is **OPEN**, but it must be simple and have a good GUI.
- Import flow: parse JSON, check `kind` and `schemaVersion`, check amounts, skip unknown ids with a warning, show all warnings to the user.
- Amounts are shown with the unit of the ingredient from `ingredients.json`.
- A unit change of an ingredient does not convert old inventory values. This is accepted.

---

## 7. User Interface

### 7.1 Main page (planning and results)

Order from top to bottom:

1. Heading "Coxi Recipe Calculator".
2. Input for the number of people.
3. Recipe selection (list of all recipes from `index.json`, grouped or filtered by type; exact control is **OPEN**). Each selected recipe can get an optional **date**. The date is part of the selection state, not of the recipe data.
4. Inventory: load an inventory JSON file (no editing here).
5. One large **"Calculate"** button.
6. Results (shown after calculation):
   - Recipe PDF download (one A4 page per recipe).
   - Ingredient list by type PDF (names only, grouped main / spread / other).
   - Ingredient labels PDF (one label per recipe, names only).
   - Shopping section:
     - Shopping list, grouped by shop, sorted by category and name, with columns Ingredient, Needed, In stock, To buy, Packages, checkbox. Items without price data show "No price". Items without shop are in "No shop set".
     - Shopping list PDF download.
     - Price estimate: absolute total, absolute per person, purchase total, purchase per person, plus price coverage.
   - Notices for missing recipe ids from the URL and for unknown ids from the inventory.

### 7.2 Selection in the URL

- The selection without inventory can be shared as URL or QR code.
- Proposed format: `?p=6&r=chili-sin-carne@2025-06-14,pancakes`. Here `p` is the number of people, `r` is a comma-separated list of recipe ids, optionally with `@date`. **OPEN**: final format is decided together with the UI.
- The inventory is never part of the URL. It is shared only as JSON file.

### 7.3 Inventory subpage

- Creates and edits inventory for all ingredients.
- Export as JSON file (`kind: "inventory"`).
- Import of an existing inventory file to continue editing.
- Good, simple GUI (exact design **OPEN**).

### 7.4 Recipes subpage

- Browse all recipes and download any recipe as PDF.
- Edit an existing recipe, including the portion weight with the checkbox "scale ingredients".
- Create a new recipe.
- Editing and creating produce a JSON file for the user. Because a static site cannot write into the repository, the user adds the file to the repository via pull request.
- Contains a short instruction on how to contribute recipes via pull request.

### 7.5 Documentation (in the repository)

- A short, understandable user guide for the app.
- A separate technical documentation for developers and bug fixing (this specification can serve as the basis).

### 7.6 Responsiveness and PWA

- The layout works on desktop and on mobile.
- A web app manifest and a service worker cache the app shell and all files under `data/`.
- When data changes, the cache version must be increased. A reminder for this is planned in the validation action; it is not implemented yet.

---

## 8. PDF Generation

- Library: **pdfmake**, shipped in the repository together with the **Roboto** font, so the output is identical on all devices and works offline. Standard fonts are not used because they cannot display umlauts or `€`.
- Page format: **A4**.
- All layout is declared in code as document definitions. No HTML printing.
- Checkboxes in the shopping PDF are drawn as small rectangles, not as the character ☐.

### 8.1 Recipe PDF

- One A4 page per recipe.
- Contains: name, type, servings, portion weight (if given), ingredient list with scaled amounts and units, cooking steps.
- If a recipe is printed for a calculation, amounts are scaled to the selected people. If printed from the recipes subpage, base amounts are used.

### 8.2 Ingredient list PDF (sorting list)

- Names only, no amounts.
- Grouped by type: main, spread, other. Each group lists the names alphabetically.
- Purpose: arrange the ingredients physically in the room, one area for main dishes, one for spreads, one for other.

### 8.3 Ingredient labels PDF

- One label per selected recipe, containing all ingredient names of that recipe, without amounts.
- Labels are placed on A4 portrait paper.
- Default layout: **2 columns × 4 rows** (8 labels per page). Both values are configurable constants or settings, **no absolute label dimensions are stored in the code**.
- No allergen marking. Allergens are highlighted by hand with a highlighter after printing.

### 8.4 Shopping list PDF

- Grouped by shop, like the on-screen list.
- Columns: **Ingredient**, **Needed**, **In stock**, **To buy**, **Packages**, and a checkbox.
- "Packages" is an additional column. It does not replace "To buy".
- Price summary at the end: absolute total, purchase total, per person values, price coverage.

---

## 9. Sharing and Privacy

- Selection (people, recipes, dates) → URL or QR code.
- Inventory → JSON file only (export and import).
- No calculation data is sent anywhere. No analytics, no external calls except loading the static files.
- Public recipe and ingredient data is in the repository and therefore public.

---

## 10. Validation and Tests

### 10.1 Test categories

| File | Covers |
|---|---|
| `recipes.test.js` | Scaling, needed amounts, portion change, resolution of ids, names by type |
| `shopping.test.js` | Stock subtraction, package rounding, float tolerance, prices, summary, grouping and sorting |
| `inventory.test.js` | Valid and invalid inventory files, unknown ids |
| `validation.test.js` | Relation checks (duplicates, unknown references, file names, index) |
| `example-data.test.js` | Example data is consistent; control example from 5.9 |
| `schema.test.js` | Example data is valid against the schemas; each bad example in a table is rejected |
| `validate-script.test.js` | The validation script passes the real data and fails on modified copies |

- Tests use the real example data where possible.
- Tests for the validation script work on temporary copies of `data/`. The real files are never modified.
- Expected failures are written as tables, one case per row, each case containing exactly one error.

### 10.2 Validation script

- `scripts/validate-data.js` exports `collectDataErrors({ dataDir, schemaDir })`.
- It runs only when executed directly (CLI), not when imported by a test.
- Steps:
  1. Check `ingredients.json`, `inventory.example.json` and every recipe file against its JSON Schema (Ajv, Draft 2020-12, `allErrors: true`).
  2. Check the shape of `recipes/index.json`.
  3. If any shape error exists, return immediately.
  4. Run the relation checks from `validation.js`.
- Exit code 1 on errors, with one line per problem.

### 10.3 Commands

```bash
npm test          # all unit and schema tests
npm run validate  # validates data/ against schemas and relations
```

### 10.4 GitHub Action

- File: `.github/workflows/validate.yml`.
- Runs on `pull_request` and on `push` to `main`.
- Steps: checkout, setup Node 22 with npm cache, `npm ci`, `npm test`, `npm run validate`.
- Making the check mandatory for merging is configured in GitHub branch protection (not in code).

---

## 11. Coding Conventions

- Plain ES modules (`import` / `export`), `"type": "module"` in `package.json`.
- `// @ts-check` at the top of every JavaScript file, JSDoc for all exported functions and typedefs (`js/core/types.js`).
- Code must be **clean, readable and simple**. No clever or unnecessary features. Clarity is more important than extra functionality.
- No external runtime libraries except pdfmake.
- Comments and all user-facing texts in **English**.
- Error messages are in English and state what went wrong.
- Business logic lives in `js/core/` and has no DOM dependency, so it can be tested with Node.
- Numbers are not rounded in calculations. Rounding happens only in display (prices to 2 decimals; package counts are integers).
- Missing optional data never causes an exception. It results in `null` values and a visible label in the UI.
- Known exceptions to this rule are invalid input (e.g. a recipe that scales without portion weight, an unknown ingredient id in a recipe), which throw errors.

---

## 12. Expected Scale

- 50 to 100 recipes.
- 100 to 300 ingredients.
- Data is split into one file per recipe so that pull requests stay small and conflict-free.
- The complete data set is loaded by the browser; this is fine at this size.
