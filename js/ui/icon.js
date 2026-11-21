// @ts-check
// Creates an icon element that uses a symbol of icons/sprite.svg. Used by the pages
// for buttons that are built in JavaScript. Static HTML uses the <use> markup directly.
const SPRITE_URL = new URL("../../icons/sprite.svg", import.meta.url).href;
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * @param {string} name Id of a symbol in icons/sprite.svg, for example "plus".
 * @returns {SVGSVGElement}
 */
export function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `${SPRITE_URL}#${name}`);
  svg.append(use);
  return svg;
}
