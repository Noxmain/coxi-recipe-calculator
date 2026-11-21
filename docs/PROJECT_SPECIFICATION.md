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
| Language                 | Plain JavaScript (ES modules). No TypeScript, no build step.                                                                                                            |
| Type safety              | JSDoc type annotations and `// @ts-check` at the top of each file.                                                                                                          |
| Dependencies in the site | None at runtime, except `pdfmake` (with the Roboto font) which is shipped inside the repository so it works offline.                                                      |
| Dev dependencies         | `ajv` (JSON Schema validation, used only in tests and in the validation script).                                                                                            |
| Test runner              | Node's built-in test runner: `node --test`, run via `npm test`.                                                                                                             |
| Platforms                | Must work well on desktop and on mobile (responsive layout).                                                                                                                |
| Offline                  | Progressive Web App: manifest and service worker, so the app works without internet.                                                                                        |
| Language of content      | Everything is in English: UI texts, ingredient and recipe names, cooking steps, PDF texts, code comments, error messages.                                               |
| Privacy                  | Calculation data (people, selected recipes, inventory, dates) is processed only locally in the browser. Only the public recipe and ingredient data lives in the repository. |

---

## 3. Data Model

### 3.1 General rules

- Every file has `"schemaVersion": 1`.
- All IDs (ingredients, recipes) are stable, lowercase kebab-case, and match the pattern `^[a-z0-9]+(-[a-z0-9]+)*$`. An ID is never changed after release, even if the name changes.
- The recipe file name equals the recipe `id` plus `.json`.
- Units are free text. There is no enum in the schema or in the code. Examples: `g`, `kg`, `l`, `ml`, `piece`, `can`, `clove`, `bulb`.
- No unit conversion exists anywhere in the system. Each ingredient has exactly one unit, used consistently in recipes, inventory, shopping list and price. A garlic clove and a garlic bulb are different ingredients or the same ingredient in clove units, never converted.
- There is no allergen field. Labels list all ingredients; allergens are highlighted by hand after printing.
- Recipe amounts are never rounded in the data or in the calculation.

### 3.2 Ingredient (`data/ingredients.json`)

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

### 3.3 Recipe (`data/recipes/<id>.json`)

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
  "steps": ["Dice the onion.", "Fry it in oil."]
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `schemaVersion` | yes | `1` | |
| `id` | yes | kebab-case | Equals file name |
| `name` | yes | non-empty string | |
| `type` | yes | `"main"`, `"spread"` or `"other"` | Grouping for ingredient list and PDFs |
| `servings` | no | integer ≥ 1 | Number of people the amounts are written for. Default: 1 |
| `portionWeight` | no | number > 0 | Weight of one finished portion in g. Display only, except when used for a portion change |
| `ingredients` | yes | array, at least 1 entry | Each entry: `ingredientId` (string) and `amount` (number > 0) |
| `steps` | yes | array of non-empty strings, at least 1 | Cooking steps |

Type meanings:
- `main`: main meals (earlier called "dish").
- `spread`: spreads, e.g. pesto (earlier called "brunch").
- `other`: everything else, e.g. pancakes, cakes.

Recipes in the repository are added or changed by pull request. The app itself does not write files into the repository.

### 3.4 Recipe index (`data/recipes/index.json`)

```json
{ "schemaVersion": 1, "recipes": ["chili-sin-carne", "pancakes", "red-pesto"] }
```

Lists every recipe id once. The validation requires that the list matches the recipe files exactly.

### 3.5 Inventory (export/import file)

```json
{
  "schemaVersion": 1,
  "kind": "inventory",
  "name": "Inventory August 2026",
  "items": {
    "olive-oil": 500,
    "onion": 3
  }
}
```

- `kind` must be `"inventory"`, so a file can be recognized on import.
- `items` maps ingredient id to amount.
- Amounts are always in the unit of the ingredient (from `ingredients.json`), never in packages. There is no unit field in the inventory file.
- Ingredient ids that do not exist are skipped on import with a warning.
- Amount must be a number ≥ 0.

---

## 4. Calculation Logic

All of this lives in `js/core/` as pure functions without DOM access.

### 4.1 Scaling

- `getServings(recipe)` returns `recipe.servings ?? 1`.
- `getScaleFactor(recipe, people) = people / servings`.
- All amounts scale linearly. No other formula exists.

### 4.2 Needed amounts

For every ingredient `i`, with the selected recipes `R` and `P` people:

```
needed[i] = Σ over R of ( amount[i] × P / servings(R) )
```

- The result is not rounded.
- Ingredients that appear in several recipes are added up.

### 4.3 Shopping items

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

### 4.4 Price summary

- `absoluteTotal` = sum of `usedValue` over items with price data. This is the value of the food actually used. A partly used package counts only with its used share.
- `purchaseTotal` = sum of `purchaseCost` over items with price data. This is the amount to pay at the checkout. Partly used packages count as whole packages.
- `absolutePerPerson = absoluteTotal / P`, `purchasePerPerson = purchaseTotal / P`.
- `pricedCount` = number of items with price data, `itemCount` = number of all needed items.
- The UI must show coverage, e.g.: "Price known for 9 of 10 ingredients (90 %)". If coverage is not complete, the totals are lower bounds and this must be visible.

### 4.5 Grouping for the shopping list

- Grouped by `whereToBuy`. Groups are sorted alphabetically, the group without a shop comes last and is labeled "No shop set".
- Within each group, items are sorted by `category` (alphabetically, no category last, labeled "Uncategorized"), then by `name`.
- All sorting uses locale-aware comparison with `"en"`.

### 4.6 Ingredient names by recipe type

- For the selected recipes, collect ingredient names per `type` (`main`, `spread`, `other`).
- Names are sorted alphabetically and deduplicated per type.
- An ingredient used in several types appears in each of them.
- No amounts are included.

### 4.7 Portion change (recipe editing)

- `changePortionWeight(recipe, newPortionWeight, scaleIngredients)` returns a new recipe object; the input is not modified.
- Without scaling: only `portionWeight` changes; amounts stay.
- With scaling: `factor = newPortionWeight / oldPortionWeight`; every `amount` is multiplied by `factor`.
- Scaling requires an existing `portionWeight`; otherwise an error is thrown.
- `newPortionWeight` must be > 0.
- This is a feature of the recipe editor (see 7.4). The UI provides a checkbox "scale ingredients".

### 4.8 Recipe resolution

- `resolveRecipes(ids, recipesById)` removes duplicate ids and returns `{ recipes, missingIds }`.
- Ids without a matching recipe (e.g. from an old link) are reported in `missingIds`. The app must not crash; it shows a notice.

---

## 5. Inventory Handling

- The main page only loads an inventory file (import). It does not create or edit inventory.
- The inventory subpage creates and edits inventory and exports/imports the JSON file.
- Import flow: parse JSON, check `kind` and `schemaVersion`, check amounts, skip unknown ids with a warning, show all warnings to the user.
- Amounts are shown with the unit of the ingredient from `ingredients.json`.

---

## 6. User Interface

### 6.1 Main page (planning and results)

Order from top to bottom:

1. Heading "Coxi Recipe Calculator".
2. Input for the name of the event.
3. Input for the number of people.
4. Recipe selection (list of all recipes from `index.json`, grouped or filtered by type). Each selected recipe can get an optional date. The date is part of the selection state, not of the recipe data.
5. Inventory: load an inventory JSON file (no editing here).
6. One large "Calculate" button.
7. Results (shown after calculation):
  - Recipe PDF download (one A4 page per recipe).
  - Ingredient list by type PDF (names only, grouped main / spread / other).
  - Ingredient labels PDF (one label per recipe, names only).
  - Shopping list PDF download (grouped by shop, sorted by category and name, with columns Ingredient, Needed, In stock, To buy, Packages, checkbox).
  - Price estimate: absolute total, absolute per person, purchase total, purchase per person.
  - Notices for missing recipe ids from the URL and for unknown ids from the inventory.

### 6.2 Selection in the URL

- The selection without inventory can be shared as URL or QR code.
- Proposed format: `?p=6&r=chili-sin-carne:6@2027-02-27,pancakes:3` (`p` is the number of people, `r` is a comma-separated list of recipe ids with number of portions, optionally with `@date`).
- The inventory is never part of the URL. It is shared only as JSON file.

### 6.3 Inventory subpage

- Creates and edits inventory for all ingredients.
- Export as JSON file (`kind: "inventory"`).
- Import of an existing inventory file to continue editing.

### 6.4 Recipes subpage

- Browse all recipes and download any recipe as PDF.
- Edit an existing recipe, including the portion weight with the checkbox "scale ingredients".
- Create a new recipe.
- Editing and creating produce a JSON file for the user. Because a static site cannot write into the repository, the user adds the file to the repository via pull request.

### 6.5 Responsiveness and PWA

- The layout works on desktop and on mobile.
- A web app manifest and a service worker cache the app shell and all relevant files.
- When data changes, the cache version must be increased.

---

## 7. PDF Generation

- Library: `pdfmake`, shipped in the repository together with the `Roboto` font, so the output is identical on all devices and works offline. Standard fonts are not used because they cannot display umlauts or `€`.
- Page format: DIN A4.
- All layout is declared in code as document definitions. No HTML printing.
- Checkboxes in the shopping PDF are drawn as small rectangles, not as the character ☐.

### 7.1 Recipe PDF

- One A4 page per recipe.
- Contains: name, type, servings, portion weight (if given), ingredient list with scaled amounts and units, cooking steps.
- If a recipe is printed for a calculation, amounts are scaled to the selected people. If printed from the recipes subpage, base amounts are used.

### 7.2 Ingredient list PDF (sorting list)

- Names only, no amounts.
- Grouped by type: main, spread, other. Each group lists the names alphabetically.
- Purpose: arrange the ingredients physically in the room, one area for main dishes, one for spreads, one for other.

### 7.3 Ingredient labels PDF

- One label per selected recipe, containing all ingredient names of that recipe, without amounts.
- Labels are placed on A4 portrait paper.
- Default layout: 2 columns × 4 rows (8 labels per page). Both values are configurable constants or settings.
- No allergen marking. Allergens are highlighted by hand with a highlighter after printing.

### 7.4 Shopping list PDF

- Grouped by shop, like the on-screen list.
- Columns: Ingredient, Needed, In stock, To buy, Packages, and a checkbox.
- "Packages" is an additional column. It does not replace "To buy".
- Price summary at the end: absolute total, purchase total, per person values, price coverage.

---

## 8. Sharing and Privacy

- Selection (people, recipes, dates) → URL or QR code.
- Inventory → JSON file only (export and import).
- No calculation data is sent anywhere. No analytics, no external calls except loading the static files.
- Public recipe and ingredient data is in the repository and therefore public.

---

## 9. Coding Conventions

- Plain ES modules (`import` / `export`), `"type": "module"` in `package.json`.
- `// @ts-check` at the top of every JavaScript file, JSDoc for all exported functions and typedefs (`js/core/types.js`).
- Code must be clean, readable and simple. No clever or unnecessary features. Clarity is more important than extra functionality.
- No external runtime libraries except pdfmake.
- Comments and all user-facing texts in English.
- Error messages are in English and state what went wrong.
- Business logic lives in `js/core/` and has no DOM dependency, so it can be tested with Node.
- Numbers are not rounded in calculations. Rounding happens only in display (prices to 2 decimals; package counts are integers).
- Missing optional data never causes an exception. It results in `null` values and a visible label in the UI.
- Known exceptions to this rule are invalid input (e.g. a recipe that scales without portion weight, an unknown ingredient id in a recipe), which throw errors.

---

## 10. Expected Scale

- 50 to 100 recipes.
- 100 to 300 ingredients.
- Data is split into one file per recipe so that pull requests stay small and conflict-free.
- The complete data set is loaded by the browser; this is fine at this size.
