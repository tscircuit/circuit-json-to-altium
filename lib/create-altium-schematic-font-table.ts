import {
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID,
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_NAME,
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS,
} from "./create-altium-schematic-off-sheet-port-record-fields"
import { asNumber, formatNumber } from "./format"
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

const ALTIUM_UNITS_PER_CIRCUIT_UNIT = 20
const ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS = 4
const ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME = "Arial"

export function createAltiumSchematicFontTable({
  schematicElements,
}: CreateAltiumSchematicFontTableInput): AltiumSchematicFontTable {
  const fontIdBySizeCircuitUnits = new Map<
    SchematicFontSizeCircuitUnits,
    AltiumSchematicFontId
  >()
  const offSheetPortFontSizeCircuitUnits =
    ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS /
    ALTIUM_UNITS_PER_CIRCUIT_UNIT
  fontIdBySizeCircuitUnits.set(
    offSheetPortFontSizeCircuitUnits,
    ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID,
  )

  const schematicFontSizesCircuitUnits = [
    ...new Set(
      schematicElements.flatMap((element) => {
        const fontSizeCircuitUnits =
          element.type === "schematic_text" ? asNumber(element.font_size) : 0
        return fontSizeCircuitUnits > 0 ? [fontSizeCircuitUnits] : []
      }),
    ),
  ].sort((left, right) => left - right)

  const schematicFontRecordFields: string[] = []
  let nextFontId = ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID + 1
  for (const fontSizeCircuitUnits of schematicFontSizesCircuitUnits) {
    if (fontIdBySizeCircuitUnits.has(fontSizeCircuitUnits)) continue
    const fontId = nextFontId++
    fontIdBySizeCircuitUnits.set(fontSizeCircuitUnits, fontId)
    schematicFontRecordFields.push(
      `SIZE${fontId}=${formatNumber(fontSizeCircuitUnits * ALTIUM_UNITS_PER_CIRCUIT_UNIT)}`,
      `FONTNAME${fontId}=${ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME}`,
    )
  }

  return {
    fontIdBySizeCircuitUnits,
    sheetRecordFields: [
      `FONTIDCOUNT=${nextFontId - 1}`,
      `SIZE1=${ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS}`,
      "FONTNAME1=Arial",
      `SIZE2=${ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS}`,
      "FONTNAME2=Arial",
      `SIZE${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID}=${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS}`,
      `FONTNAME${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID}=${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_NAME}`,
      ...schematicFontRecordFields,
    ],
  }
}
