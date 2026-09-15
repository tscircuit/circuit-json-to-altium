import { ALTIUM_SCHEMATIC_WHITE } from "./altium-schematic-colors"
import { ALTIUM_SCHEMATIC_HAIRLINE_WIDTH } from "./altium-schematic-line-width"
import { createAltiumSchematicCoordinateFields as coordinates } from "./create-altium-schematic-coordinate-fields"
import { createOwnedSchematicRecordFields } from "./create-altium-schematic-graphic-record-fields"
import type { LengthTransform, Point } from "./types"

// Match circuit-to-svg's inversion bubble radius, in Circuit JSON units.
export const SCHEMATIC_PIN_INVERSION_RADIUS = 0.06

export function createSchematicPinMarkerRecords({
  body,
  orientation,
  hasInversionCircle,
  ownerIndex,
  color,
  toAltiumLength,
}: {
  body: Point
  orientation: number
  hasInversionCircle: boolean
  ownerIndex: number
  color: number
  toAltiumLength: LengthTransform
}): { records: string[][]; pinPosition: Point; bodyOffset: number } {
  const dx = [1, 0, -1, 0][orientation & 3]!
  const dy = [0, 1, 0, -1][orientation & 3]!
  const radius = hasInversionCircle
    ? toAltiumLength(SCHEMATIC_PIN_INVERSION_RADIUS)
    : 0
  const records = hasInversionCircle
    ? [
        [
          "RECORD=8",
          ...createOwnedSchematicRecordFields(ownerIndex),
          ...coordinates("LOCATION.X", body.x + dx * radius),
          ...coordinates("LOCATION.Y", body.y + dy * radius),
          ...coordinates("RADIUS", radius),
          ...coordinates("SECONDARYRADIUS", radius),
          `LINEWIDTH=${ALTIUM_SCHEMATIC_HAIRLINE_WIDTH}`,
          `COLOR=${color}`,
          `AREACOLOR=${ALTIUM_SCHEMATIC_WHITE}`,
          "ISSOLID=T",
        ],
      ]
    : []
  // Keep the electrical pin and its wire together outside the filled bubble.
  // Name/designator margins compensate for this shift from the body edge.
  const bodyOffset = radius * 2
  return {
    records,
    bodyOffset,
    pinPosition: {
      x: body.x + dx * bodyOffset,
      y: body.y + dy * bodyOffset,
    },
  }
}
