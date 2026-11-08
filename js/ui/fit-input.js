// @ts-check
// Sets the width of a text or number input to fit its content, so the hover
// background only covers the text. With fullWidthOnFocus, the input takes the
// full width while it has the focus.

/** Hidden element used to measure text with the same font as the input. */
const probe = document.createElement("span");
probe.setAttribute("aria-hidden", "true");
probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;";
document.body.append(probe);

/**
 * @param {HTMLInputElement} input
 * @param {{ fullWidthOnFocus?: boolean }} [options]
 */
export function fitInputWidth(input, { fullWidthOnFocus = false } = {}) {
  const update = () => fit(input, fullWidthOnFocus);

  input.addEventListener("input", update);
  if (fullWidthOnFocus) {
    input.addEventListener("focus", update);
    input.addEventListener("blur", update);
  }
  window.addEventListener("resize", update);
  // Web fonts can change the text width after the first measurement.
  document.fonts.ready.then(update);
  update();
}

/**
 * @param {HTMLInputElement} input
 * @param {boolean} fullWidthOnFocus
 */
function fit(input, fullWidthOnFocus) {
  if (fullWidthOnFocus && document.activeElement === input) {
    input.style.width = "100%";
    return;
  }

  const style = getComputedStyle(input);
  probe.style.fontFamily = style.fontFamily;
  probe.style.fontSize = style.fontSize;
  probe.style.fontWeight = style.fontWeight;
  probe.style.letterSpacing = style.letterSpacing;
  probe.textContent = input.value || input.placeholder;

  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  // Two extra pixels leave room for the caret at the end of the text.
  const textWidth = probe.getBoundingClientRect().width;
  input.style.width = `${textWidth + padding + border + 2}px`;
}
