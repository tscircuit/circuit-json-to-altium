import { expect, test } from "bun:test"
import { createAltiumSchematicCoordinateFields } from "../lib/create-altium-schematic-coordinate-fields"

test("encodes sub-grid coordinates on both sides of zero with integer fields", () => {
  for (const [value, expected] of [
    [258.08, ["X2=258", "X2_FRAC=08000"]],
    [-1.08, ["X2=-1", "X2_FRAC=-08000"]],
    [-0.12, ["X2=0", "X2_FRAC=-12000"]],
    [2.999999, ["X2=3"]],
  ] as const) {
    expect(createAltiumSchematicCoordinateFields("X2", value)).toEqual([
      ...expected,
    ])
  }
})
