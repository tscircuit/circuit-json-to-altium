import {
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID,
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_NAME,
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS,
} from "./create-altium-schematic-off-sheet-port-record-fields"
import { asNumber, asString, formatNumber, sanitizeField } from "./format"
import type { CircuitElement } from "./types"

type AltiumSchematicFontId = number
type AltiumSchematicFontKey = string & {
  readonly __brand: "AltiumSchematicFontKey"
}

type SchematicFontPresentation = {
  fontFamily: string
  fontSizeCircuitUnits: number
  fontStyle: "italic" | "normal"
  fontWeight: "bold" | "normal"
}

export type AltiumSchematicFontTable = {
  fontIdByPresentation: Map<AltiumSchematicFontKey, AltiumSchematicFontId>
  sheetRecordFields: string[]
}

type CreateAltiumSchematicFontTableInput = {
  schematicElements: CircuitElement[]
}

const ALTIUM_UNITS_PER_CIRCUIT_UNIT = 20
const ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS = 4
const ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME = "Arial"

function getSchematicFontPresentation(
  schematicText: CircuitElement | undefined,
): SchematicFontPresentation {
  return {
    fontFamily:
      asString(schematicText?.font_family) ||
      ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME,
    fontSizeCircuitUnits: asNumber(schematicText?.font_size),
    fontStyle:
      asString(schematicText?.font_style) === "italic" ? "italic" : "normal",
    fontWeight:
      asString(schematicText?.font_weight) === "bold" ? "bold" : "normal",
  }
}

function getSchematicFontKey({
  fontFamily,
  fontSizeCircuitUnits,
  fontStyle,
  fontWeight,
}: SchematicFontPresentation): AltiumSchematicFontKey {
  return [fontFamily, fontSizeCircuitUnits, fontStyle, fontWeight].join(
    "\u0000",
  ) as AltiumSchematicFontKey
}

export function getAltiumSchematicFontId({
  fallbackFontId,
  fontTable,
  schematicText,
}: {
  fallbackFontId: number
  fontTable: AltiumSchematicFontTable
  schematicText: CircuitElement | undefined
}): number {
  return (
    fontTable.fontIdByPresentation.get(
      getSchematicFontKey(getSchematicFontPresentation(schematicText)),
    ) ?? fallbackFontId
  )
}

export function createAltiumSchematicFontTable({
  schematicElements,
}: CreateAltiumSchematicFontTableInput): AltiumSchematicFontTable {
  const fontIdByPresentation = new Map<
    AltiumSchematicFontKey,
    AltiumSchematicFontId
  >()
  const offSheetPortFontSizeCircuitUnits =
    ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS /
    ALTIUM_UNITS_PER_CIRCUIT_UNIT
  fontIdByPresentation.set(
    getSchematicFontKey({
      fontFamily: ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_NAME,
      fontSizeCircuitUnits: offSheetPortFontSizeCircuitUnits,
      fontStyle: "normal",
      fontWeight: "normal",
    }),
    ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID,
  )

  const schematicFontsByKey = new Map<
    AltiumSchematicFontKey,
    SchematicFontPresentation
  >()
  for (const element of schematicElements) {
    if (element.type !== "schematic_text") continue
    const fontPresentation = getSchematicFontPresentation(element)
    if (fontPresentation.fontSizeCircuitUnits <= 0) continue
    schematicFontsByKey.set(
      getSchematicFontKey(fontPresentation),
      fontPresentation,
    )
  }
  const schematicFonts = [...schematicFontsByKey.values()].sort(
    (left, right) =>
      left.fontSizeCircuitUnits - right.fontSizeCircuitUnits ||
      left.fontFamily.localeCompare(right.fontFamily) ||
      left.fontWeight.localeCompare(right.fontWeight) ||
      left.fontStyle.localeCompare(right.fontStyle),
  )

  const schematicFontRecordFields: string[] = []
  let nextFontId = ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID + 1
  for (const fontPresentation of schematicFonts) {
    const fontKey = getSchematicFontKey(fontPresentation)
    if (fontIdByPresentation.has(fontKey)) continue
    const fontId = nextFontId++
    fontIdByPresentation.set(fontKey, fontId)
    schematicFontRecordFields.push(
      `SIZE${fontId}=${formatNumber(fontPresentation.fontSizeCircuitUnits * ALTIUM_UNITS_PER_CIRCUIT_UNIT)}`,
      `FONTNAME${fontId}=${sanitizeField(fontPresentation.fontFamily)}`,
      `BOLD${fontId}=${fontPresentation.fontWeight === "bold" ? "T" : "F"}`,
      `ITALIC${fontId}=${fontPresentation.fontStyle === "italic" ? "T" : "F"}`,
    )
  }

  return {
    fontIdByPresentation,
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
