import type {
  BoxPrimitive,
  CirclePrimitive,
  PathPrimitive,
} from "schematic-symbols"
import type { Matrix } from "transformation-matrix"
import { applyToPoint } from "transformation-matrix"
import { pointsEqual } from "./format"
import type { AltiumPartId, Point, PointTransform } from "./types"

type SchematicGraphicPrimitive = BoxPrimitive | CirclePrimitive | PathPrimitive

export type AltiumSchematicSymbolMapping = {
  altiumComponentRecordIndex: number
  altiumPartId: AltiumPartId
  circuitToAltiumSchematicPoint: PointTransform
  symbolToCircuitMatrix: Matrix
}

type CreateOwnedSchematicRecordFieldsParams = {
  altiumComponentRecordIndex: number
  altiumPartId: AltiumPartId
}

type CreateAltiumSchematicGraphicRecordFieldsOptions = {
  graphicPrimitive: SchematicGraphicPrimitive
  symbolMapping: AltiumSchematicSymbolMapping
}

const ALTIUM_SCHEMATIC_PRIMARY_COLOR = 132
const ALTIUM_SCHEMATIC_WHITE = 16_777_215

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
    transformSchematicSymbolPoint({ symbolMapping, symbolPoint }),
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
    ...createOwnedSchematicRecordFields({
      altiumComponentRecordIndex: symbolMapping.altiumComponentRecordIndex,
      altiumPartId: symbolMapping.altiumPartId,
    }),
    "LINEWIDTH=1",
    `LOCATIONCOUNT=${altiumPathPoints.length}`,
    ...altiumPathPoints.flatMap((altiumPoint, pointIndex) => [
      `X${pointIndex + 1}=${altiumPoint.x}`,
      `Y${pointIndex + 1}=${altiumPoint.y}`,
    ]),
    `COLOR=${ALTIUM_SCHEMATIC_PRIMARY_COLOR}`,
    ...(pathPrimitive.fill
      ? [`AREACOLOR=${ALTIUM_SCHEMATIC_PRIMARY_COLOR}`, "ISSOLID=T"]
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
    ...createOwnedSchematicRecordFields({
      altiumComponentRecordIndex: symbolMapping.altiumComponentRecordIndex,
      altiumPartId: symbolMapping.altiumPartId,
    }),
    `LOCATION.X=${altiumCenter.x}`,
    `LOCATION.Y=${altiumCenter.y}`,
    `RADIUS=${altiumRadius}`,
    `SECONDARYRADIUS=${altiumRadius}`,
    "LINEWIDTH=1",
    `COLOR=${ALTIUM_SCHEMATIC_PRIMARY_COLOR}`,
    `AREACOLOR=${circlePrimitive.fill ? ALTIUM_SCHEMATIC_PRIMARY_COLOR : ALTIUM_SCHEMATIC_WHITE}`,
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
    ...createOwnedSchematicRecordFields({
      altiumComponentRecordIndex: symbolMapping.altiumComponentRecordIndex,
      altiumPartId: symbolMapping.altiumPartId,
    }),
    `LOCATION.X=${altiumFirstCorner.x}`,
    `LOCATION.Y=${altiumFirstCorner.y}`,
    `CORNER.X=${altiumSecondCorner.x}`,
    `CORNER.Y=${altiumSecondCorner.y}`,
    "LINEWIDTH=1",
    `COLOR=${ALTIUM_SCHEMATIC_PRIMARY_COLOR}`,
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

export function createOwnedSchematicRecordFields({
  altiumComponentRecordIndex,
  altiumPartId,
}: CreateOwnedSchematicRecordFieldsParams): string[] {
  return [
    `OWNERINDEX=${altiumComponentRecordIndex}`,
    `OWNERPARTID=${altiumPartId}`,
    "OWNERPARTDISPLAYMODE=0",
  ]
}
