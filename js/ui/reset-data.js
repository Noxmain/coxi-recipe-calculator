// @ts-check
// Button in the settings dialog that deletes all local data after a confirmation.
import { clearAllLocalData } from "../storage.js";

const resetButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("#data-reset"));

resetButton?.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Delete all data stored in this browser? This removes the saved plan and the saved inventory. Export your inventory first if you want to keep it.",
  );
  if (!confirmed) return;

  clearAllLocalData();

  // Reload the main page without a query string, so no plan is restored.
  location.replace(location.pathname);
});
