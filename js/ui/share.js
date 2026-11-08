// @ts-check
// Share dialog: QR code and copy, share and paste buttons for the current plan link.
// The dialog never changes the plan itself. Pasting a link reloads the page with
// the query string of that link, after a warning if the current plan would be lost.

/**
 * @typedef {Object} ShareHandlers
 * @property {() => string} getLink Full link to the current plan. Throws if the plan cannot be shared.
 * @property {(text: string) => { search: string }} readPlanFromText Throws an Error with a message if the text is no plan link.
 * @property {() => boolean} hasPlanContent True if recipes are planned or an inventory is loaded.
 * @property {(search: string) => void} replacePlan Loads the plan with the given query string.
 */

/**
 * Connects the share button and the dialog of the main page.
 * @param {ShareHandlers} handlers
 */
export function initShare(handlers) {
  const dialog = /** @type {HTMLDialogElement} */ (document.querySelector("#share-dialog"));
  const openButton = /** @type {HTMLButtonElement} */ (document.querySelector("#share-open"));
  const qrBox = /** @type {HTMLElement} */ (document.querySelector("#share-qr"));
  const copyButton = /** @type {HTMLButtonElement} */ (document.querySelector("#share-copy"));
  const nativeButton = /** @type {HTMLButtonElement} */ (document.querySelector("#share-native"));
  const pasteButton = /** @type {HTMLButtonElement} */ (document.querySelector("#share-paste"));
  const pasteField = /** @type {HTMLElement} */ (document.querySelector("#share-paste-field"));
  const pasteInput = /** @type {HTMLInputElement} */ (document.querySelector("#share-paste-input"));
  const confirmBox = /** @type {HTMLElement} */ (document.querySelector("#share-confirm"));
  const confirmButton = /** @type {HTMLButtonElement} */ (document.querySelector("#share-confirm-replace"));
  const cancelButton = /** @type {HTMLButtonElement} */ (document.querySelector("#share-confirm-cancel"));
  const closeButton = /** @type {HTMLButtonElement} */ (document.querySelector("#share-close"));
  const message = /** @type {HTMLElement} */ (document.querySelector("#share-message"));

  /** Query string that waits for confirmation before it replaces the current plan. */
  let pendingSearch = /** @type {string | null} */ (null);

  // Only offer the native share sheet where the browser supports it.
  nativeButton.hidden = !navigator.share;

  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", () => dialog.close());
  copyButton.addEventListener("click", copyLink);
  nativeButton.addEventListener("click", shareLink);
  pasteButton.addEventListener("click", pasteFromClipboard);
  pasteInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handlePastedText(pasteInput.value);
    }
  });
  confirmButton.addEventListener("click", () => {
    if (pendingSearch !== null) {
      handlers.replacePlan(pendingSearch);
    }
  });
  cancelButton.addEventListener("click", hideConfirm);

  /** Opens the dialog and shows the QR code of the current plan. */
  function open() {
    resetPanels();
    try {
      qrBox.innerHTML = qrSvg(handlers.getLink());
    } catch (error) {
      qrBox.replaceChildren();
      showMessage(errorMessage(error));
    }
    dialog.showModal();
  }

  async function copyLink() {
    resetPanels();
    try {
      await navigator.clipboard.writeText(handlers.getLink());
      showMessage("Plan link copied.");
    } catch (error) {
      showMessage(`Copying failed. ${errorMessage(error)}`);
    }
  }

  async function shareLink() {
    resetPanels();
    try {
      await navigator.share({ title: "Coxi Recipe Calculator", url: handlers.getLink() });
    } catch (error) {
      // The user closing the share sheet is not an error.
      if (/** @type {Error} */ (error).name !== "AbortError") {
        showMessage(errorMessage(error));
      }
    }
  }

  /** Reads the clipboard. If the browser does not allow it, shows a field for pasting by hand. */
  async function pasteFromClipboard() {
    resetPanels();
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = "";
    }

    if (text.trim() === "") {
      pasteField.hidden = false;
      pasteInput.value = "";
      pasteInput.focus();
      showMessage("Paste the link into the field and press Enter.");
      return;
    }
    handlePastedText(text);
  }

  /**
   * Checks the text. Replaces the plan directly if there is nothing to lose,
   * otherwise asks for confirmation first.
   * @param {string} text
   */
  function handlePastedText(text) {
    hideConfirm();
    /** @type {{ search: string }} */
    let result;
    try {
      result = handlers.readPlanFromText(text);
    } catch (error) {
      showMessage(errorMessage(error));
      return;
    }

    if (handlers.hasPlanContent()) {
      pendingSearch = result.search;
      confirmBox.hidden = false;
      showMessage("");
      return;
    }
    handlers.replacePlan(result.search);
  }

  /** @param {string} text */
  function showMessage(text) {
    message.textContent = text;
  }

  function hideConfirm() {
    confirmBox.hidden = true;
    pendingSearch = null;
  }

  /** Clears the messages and the optional panels before a new action. */
  function resetPanels() {
    hideConfirm();
    pasteField.hidden = true;
    showMessage("");
  }
}

/**
 * Creates an SVG QR code for the text. The library is loaded as a classic script.
 * White background rectangles are removed, so the page color shows through.
 * @param {string} text
 * @returns {string}
 */
function qrSvg(text) {
  const qrcode = /** @type {any} */ (globalThis).qrcode;
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const markup = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  doc.querySelectorAll("rect").forEach((rect) => {
    const fill = (rect.getAttribute("fill") ?? "").toLowerCase();
    if (fill === "#ffffff" || fill === "white") {
      rect.remove();
    }
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function errorMessage(error) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
