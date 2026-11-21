# Coxi Recipe Calculator

A static web app for planning cooking for groups. You enter the number of people, choose recipes for main dishes, spreads and other dishes, and the app calculates the needed amounts, subtracts what is already in stock, creates printable A4 PDFs (recipes, sorting list, ingredient labels, shopping list) and estimates the costs.

The app runs completely in the browser. There is no server and no account. Your planning data stays in the local storage of your browser unless you export it. The app can be installed on a phone and works offline after the first visit.

> **Developed with AI.** This project was written by Claude (Anthropic), an AI assistant, following prompts from the maintainer, who defined the requirements, tested the app and made the design decisions. Commits that contain AI-written code carry a `Co-authored-by: Claude` trailer.

The app is published with GitHub Pages at [https://noxmain.github.io/coxi-recipe-calculator](https://noxmain.github.io/coxi-recipe-calculator/).

## Documentation

- [User guide](docs/USER_GUIDE.md): how to use the app, how to change and upload recipes
- [Technical documentation](docs/TECH_DOCS.md): how the code works, for developers
- [LLM context](docs/LLM_CONTEXT.md): project context for LLMs that change the code

## Repository overview

```
.github/workflows/validate.yaml   GitHub Action: tests, data check, recipe index update
css/style.css                     General look of the site (colors, font, base elements)
css/app.css                       Layout and adjustments for the pages of this app
docs/                             The documentation of the project
fonts/                            Bricolage Grotesque, shipped for offline use
icons/                            App icon (SVG), iOS icon (PNG) and the icon sprite used by all pages
ingredients/                      Ingredient data (ingredients.json) and the ingredients page
inventory/                        Example inventory and the inventory page
js/core/                          Calculation and rules, no DOM access
js/pages/                         One entry point per page
js/pdf/                           PDF definitions for pdfMake
js/ui/                            Reusable interface parts
recipes/                          One JSON file per recipe, index.json, and the recipes page
schemas/                          JSON Schemas for the data files
scripts/                          Data check and recipe index generator (Node.js)
test/                             Automated tests (Node test runner)
vendor/                           pdfMake and qrcode-generator, shipped without a build step
index.html                        Main page
manifest.webmanifest              Web app manifest
sw.js                             Service worker (offline use)
```

## Running locally

Plain files are served by any static web server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Tests and the data check need Node.js 22 and the development dependencies:

```bash
npm ci               # install development dependencies
npm test             # execute all automated tests
npm run validate     # checks the data files against the schemas
npm run build-index  # rewrites recipes/index.json from the recipe files
```

## Contributing recipes and ingredients

Recipes and ingredients are added by pull request. The steps are described in the [user guide](docs/USER_GUIDE.md#changing-and-uploading-recipes).
