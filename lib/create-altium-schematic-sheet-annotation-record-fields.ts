import { sanitizeAltiumFieldText } from "altiumts"
import { getAltiumColorFromCss } from "./altium-color"
import type { AltiumSchematicFontTable } from "./create-altium-schematic-font-table"
import { asNumber, asPoint, asString, formatNumber } from "./format"
import {
  getAltiumSchematicTextJustification,
  getAltiumSchematicTextOrientation,
} from "./get-altium-schematic-text-presentation"
import { isSchematicSheetAnnotation } from "./is-schematic-sheet-annotation"
import type { CircuitElement, Point, PointTransform } from "./types"

type CreateAltiumSchematicSheetAnnotationRecordFieldsInput = {
  annotation: CircuitElement
  circuitToAltiumSchematicPoint: PointTransform
  fontTable: AltiumSchematicFontTable
}

const ALTIUM_UNITS_PER_CIRCUIT_UNIT = 20
const ALTIUM_SCHEMATIC_DEFAULT_COLOR = 0x37_29_1f
const ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR = 0xff_ff_ff

function getAltiumLineWidth(annotation: CircuitElement): string {
  return formatNumber(
    Math.max(asNumber(annotation.stroke_width), 0) *
      ALTIUM_UNITS_PER_CIRCUIT_UNIT,
  )
}

function getAltiumColor({
  annotation,
  colorFieldName,
  fallbackAltiumColor,
}: {
  annotation: CircuitElement
  colorFieldName: "color" | "fill_color" | "stroke_color"
  fallbackAltiumColor: number
}): number {
  return getAltiumColorFromCss({
    cssColor: asString(annotation[colorFieldName]),
    fallbackAltiumColor,
  })
}

function createTextRecordFields({
  annotation,
  circuitToAltiumSchematicPoint,
  fontTable,
}: CreateAltiumSchematicSheetAnnotationRecordFieldsInput):
  | string[]
  | undefined {
  const text = sanitizeAltiumFieldText(asString(annotation.text))
  const circuitPosition = asPoint(annotation.position)
  const fontSizeCircuitUnits = asNumber(annotation.font_size)
  const fontId = fontTable.fontIdBySizeCircuitUnits.get(fontSizeCircuitUnits)
  if (!text || !circuitPosition || !fontId) return undefined
  const altiumPosition = circuitToAltiumSchematicPoint(circuitPosition)

  return [
    "RECORD=4",
    `LOCATION.X=${altiumPosition.x}`,
    `LOCATION.Y=${altiumPosition.y}`,
    `FONTID=${fontId}`,
    `TEXT=${text}`,
    `COLOR=${getAltiumColor({ annotation, colorFieldName: "color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR })}`,
    `ORIENTATION=${getAltiumSchematicTextOrientation(asNumber(annotation.rotation))}`,
    `JUSTIFICATION=${getAltiumSchematicTextJustification(asString(annotation.anchor))}`,
  ]
}

function createRectRecordFields({
  annotation,
  circuitToAltiumSchematicPoint,
}: CreateAltiumSchematicSheetAnnotationRecordFieldsInput):
  | string[]
  | undefined {
  const circuitCenter = asPoint(annotation.center)
  const widthCircuitUnits = asNumber(annotation.width)
  const heightCircuitUnits = asNumber(annotation.height)
  if (!circuitCenter || widthCircuitUnits <= 0 || heightCircuitUnits <= 0) {
    return undefined
  }
  const firstCorner = circuitToAltiumSchematicPoint({
    x: circuitCenter.x - widthCircuitUnits / 2,
    y: circuitCenter.y - heightCircuitUnits / 2,
  })
  const secondCorner = circuitToAltiumSchematicPoint({
    x: circuitCenter.x + widthCircuitUnits / 2,
    y: circuitCenter.y + heightCircuitUnits / 2,
  })
  const altiumColor = getAltiumColor({
    annotation,
    colorFieldName: "color",
    fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR,
  })
  const isFilled = annotation.is_filled === true

  return [
    "RECORD=14",
    `LOCATION.X=${firstCorner.x}`,
    `LOCATION.Y=${firstCorner.y}`,
    `CORNER.X=${secondCorner.x}`,
    `CORNER.Y=${secondCorner.y}`,
    `LINEWIDTH=${getAltiumLineWidth(annotation)}`,
    `COLOR=${altiumColor}`,
    `AREACOLOR=${getAltiumColor({ annotation, colorFieldName: "fill_color", fallbackAltiumColor: isFilled ? altiumColor : ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR })}`,
    `ISSOLID=${isFilled ? "T" : "F"}`,
  ]
}

function createLineRecordFields({
  annotation,
  circuitToAltiumSchematicPoint,
}: CreateAltiumSchematicSheetAnnotationRecordFieldsInput): string[] {
  const altiumStart = circuitToAltiumSchematicPoint({
    x: asNumber(annotation.x1),
    y: asNumber(annotation.y1),
  })
  const altiumEnd = circuitToAltiumSchematicPoint({
    x: asNumber(annotation.x2),
    y: asNumber(annotation.y2),
  })

  return [
    "RECORD=13",
    `LOCATION.X=${altiumStart.x}`,
    `LOCATION.Y=${altiumStart.y}`,
    `CORNER.X=${altiumEnd.x}`,
    `CORNER.Y=${altiumEnd.y}`,
    `LINEWIDTH=${getAltiumLineWidth(annotation)}`,
    `LINESTYLE=${annotation.is_dashed === true ? 1 : 0}`,
    `COLOR=${getAltiumColor({ annotation, colorFieldName: "color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR })}`,
  ]
}

function createPathRecordFields({
  annotation,
  circuitToAltiumSchematicPoint,
}: CreateAltiumSchematicSheetAnnotationRecordFieldsInput):
  | string[]
  | undefined {
  if (!Array.isArray(annotation.points)) return undefined
  const circuitPoints = annotation.points.flatMap((point) => {
    const circuitPoint = asPoint(point)
    return circuitPoint ? [circuitPoint] : []
  })
  if (circuitPoints.length < 2) return undefined
  const altiumPoints: Point[] = circuitPoints.map(circuitToAltiumSchematicPoint)
  const isFilled = annotation.is_filled === true

  return [
    `RECORD=${isFilled ? 7 : 6}`,
    `LINEWIDTH=${getAltiumLineWidth(annotation)}`,
    `LOCATIONCOUNT=${altiumPoints.length}`,
    ...altiumPoints.flatMap((point, pointIndex) => [
      `X${pointIndex + 1}=${point.x}`,
      `Y${pointIndex + 1}=${point.y}`,
    ]),
    `COLOR=${getAltiumColor({ annotation, colorFieldName: "stroke_color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR })}`,
    ...(isFilled
      ? [
          `AREACOLOR=${getAltiumColor({ annotation, colorFieldName: "fill_color", fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR })}`,
          "ISSOLID=T",
        ]
      : []),
  ]
}

export function createAltiumSchematicSheetAnnotationRecordFields(
  input: CreateAltiumSchematicSheetAnnotationRecordFieldsInput,
): string[] | undefined {
  if (!isSchematicSheetAnnotation(input.annotation)) return undefined
  if (input.annotation.type === "schematic_text") {
    return createTextRecordFields(input)
  }
  if (input.annotation.type === "schematic_line") {
    return createLineRecordFields(input)
  }
  if (input.annotation.type === "schematic_rect") {
    return createRectRecordFields(input)
  }
  if (input.annotation.type === "schematic_path") {
    return createPathRecordFields(input)
  }
  return undefined
}
