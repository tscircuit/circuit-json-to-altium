import {
  ALTIUM_SCHEMATIC_GRAPHIC_COLOR,
  ALTIUM_SCHEMATIC_WHITE,
} from "./altium-schematic-colors"
import {
  createAltiumSchematicCoordinateRecordFields,
  createOwnedSchematicRecordFields,
} from "./create-altium-schematic-graphic-record-fields"
import type { LengthTransform, Point } from "./types"

type CreateAltiumSchematicPinEdgeSymbolRecordFieldsInput = {
  altiumComponentRecordIndex: number
  altiumPinBody: Point
  circuitToAltiumSchematicLength: LengthTransform
  color?: number
  facingDirection: string
  hasInputArrow: boolean
  hasInversionCircle: boolean
}

const CIRCUIT_JSON_ARROW_SIZE = 0.1
const CIRCUIT_JSON_INVERSION_CIRCLE_RADIUS = 0.06
const ARROW_HALF_ANGLE_RADIANS = Math.PI / 6

const PIN_OUTWARD_DIRECTION_BY_FACING_DIRECTION: Record<string, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
}

function translatePoint(
  point: Point,
  direction: Point,
  distance: number,
): Point {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  }
}

function createFilledPathRecordFields({
  altiumComponentRecordIndex,
  color,
  points,
}: {
  altiumComponentRecordIndex: number
  color: number
  points: Point[]
}): string[] {
  return [
    "RECORD=7",
    ...createOwnedSchematicRecordFields(altiumComponentRecordIndex),
    "LINEWIDTH=0",
    `LOCATIONCOUNT=${points.length}`,
    ...points.flatMap((point, pointIndex) => [
      ...createAltiumSchematicCoordinateRecordFields(
        `X${pointIndex + 1}`,
        point.x,
      ),
      ...createAltiumSchematicCoordinateRecordFields(
        `Y${pointIndex + 1}`,
        point.y,
      ),
    ]),
    `COLOR=${color}`,
    `AREACOLOR=${ALTIUM_SCHEMATIC_WHITE}`,
    "ISSOLID=T",
  ]
}

function createArrowRecordFields({
  altiumComponentRecordIndex,
  baseAnchor,
  color,
  outwardDirection,
  size,
}: {
  altiumComponentRecordIndex: number
  baseAnchor: Point
  color: number
  outwardDirection: Point
  size: number
}): string[] {
  const depth = size * Math.cos(ARROW_HALF_ANGLE_RADIANS)
  const halfWidth = size * Math.sin(ARROW_HALF_ANGLE_RADIANS)
  const baseCenter = translatePoint(baseAnchor, outwardDirection, depth)
  const perpendicularDirection = {
    x: -outwardDirection.y,
    y: outwardDirection.x,
  }
  return createFilledPathRecordFields({
    altiumComponentRecordIndex,
    color,
    points: [
      baseAnchor,
      translatePoint(baseCenter, perpendicularDirection, halfWidth),
      translatePoint(baseCenter, perpendicularDirection, -halfWidth),
    ],
  })
}

/**
 * Circuit JSON direction arrows and inversion bubbles are substantially
 * smaller than Altium's fixed-size native pin edge symbols. Emit owned
 * primitives so their geometry stays faithful to the Circuit JSON view.
 */
export function createAltiumSchematicPinEdgeSymbolRecordFields({
  altiumComponentRecordIndex,
  altiumPinBody,
  circuitToAltiumSchematicLength,
  color = ALTIUM_SCHEMATIC_GRAPHIC_COLOR,
  facingDirection,
  hasInputArrow,
  hasInversionCircle,
}: CreateAltiumSchematicPinEdgeSymbolRecordFieldsInput): string[][] {
  const outwardDirection =
    PIN_OUTWARD_DIRECTION_BY_FACING_DIRECTION[facingDirection]
  if (!outwardDirection) return []

  const recordFields: string[][] = []
  const inversionCircleRadius = circuitToAltiumSchematicLength(
    CIRCUIT_JSON_INVERSION_CIRCLE_RADIUS,
  )
  let arrowAnchor = altiumPinBody

  if (hasInversionCircle) {
    const circleCenter = translatePoint(
      altiumPinBody,
      outwardDirection,
      inversionCircleRadius,
    )
    recordFields.push([
      "RECORD=8",
      ...createOwnedSchematicRecordFields(altiumComponentRecordIndex),
      ...createAltiumSchematicCoordinateRecordFields(
        "LOCATION.X",
        circleCenter.x,
      ),
      ...createAltiumSchematicCoordinateRecordFields(
        "LOCATION.Y",
        circleCenter.y,
      ),
      ...createAltiumSchematicCoordinateRecordFields(
        "RADIUS",
        inversionCircleRadius,
      ),
      ...createAltiumSchematicCoordinateRecordFields(
        "SECONDARYRADIUS",
        inversionCircleRadius,
      ),
      "LINEWIDTH=1",
      `COLOR=${color}`,
      `AREACOLOR=${ALTIUM_SCHEMATIC_WHITE}`,
      "ISSOLID=T",
    ])
    arrowAnchor = translatePoint(
      altiumPinBody,
      outwardDirection,
      inversionCircleRadius * 2,
    )
  }

  const arrowSize = circuitToAltiumSchematicLength(CIRCUIT_JSON_ARROW_SIZE)
  if (hasInputArrow) {
    recordFields.push(
      createArrowRecordFields({
        altiumComponentRecordIndex,
        baseAnchor: arrowAnchor,
        color,
        outwardDirection,
        size: arrowSize,
      }),
    )
  }

  return recordFields
}
