// @ts-check
// Type definitions only. This file contains no runtime code.

/**
 * @typedef {Object} Ingredient
 * @property {string} id Stable identifier. Never change it after release.
 * @property {string} name
 * @property {string} unit Free text. The only unit used for this ingredient.
 * @property {string} [category] Free text, used to sort the shopping list.
 * @property {number} [packageSize] Content of one package, in `unit`.
 * @property {number} [packagePrice] Price of one package.
 * @property {string} [whereToBuy] Shop where the ingredient is bought.
 */

/**
 * @typedef {Object} RecipeIngredient
 * @property {string} ingredientId
 * @property {number} amount Amount for `servings` people, in the unit of the ingredient.
 */

/**
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} name
 * @property {"main" | "spread" | "other"} type
 * @property {number} [servings] Number of people the amounts are written for. Defaults to 1.
 * @property {number} [portionWeight] Weight of one portion in g. Display only.
 * @property {RecipeIngredient[]} ingredients
 * @property {string[]} steps
 */

/**
 * Inventory amounts keyed by ingredient id, always in the unit of the ingredient.
 * @typedef {Record<string, number>} Inventory
 */

/**
 * One line of the shopping list.
 * @typedef {Object} ShoppingItem
 * @property {string} id
 * @property {string} name
 * @property {string} unit
 * @property {string | null} category Null if the ingredient has no category.
 * @property {string | null} whereToBuy Null if no shop is set.
 * @property {number} needed Amount needed by all selected recipes, not rounded.
 * @property {number} inStock Amount in the inventory.
 * @property {number} toBuy max(0, needed - inStock)
 * @property {number | null} packageCount Packages to buy. Null without price data.
 * @property {number | null} usedValue Value of the needed amount. Null without price data.
 * @property {number | null} purchaseCost Price of the packages to buy. Null without price data.
 */

/**
 * @typedef {Object} ShoppingGroup
 * @property {string | null} shop Null if no shop is set.
 * @property {ShoppingItem[]} items Sorted by category, then by name.
 */

/**
 * @typedef {Object} PriceSummary
 * @property {number} absoluteTotal Value of all needed amounts, only items with price data.
 * @property {number} absolutePerPerson
 * @property {number} purchaseTotal Price of all packages to buy, only items with price data.
 * @property {number} purchasePerPerson
 * @property {number} pricedCount Number of items with price data.
 * @property {number} itemCount Number of all items.
 */

export {};
