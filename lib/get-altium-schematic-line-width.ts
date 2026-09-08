/** Native TSize values: smallest, small, medium, large (not raw lengths). */
export function getAltiumSchematicLineWidth(
  widthInAltiumUnits: number,
): number {
  const widths = [0, 1, 3, 5]
  return widths.reduce(
    (best, width, index) =>
      Math.abs(width - widthInAltiumUnits) <
      Math.abs(widths[best]! - widthInAltiumUnits)
        ? index
        : best,
    0,
  )
}
