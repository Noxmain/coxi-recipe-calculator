# Coxi Recipe Calculator: User guide

The Coxi Recipe Calculator helps you plan meals for a group. You choose recipes and the number of people, and the app tells you how much of each ingredient you need, what you already have, what to buy and what it costs. It also prints the documents you need in the kitchen.

> **Developed with AI.** This project was written by Claude (Anthropic), an AI assistant, following prompts from the maintainer, who defined the requirements, tested the app and made the design decisions.

The app is published with GitHub Pages at [https://noxmain.github.io/coxi-recipe-calculator](https://noxmain.github.io/coxi-recipe-calculator/).

## Opening the app

Open the app address in any modern browser, on a computer or a phone.

**Install it on a phone (optional):**
- **iPhone (Safari):** Share button → "Add to Home Screen".
- **Android (Chrome):** Menu (⋮) → "Install app".

After the first visit with internet access, the app also works without internet.

**Important:** Your plan, your inventory and your own changes to recipes and ingredients are stored in the browser on this device only. A home screen app and the normal browser (for example Safari) have separate storage on iPhones. Use the share function (see below) or an exported file to move your data between them.

## The main page

### Event name and number of people

- Type the name of the event at the top. It appears in the titles and file names of the PDFs.
- The number of people is used for the amounts and for the price per person. The default is 100.

### Planning recipes

The recipes are grouped in three sections: **Mains**, **Spreads** and **Others**.

1. Press **+ Add main dish**, **+ Add spread** or **+ Add other**. A new row appears.
2. Click into the recipe field and type a name, or press ▾ to see all recipes of this section. Click a recipe to choose it.
3. Enter the **portions** in the field on the right. When you add the row, the portions are set to the number of people. Choosing a recipe does not change them.
4. Optionally click the **weekday** to set a date.
5. Remove a row with the **×** on the right.

You can plan the same recipe several times, also on the same day, for example with different portions. Empty rows are ignored. A recipe name that is not recognised is shown in red and is ignored.

### Inventory on the main page

- **Load inventory file** loads an inventory file. The status line shows which inventory is in use.
- **Remove inventory** removes the inventory from this browser.
- **Edit inventory** opens the inventory page.

Without an inventory, everything counts as not in stock.

### Calculate

Press **Calculate** when your plan is ready. The button is disabled until at least one recipe is planned. The results appear below the button.

If you change the plan, the number of people or the inventory after calculating, the results disappear. Press Calculate again to see the new results. Changing the event name does not hide the results.

### Results

After calculating, four buttons create PDF files:

| Button | Contents |
|---|---|
| **Recipes PDF** | One A4 page per planned recipe, with the amounts for the planned portions, the date if set, and the working steps. |
| **Sorting list PDF** | The ingredients of each section (Mains, Spreads, Others) with the summed amounts. It shows where and how much of each ingredient goes. |
| **Labels PDF** | Labels for the containers, one per planned recipe, with the ingredient names but without amounts. Six rows and two columns fit on one A4 page. Cut them out and fill in the allergens by hand with a highlighter. |
| **Shopping list PDF** | The shopping list grouped by shop, with the needed amount, the amount in stock, the amount to buy, the number of packages and an empty box to tick off each item. At the end is the price estimate. |

#### Price estimate

Below the buttons you see:
- **Value of the food used:** what the planned food costs, counting only the part of each package that is used.
- **Purchase total, whole packages:** what you pay at the shop, counting whole packages.
- Both values per person.
- How many ingredients have a known price. If some prices are missing, the totals are lower bounds.

Ingredients without a package size or price show "-" in the shopping list.

### Sharing a plan

Press the **settings button** (gear icon, top right).

- **QR code:** scan the code to get the whole plan (people, event name, recipes, portions, dates).
- **Copy plan link:** copies a link that contains the whole plan (people, event name, recipes, portions, dates). Open it on another device to get the same plan.
- **Share plan link:** opens the share sheet of your device. Only shown if your device supports it.
- **Paste plan link:** pastes a link you received. If you already have planned recipes, you are asked before they are replaced. The inventory is not part of the link and stays on your device.

### Settings menu

Below the sharing options a heading **Settings** follows, with **Edit inventory**, **Edit recipes** and **Edit ingredients**.

Below these, two red buttons:

- **Export all local changes** appears only when this browser has changes to recipes, ingredients or the inventory. It downloads one file per change: a recipe file for each changed recipe, `ingredients.json` with the complete list if you have added or changed ingredients, and the inventory file. The files are in the format of the repository, so they can be added to a pull request. Your browser may ask whether it may download several files; allow it. **Do not put the inventory file into the repository**, it is your personal list.
- **Delete all local data** removes the saved plan, the inventory and all your changes to recipes and ingredients from this browser. It asks first.

## The inventory page

Open it with **Edit inventory**.

- Type a **name** for the inventory at the top. It is shown on the main page.
- The ingredients are listed by category. Enter the amount you have at home in the field next to each ingredient. An empty field means "none".
- Use the search field to filter the list.
- Changes are saved automatically in this browser.
- **Export inventory as JSON** creates a file to keep or to send to someone else.
- **Export inventory as PDF** creates a list of everything in stock, by category.
- **Load inventory file** loads a file you exported earlier or received from someone else.
- **Back to plan** returns to the main page.

The amounts are always in the unit of the ingredient (for example grams, pieces or cans). Packages are not counted as units.

### Adding ingredients

**+ New ingredient** (at the end of the page) adds a row for an ingredient that does not exist yet. Enter its name, the amount you have and its unit. The unit field suggests the units that are already in use. Then press **Save new ingredients**. The app creates the ingredient in this browser with its own id. It has no category, package size, package price or shop; add these later on the ingredients page.

- **Discard new ingredients** removes all rows that are not saved yet.
- Rows without a name or without a unit stay on the page, and a message appears below them. Completely empty rows are ignored.
- A name that already exists is not created again. Capital letters and spaces do not count: "bread", " Bread" and "Br ead" all count as "Bread". Use another name, or enter the amount in the existing ingredient.
- New ingredients are marked "Saved in this browser only" on the ingredients page.
- Rows that are not saved yet are lost when you leave the page.

## The recipes page

Open it with **Edit recipes** in the settings menu.

- The recipes are grouped by type. Use the search field to filter them.
- Each recipe has **JSON** (the recipe file) and **PDF** (a recipe page with the base amounts) next to its name.
- **+ New recipe** creates a recipe.
- **Import recipe file** loads a recipe file from someone else. It is saved in this browser and used on the main page after a reload. Remove it again with **Delete recipe** on the recipe page.
- Recipes that you changed are marked "Changed in this browser". Recipes that exist only in your browser are marked "Saved in this browser only".

### Editing a recipe

Click a recipe to edit it.

- **Name** is shown at the top. You can change it at any time.
- **Type:** main dish, spread or other.
- **Servings (people):** the number of people the ingredient amounts are written for.
- **Portion weight (g):** optional. The weight of one finished portion. It is shown on the recipe PDF.
- **Ingredients:** search for an ingredient, enter the amount, remove a row with **×**. The unit of the ingredient is shown next to the amount. When the app looks for an ingredient, capital letters and spaces do not matter: "bread", " Bread" and "Br ead" all find "Bread".
  - **New ingredient:** type a name that is not in the list yet. The unit field becomes a text field. Enter the unit, for example `g` or `clove`. Above **Save in this browser** the app lists the new ingredients. They are created when you press **Save in this browser** or **Download recipe file**. Two rows with the same new name create one ingredient.
  - A new ingredient needs a unit. Without a unit the recipe is not saved, and a message names the ingredient.
  - Rows that are completely empty are ignored. A row with an amount or a unit but no ingredient name shows a message.
- **Working steps:** one text box per step.

If you change the servings or the portion weight, the button **Scale ingredients** appears next to the heading "Ingredients". Press it to multiply all amounts by the change. Nothing is saved until you press **Save in this browser**.

**Save in this browser** saves the recipe on this device, and the main page uses it after a reload. **Download recipe file** downloads the recipe as a file in the format of the repository, for example `red-pesto.json`.

**Discard local changes** (for recipes from the repository) or **Delete recipe** (for your own recipes) removes the saved version from this browser.

### Changing and uploading recipes

Recipes that you want other people to use must be added to the repository. Only the owner of the repository can do this directly. Everyone else sends a pull request.

**Steps:**

1. Create or change the recipe on the recipe page and check it.
2. Press **Download recipe file**. You get a file such as `red-pesto.json`.
3. Put the file into the folder `recipes/` of your copy of the repository.
4. If the recipe uses ingredients that you created in the app, press **Export all local changes** in the settings menu. It creates a file for the recipe and an `ingredients.json` file with the complete list. Put them into `recipes/` and `ingredients/` of your copy of the repository. If the recipe uses only repository ingredients, this step is not needed.
5. Commit the changes to a new branch and open a pull request on GitHub.
6. The automatic check runs. For pull requests from the same repository, it also adds the recipe to `recipes/index.json`. You do not have to edit this file.
7. Merge the pull request. When GitHub Pages has updated the site, the recipe is part of the app for everyone.

**If you are not the owner:** Fork the repository and send the pull request from your fork. The check cannot write to forks. Add the id of your recipe (the file name without `.json`) to the list in `recipes/index.json` by hand, in the same pull request.

If the check fails, its log on the pull request page tells you what is wrong, for example a missing ingredient or an amount of 0.

## The ingredients page

Open it with **Edit ingredients** in the settings menu.

- The ingredients are listed by category. Use the search field to filter them.
- Each ingredient has:
  - **Unit:** the one unit used everywhere for this ingredient. Examples: `g`, `ml`, `piece`, `can`, `clove`.
  - **Category:** used to group the lists.
  - **Package size and package price:** both are needed to calculate costs. Enter them in the unit of the ingredient.
  - **Shop:** where you buy it.
- **+ New ingredient** creates an ingredient. Its id is made from the name.
- **Export ingredients file** downloads the complete list, including all your changes.
- **Import ingredients file** loads a list from someone else. Entries that match the repository version are not stored again.

### Names, categories and shops

- A name that is already used by another ingredient is refused. Capital letters and spaces do not count, so "Bread" and "bread " are the same name.
- Categories and shops follow the same rule. If you type "weekly market" and "Weekly market" already exists, the app keeps the spelling that is already in use. Categories that differ only in capital letters or spaces are shown in one group.
- Units are not compared this way. Each unit is written as you type it, so keep the same spelling in all ingredients, for example always `g`, not `G`.
- The import does not change names, categories or shops. An ingredient is recognised by its id. An imported "Chick peas" with a different id stays a second ingredient next to "Chickpeas".

### Changing the unit

If you change the unit of an ingredient, a panel asks for the conversion: for example "1 clove = 3 g". Enter both amounts. When you save, the app converts the amounts of all recipes that use this ingredient in this browser, the package size and the stored inventory. The package price stays the same.

If an import contains an ingredient with a different unit, a dialog asks you for the same conversion before the import is done. **Cancel import** imports nothing.

An ingredient that is used in a recipe cannot be deleted. The message lists the recipes. Remove the ingredient from these recipes first.

### Changing and uploading ingredients

Ingredients that you want other people to use must be added to the repository. Only the owner of the repository can do this directly. Everyone else sends a pull request.

**Steps:**

1. Create or change the ingredient on the ingredients page and check it.
2. Press **Export ingredients file**. You get a file called `ingredients.json` with the complete list, including all your changes.
3. Put the file into the folder `ingredients/` of your copy of the repository, replacing `ingredients/ingredients.json`.
4. Check that your changes are the only differences. Exporting the complete list keeps every other ingredient as it is. Do not delete ingredients that recipes still use.
5. Commit the changes to a new branch and open a pull request on GitHub.
6. The automatic check runs. It validates the file and the recipes that use the ingredients.
7. Merge the pull request. When GitHub Pages has updated the site, the ingredient is part of the app for everyone.

**Important:** The export contains the whole list. If someone else changed the repository in the meantime, a copy of an older export can overwrite their changes. Export again from the current version of the app, or merge the changes by hand, before you open the pull request.

**Ingredients created on the inventory page or in a recipe** exist only in your browser. If you share an inventory file or a recipe that uses them, the other device must have the same ingredient, otherwise the entry is skipped with a message. Export the changes with **Export all local changes** and add the ingredients to the repository by pull request.

**If you are not the owner:** Fork the repository and send the pull request from your fork. The check cannot write to forks. Make sure your ingredient ids are unique and that every unit is written the same way as in the existing list.

**Units:** Choose the unit that you will use in all recipes, for example `g`, `ml`, `piece`, `can` or `clove`. Changing the unit of an existing ingredient later converts the amounts of the recipes in your browser only. Changes in the repository must be made by pull request, and the amounts in the recipe files must be converted in the same pull request.

If the check fails, its log on the pull request page tells you what is wrong, for example a duplicate id, a missing package price or a recipe that uses an unknown ingredient.

## Your data stays on your device

The app stores the following in your browser (the local storage) and sends nothing to a server:

- your plan
- your inventory
- your saved recipes and ingredients

**Delete all local data** in the settings menu removes all of it. Export your inventory first if you want to keep it.

## Known issues

- After you change the unit of an ingredient and convert its amounts, do not press **Discard local changes** for that ingredient. The unit goes back to the original one, but the amounts in your recipes are not converted back. Check the amounts of the affected recipes afterwards and correct them by hand.
- When you change the unit of an ingredient and convert its amounts, please note that **the package size is scaled** when saving. Save the new unit before adapting the package size. If you change both at the same time, check the package size after saving the changes.
