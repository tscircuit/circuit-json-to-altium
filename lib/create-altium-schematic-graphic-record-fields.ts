import type {
  BoxPrimitive,
  CirclePrimitive,
  PathPrimitive,
} from "schematic-symbols"
import type { Matrix } from "transformation-matrix"
import { applyToPoint } from "transformation-matrix"
import {
  ALTIUM_SCHEMATIC_GRAPHIC_COLOR,
  ALTIUM_SCHEMATIC_WHITE,
} from "./altium-schematic-colors"
import { pointsEqual } from "./format"
import type { Point, PointTransform } from "./types"

type SchematicGraphicPrimitive = BoxPrimitive | CirclePrimitive | PathPrimitive

export type AltiumSchematicSymbolMapping = {
  altiumComponentRecordIndex: number
  circuitToAltiumSchematicPoint: PointTransform
  circuitToAltiumSchematicPrecisePoint: PointTransform
  symbolToCircuitMatrix: Matrix
}

type CreateAltiumSchematicGraphicRecordFieldsOptions = {
  graphicPrimitive: SchematicGraphicPrimitive
  symbolMapping: AltiumSchematicSymbolMapping
}

export function createAltiumSchematicGraphicRecordFields({
  graphicPrimitive,
  symbolMapping,
}: CreateAltiumSchematicGraphicRecordFieldsOptions): string[] {
  if (graphicPrimitive.type === "path") {
    return createAltiumPathRecordFields({
      pathPrimitive: graphicPrimitive,
      symbolMapping,
    })
  }
  if (graphicPrimitive.type === "circle") {
    return createAltiumCircleRecordFields({
      circlePrimitive: graphicPrimitive,
      symbolMapping,
    })
  }
  return createAltiumBoxRecordFields({
    boxPrimitive: graphicPrimitive,
    symbolMapping,
  })
}

function createAltiumPathRecordFields({
  pathPrimitive,
  symbolMapping,
}: {
  pathPrimitive: PathPrimitive
  symbolMapping: AltiumSchematicSymbolMapping
}): string[] {
  const altiumPathPoints = pathPrimitive.points.map((symbolPoint) =>
    transformSchematicSymbolPointPrecisely({ symbolMapping, symbolPoint }),
  )
  const firstPoint = altiumPathPoints[0]
  const lastPoint = altiumPathPoints.at(-1)
  if (
    pathPrimitive.closed &&
    firstPoint &&
    lastPoint &&
    !pointsEqual(firstPoint, lastPoint)
  ) {
    altiumPathPoints.push(firstPoint)
  }

  return [
    `RECORD=${pathPrimitive.fill ? 7 : 6}`,
    ...createOwnedSchematicRecordFields(
      symbolMapping.altiumComponentRecordIndex,
    ),
    "LINEWIDTH=1",
    `LOCATIONCOUNT=${altiumPathPoints.length}`,
    ...altiumPathPoints.flatMap((altiumPoint, pointIndex) => [
      ...createAltiumSchematicCoordinateRecordFields(
        `X${pointIndex + 1}`,
        altiumPoint.x,
      ),
      ...createAltiumSchematicCoordinateRecordFields(
        `Y${pointIndex + 1}`,
        altiumPoint.y,
      ),
    ]),
    `COLOR=${ALTIUM_SCHEMATIC_GRAPHIC_COLOR}`,
    ...(pathPrimitive.fill
      ? [`AREACOLOR=${ALTIUM_SCHEMATIC_GRAPHIC_COLOR}`, "ISSOLID=T"]
      : []),
  ]
}

const ALTIUM_SCHEMATIC_FRACTION_DIGITS = 8
const ALTIUM_SCHEMATIC_FRACTION_SCALE = 10 ** ALTIUM_SCHEMATIC_FRACTION_DIGITS

function createAltiumSchematicCoordinateRecordFields(
  fieldName: string,
  coordinate: number,
): string[] {
  // Altium represents sub-grid schematic coordinates as an integer field plus
  // an eight-digit *_FRAC field. Rounding these points deforms tiny details
  // such as the short lead-in segments on LED emission arrows.
  const roundedCoordinate =
    Math.round(coordinate * ALTIUM_SCHEMATIC_FRACTION_SCALE) /
    ALTIUM_SCHEMATIC_FRACTION_SCALE
  const integerPart = Math.trunc(roundedCoordinate)
  const fractionalPart = Math.round(
    Math.abs(roundedCoordinate - integerPart) * ALTIUM_SCHEMATIC_FRACTION_SCALE,
  )
  return [
    `${fieldName}=${integerPart}`,
    ...(fractionalPart > 0
      ? [
          `${fieldName}_FRAC=${String(fractionalPart).padStart(ALTIUM_SCHEMATIC_FRACTION_DIGITS, "0")}`,
        ]
      : []),
  ]
}

function createAltiumCircleRecordFields({
  circlePrimitive,
  symbolMapping,
}: {
  circlePrimitive: CirclePrimitive
  symbolMapping: AltiumSchematicSymbolMapping
}): string[] {
  const altiumCenter = transformSchematicSymbolPoint({
    symbolMapping,
    symbolPoint: { x: circlePrimitive.x, y: circlePrimitive.y },
  })
  const altiumRadiusPoint = transformSchematicSymbolPoint({
    symbolMapping,
    symbolPoint: {
      x: circlePrimitive.x + circlePrimitive.radius,
      y: circlePrimitive.y,
    },
  })
  const altiumRadius = Math.max(
    1,
    Math.abs(altiumRadiusPoint.x - altiumCenter.x),
  )

  return [
    "RECORD=8",
    ...createOwnedSchematicRecordFields(
      symbolMapping.altiumComponentRecordIndex,
    ),
    `LOCATION.X=${altiumCenter.x}`,
    `LOCATION.Y=${altiumCenter.y}`,
    `RADIUS=${altiumRadius}`,
    `SECONDARYRADIUS=${altiumRadius}`,
    "LINEWIDTH=1",
    `COLOR=${ALTIUM_SCHEMATIC_GRAPHIC_COLOR}`,
    `AREACOLOR=${circlePrimitive.fill ? ALTIUM_SCHEMATIC_GRAPHIC_COLOR : ALTIUM_SCHEMATIC_WHITE}`,
    `ISSOLID=${circlePrimitive.fill ? "T" : "F"}`,
  ]
}

function createAltiumBoxRecordFields({
  boxPrimitive,
  symbolMapping,
}: {
  boxPrimitive: BoxPrimitive
  symbolMapping: AltiumSchematicSymbolMapping
}): string[] {
  const circuitBoxCenter = getCircuitBoxCenter(boxPrimitive)
  const altiumFirstCorner = transformSchematicSymbolPoint({
    symbolMapping,
    symbolPoint: {
      x: circuitBoxCenter.x - boxPrimitive.width / 2,
      y: circuitBoxCenter.y - boxPrimitive.height / 2,
    },
  })
  const altiumSecondCorner = transformSchematicSymbolPoint({
    symbolMapping,
    symbolPoint: {
      x: circuitBoxCenter.x + boxPrimitive.width / 2,
      y: circuitBoxCenter.y + boxPrimitive.height / 2,
    },
  })

  return [
    "RECORD=14",
    ...createOwnedSchematicRecordFields(
      symbolMapping.altiumComponentRecordIndex,
    ),
    `LOCATION.X=${altiumFirstCorner.x}`,
    `LOCATION.Y=${altiumFirstCorner.y}`,
    `CORNER.X=${altiumSecondCorner.x}`,
    `CORNER.Y=${altiumSecondCorner.y}`,
    "LINEWIDTH=1",
    `COLOR=${ALTIUM_SCHEMATIC_GRAPHIC_COLOR}`,
    `AREACOLOR=${ALTIUM_SCHEMATIC_WHITE}`,
    "ISSOLID=F",
  ]
}

function getCircuitBoxCenter(boxPrimitive: BoxPrimitive): Point {
  const horizontalOffset = boxPrimitive.anchor.endsWith("_left")
    ? boxPrimitive.width / 2
    : boxPrimitive.anchor.endsWith("_right")
      ? -boxPrimitive.width / 2
      : 0
  const verticalOffset = boxPrimitive.anchor.startsWith("top_")
    ? -boxPrimitive.height / 2
    : boxPrimitive.anchor.startsWith("bottom_")
      ? boxPrimitive.height / 2
      : 0
  return {
    x: boxPrimitive.x + horizontalOffset,
    y: boxPrimitive.y + verticalOffset,
  }
}

export function transformSchematicSymbolPoint({
  symbolMapping,
  symbolPoint,
}: {
  symbolMapping: AltiumSchematicSymbolMapping
  symbolPoint: Point
}): Point {
  const circuitPoint = applyToPoint(
    symbolMapping.symbolToCircuitMatrix,
    symbolPoint,
  )
  return symbolMapping.circuitToAltiumSchematicPoint(circuitPoint)
}

function transformSchematicSymbolPointPrecisely({
  symbolMapping,
  symbolPoint,
}: {
  symbolMapping: AltiumSchematicSymbolMapping
  symbolPoint: Point
}): Point {
  const circuitPoint = applyToPoint(
    symbolMapping.symbolToCircuitMatrix,
    symbolPoint,
  )
  return symbolMapping.circuitToAltiumSchematicPrecisePoint(circuitPoint)
}

export function createOwnedSchematicRecordFields(
  altiumComponentRecordIndex: number,
): string[] {
  return [
    `OWNERINDEX=${altiumComponentRecordIndex}`,
    "OWNERPARTID=1",
    "OWNERPARTDISPLAYMODE=0",
  ]
}
