import { getAltiumColorFromCss } from "./altium-color"
import type { AltiumSchematicFontTable } from "./create-altium-schematic-font-table"
import { asNumber, asPoint, asString } from "./format"
import type { CircuitElement, Point, PointTransform } from "./types"

export type AltiumSchematicTextPresentation = {
  color: number
  fontId: number
  justification: number
  orientation: number
  position: Point
}

type GetAltiumSchematicTextPresentationInput = {
  circuitToAltiumSchematicPoint: PointTransform
  fallbackAltiumColor: number
  fallbackAltiumPosition: Point
  fallbackFontId: number
  fallbackJustification: number
  fontTable: AltiumSchematicFontTable
  schematicText: CircuitElement | undefined
}

const ALTIUM_JUSTIFICATION_BY_TEXT_ANCHOR: Record<string, number> = {
  bottom_left: 0,
  bottom_center: 1,
  bottom_right: 2,
  center_left: 3,
  center: 4,
  center_right: 5,
  top_left: 6,
  top_center: 7,
  top_right: 8,
}

export function getAltiumSchematicTextJustification(anchor: string): number {
  return ALTIUM_JUSTIFICATION_BY_TEXT_ANCHOR[anchor] ?? 0
}

export function getAltiumSchematicTextOrientation(
  rotationDegrees: number,
): number {
  const normalizedRotationDegrees = ((rotationDegrees % 360) + 360) % 360
  return normalizedRotationDegrees === 90 || normalizedRotationDegrees === 270
    ? 1
    : 0
}

export function getAltiumSchematicTextPresentation({
  circuitToAltiumSchematicPoint,
  fallbackAltiumColor,
  fallbackAltiumPosition,
  fallbackFontId,
  fallbackJustification,
  fontTable,
  schematicText,
}: GetAltiumSchematicTextPresentationInput): AltiumSchematicTextPresentation {
  const circuitPosition = asPoint(schematicText?.position)
  const fontSizeCircuitUnits = asNumber(schematicText?.font_size)
  return {
    color: getAltiumColorFromCss({
      cssColor: asString(schematicText?.color),
      fallbackAltiumColor,
    }),
    fontId:
      fontTable.fontIdBySizeCircuitUnits.get(fontSizeCircuitUnits) ??
      fallbackFontId,
    justification: schematicText
      ? getAltiumSchematicTextJustification(asString(schematicText.anchor))
      : fallbackJustification,
    orientation: getAltiumSchematicTextOrientation(
      asNumber(schematicText?.rotation),
    ),
    position: circuitPosition
      ? circuitToAltiumSchematicPoint(circuitPosition)
      : fallbackAltiumPosition,
  }
}
