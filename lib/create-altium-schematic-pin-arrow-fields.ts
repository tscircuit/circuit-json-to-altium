import { createAltiumSchematicCoordinateFields } from "./create-altium-schematic-coordinate-fields"
import type { Point } from "./types"

/** A Circuit JSON input arrow is a drawing, not an Altium IEEE clock symbol. */
export function createAltiumSchematicPinArrowFields({
  body,
  color,
  hasInversionCircle,
  orientation,
  ownerIndex,
}: {
  body: Point
  color: number
  hasInversionCircle: boolean
  orientation: number
  ownerIndex: number
}): string[] {
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][orientation & 3]!
  const tipOffset = hasInversionCircle ? 5 : 0
  const point = (along: number, across: number): Point => ({
    x: body.x + direction.x * along - direction.y * across,
    y: body.y + direction.y * along + direction.x * across,
  })
  // Match the source arrow's 0.1-unit side and 30-degree half angle.
  const depth = 2 * Math.cos(Math.PI / 6)
  const points = [
    point(tipOffset, 0),
    point(tipOffset + depth, 1),
    point(tipOffset + depth, -1),
  ]
  return [
    "RECORD=7",
    `OWNERINDEX=${ownerIndex}`,
    "OWNERPARTID=1",
    "LINEWIDTH=0",
    `COLOR=${color}`,
    "AREACOLOR=16777215",
    "ISSOLID=T",
    "LOCATIONCOUNT=3",
    ...points.flatMap((value, index) => [
      ...createAltiumSchematicCoordinateFields(`X${index + 1}`, value.x),
      ...createAltiumSchematicCoordinateFields(`Y${index + 1}`, value.y),
    ]),
  ]
}
