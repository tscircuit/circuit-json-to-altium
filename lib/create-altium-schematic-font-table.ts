import {
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID,
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_NAME,
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS,
} from "./create-altium-schematic-off-sheet-port-record-fields"
import { asNumber, asString, formatNumber } from "./format"
import type { CircuitElement } from "./types"

type AltiumSchematicFontId = number
type SchematicFontSizeCircuitUnits = number

export type AltiumSchematicFontTable = {
  fontIdBySizeCircuitUnits: Map<
    SchematicFontSizeCircuitUnits,
    AltiumSchematicFontId
  >
  sheetRecordFields: string[]
}

type CreateAltiumSchematicFontTableInput = {
  schematicElements: CircuitElement[]
}

export const ALTIUM_FONT_POINTS_PER_CIRCUIT_UNIT = 20

export const ALTIUM_SCHEMATIC_COMPONENT_FONT_ID = 1
export const ALTIUM_SCHEMATIC_PIN_FONT_ID = 2
export const ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS = 4
export const ALTIUM_SCHEMATIC_PIN_FONT_SIZE_POINTS = 3
const ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME = "Arial"

function getAltiumFontSizePoints(fontSizeCircuitUnits: number): number {
  // Preserve the established Circuit JSON schematic text scale, but normalize
  // it at the SchDoc boundary. Real Altium viewers interpret fractional values
  // such as SIZE4=3.6 inconsistently and can render them much larger.
  return Math.max(
    1,
    Math.round(fontSizeCircuitUnits * ALTIUM_FONT_POINTS_PER_CIRCUIT_UNIT),
  )
}

export function createAltiumSchematicFontTable({
  schematicElements,
}: CreateAltiumSchematicFontTableInput): AltiumSchematicFontTable {
  const fontIdBySizeCircuitUnits = new Map<
    SchematicFontSizeCircuitUnits,
    AltiumSchematicFontId
  >()
  const arialFontIdBySizePoints = new Map<number, AltiumSchematicFontId>([
    [
      ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS,
      ALTIUM_SCHEMATIC_COMPONENT_FONT_ID,
    ],
    [ALTIUM_SCHEMATIC_PIN_FONT_SIZE_POINTS, ALTIUM_SCHEMATIC_PIN_FONT_ID],
  ])

  const schematicFontSizesCircuitUnits = [
    ...new Set(
      schematicElements.flatMap((element) => {
        const fontSizeCircuitUnits =
          element.type === "schematic_text" &&
          !asString(element.source_trace_id)
            ? asNumber(element.font_size)
            : 0
        return fontSizeCircuitUnits > 0 ? [fontSizeCircuitUnits] : []
      }),
    ),
  ].sort((left, right) => left - right)

  const schematicFontRecordFields: string[] = []
  let nextFontId = ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID + 1
  for (const fontSizeCircuitUnits of schematicFontSizesCircuitUnits) {
    const fontSizePoints = getAltiumFontSizePoints(fontSizeCircuitUnits)
    const existingFontId = arialFontIdBySizePoints.get(fontSizePoints)
    if (existingFontId !== undefined) {
      fontIdBySizeCircuitUnits.set(fontSizeCircuitUnits, existingFontId)
      continue
    }
    const fontId = nextFontId++
    fontIdBySizeCircuitUnits.set(fontSizeCircuitUnits, fontId)
    arialFontIdBySizePoints.set(fontSizePoints, fontId)
    schematicFontRecordFields.push(
      `SIZE${fontId}=${formatNumber(fontSizePoints)}`,
      `FONTNAME${fontId}=${ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME}`,
    )
  }

  return {
    fontIdBySizeCircuitUnits,
    sheetRecordFields: [
      `FONTIDCOUNT=${nextFontId - 1}`,
      `SIZE${ALTIUM_SCHEMATIC_COMPONENT_FONT_ID}=${ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS}`,
      `FONTNAME${ALTIUM_SCHEMATIC_COMPONENT_FONT_ID}=Arial`,
      `SIZE${ALTIUM_SCHEMATIC_PIN_FONT_ID}=${ALTIUM_SCHEMATIC_PIN_FONT_SIZE_POINTS}`,
      `FONTNAME${ALTIUM_SCHEMATIC_PIN_FONT_ID}=Arial`,
      `SIZE${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID}=${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS}`,
      `FONTNAME${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID}=${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_NAME}`,
      ...schematicFontRecordFields,
    ],
  }
}
