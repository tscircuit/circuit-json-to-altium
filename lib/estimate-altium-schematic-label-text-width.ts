// Advance widths in ems for printable ASCII (U+0020 through U+007E), taking
// the wider glyph advance of Arial and Times New Roman, our exported fonts.
const ASCII_GLYPH_ADVANCES = [
  0.278, 0.333, 0.408, 0.556, 0.556, 0.889, 0.778, 0.191, 0.333, 0.333, 0.5,
  0.584, 0.278, 0.333, 0.278, 0.278, 0.556, 0.556, 0.556, 0.556, 0.556, 0.556,
  0.556, 0.556, 0.556, 0.556, 0.278, 0.278, 0.584, 0.584, 0.584, 0.556, 1.015,
  0.722, 0.667, 0.722, 0.722, 0.667, 0.611, 0.778, 0.722, 0.333, 0.5, 0.722,
  0.611, 0.889, 0.722, 0.778, 0.667, 0.778, 0.722, 0.667, 0.611, 0.722, 0.722,
  0.944, 0.722, 0.722, 0.611, 0.333, 0.278, 0.333, 0.469, 0.556, 0.333, 0.556,
  0.556, 0.5, 0.556, 0.556, 0.333, 0.556, 0.556, 0.278, 0.278, 0.5, 0.278,
  0.833, 0.556, 0.556, 0.556, 0.556, 0.333, 0.5, 0.278, 0.556, 0.5, 0.722, 0.5,
  0.5, 0.5, 0.48, 0.259, 0.48, 0.584,
]

export function estimateAltiumSchematicLabelTextWidth(
  text: string,
  fontSize: number,
): number {
  return [...text].reduce(
    (width, character) =>
      width +
      (ASCII_GLYPH_ADVANCES[character.codePointAt(0)! - 32] ?? 1) * fontSize,
    0,
  )
}
