import { getAltiumColorFromCss } from "./altium-color"
import { createOwnedSchematicRecordFields } from "./create-altium-schematic-graphic-record-fields"
import { asNumber, asPoint, asString, formatNumber } from "./format"
import { isSchematicSymbolPrimitive } from "./is-schematic-symbol-primitive"
import type {
  AltiumPartId,
  CircuitElement,
  LengthTransform,
  PointTransform,
} from "./types"

type CreateAltiumSchematicSymbolPrimitiveRecordFieldsInput = {
  altiumComponentRecordIndex: number
  altiumPartId: AltiumPartId
  circuitToAltiumSchematicLength: LengthTransform
  circuitToAltiumSchematicPoint: PointTransform
  graphic: CircuitElement
}

const ALTIUM_SCHEMATIC_DEFAULT_COLOR = 0x37_29_1f
const ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR = 0xff_ff_ff

function getAltiumLineWidth({
  circuitToAltiumSchematicLength,
  graphic,
}: {
  circuitToAltiumSchematicLength: LengthTransform
  graphic: CircuitElement
}): string {
  return formatNumber(
    Math.max(
      1,
      circuitToAltiumSchematicLength(
        Math.max(asNumber(graphic.stroke_width), 0),
      ),
    ),
  )
}

function getAltiumColor({
  colorFieldName,
  fallbackAltiumColor,
  graphic,
}: {
  colorFieldName: "color" | "fill_color" | "stroke_color"
  fallbackAltiumColor: number
  graphic: CircuitElement
}): number {
  return getAltiumColorFromCss({
    cssColor: asString(graphic[colorFieldName]),
    fallbackAltiumColor,
  })
}

function getOwnedGraphicRecordFields({
  altiumComponentRecordIndex,
  altiumPartId,
  circuitToAltiumSchematicLength,
  graphic,
}: {
  altiumComponentRecordIndex: number
  altiumPartId: AltiumPartId
  circuitToAltiumSchematicLength: LengthTransform
  graphic: CircuitElement
}): string[] {
  return [
    ...createOwnedSchematicRecordFields({
      altiumComponentRecordIndex,
      altiumPartId,
    }),
    `LINEWIDTH=${getAltiumLineWidth({ circuitToAltiumSchematicLength, graphic })}`,
    `LINESTYLE=${graphic.is_dashed === true ? 1 : 0}`,
  ]
}

function getAltiumRadius({
  circuitToAltiumSchematicLength,
  radius,
}: {
  circuitToAltiumSchematicLength: LengthTransform
  radius: number
}): number {
  return Math.max(1, circuitToAltiumSchematicLength(radius))
}

function createPathRecordFields({
  altiumComponentRecordIndex,
  altiumPartId,
  circuitToAltiumSchematicLength,
  circuitToAltiumSchematicPoint,
  graphic,
}: CreateAltiumSchematicSymbolPrimitiveRecordFieldsInput):
  | string[]
  | undefined {
  if (!Array.isArray(graphic.points)) return undefined
  const circuitPoints = graphic.points.flatMap((point) => {
    const circuitPoint = asPoint(point)
    return circuitPoint ? [circuitPoint] : []
  })
  if (circuitPoints.length < 2) return undefined
  const altiumPoints = circuitPoints.map(circuitToAltiumSchematicPoint)
  const isFilled = graphic.is_filled === true
  return [
    `RECORD=${isFilled ? 7 : 6}`,
    ...getOwnedGraphicRecordFields({
      altiumComponentRecordIndex,
      altiumPartId,
      circuitToAltiumSchematicLength,
      graphic,
    }),
    `LOCATIONCOUNT=${altiumPoints.length}`,
    ...altiumPoints.flatMap((point, pointIndex) => [
      `X${pointIndex + 1}=${point.x}`,
      `Y${pointIndex + 1}=${point.y}`,
    ]),
    `COLOR=${getAltiumColor({ graphic, colorFieldName: "stroke_color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR })}`,
    ...(isFilled
      ? [
          `AREACOLOR=${getAltiumColor({ graphic, colorFieldName: "fill_color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR })}`,
          "ISSOLID=T",
        ]
      : []),
  ]
}

function createCircleRecordFields({
  altiumComponentRecordIndex,
  altiumPartId,
  circuitToAltiumSchematicLength,
  circuitToAltiumSchematicPoint,
  graphic,
}: CreateAltiumSchematicSymbolPrimitiveRecordFieldsInput):
  | string[]
  | undefined {
  const center = asPoint(graphic.center)
  const radius = asNumber(graphic.radius)
  if (!center || radius <= 0) return undefined
  const altiumCenter = circuitToAltiumSchematicPoint(center)
  const isFilled = graphic.is_filled === true
  return [
    "RECORD=8",
    ...getOwnedGraphicRecordFields({
      altiumComponentRecordIndex,
      altiumPartId,
      circuitToAltiumSchematicLength,
      graphic,
    }),
    `LOCATION.X=${altiumCenter.x}`,
    `LOCATION.Y=${altiumCenter.y}`,
    `RADIUS=${formatNumber(getAltiumRadius({ circuitToAltiumSchematicLength, radius }))}`,
    `SECONDARYRADIUS=${formatNumber(getAltiumRadius({ circuitToAltiumSchematicLength, radius }))}`,
    `COLOR=${getAltiumColor({ graphic, colorFieldName: "color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR })}`,
    `AREACOLOR=${getAltiumColor({ graphic, colorFieldName: "fill_color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR })}`,
    `ISSOLID=${isFilled ? "T" : "F"}`,
  ]
}

function createArcRecordFields({
  altiumComponentRecordIndex,
  altiumPartId,
  circuitToAltiumSchematicLength,
  circuitToAltiumSchematicPoint,
  graphic,
}: CreateAltiumSchematicSymbolPrimitiveRecordFieldsInput):
  | string[]
  | undefined {
  const center = asPoint(graphic.center)
  const radius = asNumber(graphic.radius)
  if (!center || radius <= 0) return undefined
  const altiumCenter = circuitToAltiumSchematicPoint(center)
  const startAngleDegrees = asNumber(graphic.start_angle_degrees)
  const endAngleDegrees = asNumber(graphic.end_angle_degrees)
  const isClockwise = asString(graphic.direction) === "clockwise"
  return [
    "RECORD=12",
    ...getOwnedGraphicRecordFields({
      altiumComponentRecordIndex,
      altiumPartId,
      circuitToAltiumSchematicLength,
      graphic,
    }),
    `LOCATION.X=${altiumCenter.x}`,
    `LOCATION.Y=${altiumCenter.y}`,
    `RADIUS=${formatNumber(getAltiumRadius({ circuitToAltiumSchematicLength, radius }))}`,
    `STARTANGLE=${formatNumber(isClockwise ? endAngleDegrees : startAngleDegrees)}`,
    `ENDANGLE=${formatNumber(isClockwise ? startAngleDegrees : endAngleDegrees)}`,
    `COLOR=${getAltiumColor({ graphic, colorFieldName: "color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR })}`,
  ]
}

function createLineRecordFields({
  altiumComponentRecordIndex,
  altiumPartId,
  circuitToAltiumSchematicLength,
  circuitToAltiumSchematicPoint,
  graphic,
}: CreateAltiumSchematicSymbolPrimitiveRecordFieldsInput): string[] {
  const altiumStart = circuitToAltiumSchematicPoint({
    x: asNumber(graphic.x1),
    y: asNumber(graphic.y1),
  })
  const altiumEnd = circuitToAltiumSchematicPoint({
    x: asNumber(graphic.x2),
    y: asNumber(graphic.y2),
  })
  return [
    "RECORD=13",
    ...getOwnedGraphicRecordFields({
      altiumComponentRecordIndex,
      altiumPartId,
      circuitToAltiumSchematicLength,
      graphic,
    }),
    `LOCATION.X=${altiumStart.x}`,
    `LOCATION.Y=${altiumStart.y}`,
    `CORNER.X=${altiumEnd.x}`,
    `CORNER.Y=${altiumEnd.y}`,
    `COLOR=${getAltiumColor({ graphic, colorFieldName: "color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR })}`,
  ]
}

function createRectRecordFields({
  altiumComponentRecordIndex,
  altiumPartId,
  circuitToAltiumSchematicLength,
  circuitToAltiumSchematicPoint,
  graphic,
}: CreateAltiumSchematicSymbolPrimitiveRecordFieldsInput):
  | string[]
  | undefined {
  const center = asPoint(graphic.center)
  const width = asNumber(graphic.width)
  const height = asNumber(graphic.height)
  const normalizedRotationDegrees =
    ((asNumber(graphic.rotation) % 360) + 360) % 360
  if (!center || width <= 0 || height <= 0 || normalizedRotationDegrees !== 0) {
    return undefined
  }
  const altiumFirstCorner = circuitToAltiumSchematicPoint({
    x: center.x - width / 2,
    y: center.y - height / 2,
  })
  const altiumSecondCorner = circuitToAltiumSchematicPoint({
    x: center.x + width / 2,
    y: center.y + height / 2,
  })
  const isFilled = graphic.is_filled === true
  return [
    "RECORD=14",
    ...getOwnedGraphicRecordFields({
      altiumComponentRecordIndex,
      altiumPartId,
      circuitToAltiumSchematicLength,
      graphic,
    }),
    `LOCATION.X=${altiumFirstCorner.x}`,
    `LOCATION.Y=${altiumFirstCorner.y}`,
    `CORNER.X=${altiumSecondCorner.x}`,
    `CORNER.Y=${altiumSecondCorner.y}`,
    `COLOR=${getAltiumColor({ graphic, colorFieldName: "color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR })}`,
    `AREACOLOR=${getAltiumColor({ graphic, colorFieldName: "fill_color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR })}`,
    `ISSOLID=${isFilled ? "T" : "F"}`,
  ]
}

export function createAltiumSchematicSymbolPrimitiveRecordFields(
  input: CreateAltiumSchematicSymbolPrimitiveRecordFieldsInput,
): string[] | undefined {
  if (!isSchematicSymbolPrimitive(input.graphic)) return undefined
  if (input.graphic.type === "schematic_path") {
    return createPathRecordFields(input)
  }
  if (input.graphic.type === "schematic_circle") {
    return createCircleRecordFields(input)
  }
  if (input.graphic.type === "schematic_arc") {
    return createArcRecordFields(input)
  }
  if (input.graphic.type === "schematic_line") {
    return createLineRecordFields(input)
  }
  if (input.graphic.type === "schematic_rect") {
    return createRectRecordFields(input)
  }
  return undefined
}
