import type { AltiumSchematicFontTable } from "./create-altium-schematic-font-table"
import { asString, sanitizeField } from "./format"
import { getAltiumSchematicTextPresentation } from "./get-altium-schematic-text-presentation"
import type { CircuitElement, PointTransform } from "./types"

type CreateAltiumSchematicTextRecordFieldsInput = {
  altiumComponentRecordIndex: number
  circuitToAltiumSchematicPoint: PointTransform
  fontTable: AltiumSchematicFontTable
  schematicText: CircuitElement
}

const ALTIUM_SCHEMATIC_DEFAULT_COLOR = 0x37_29_1f

export function createAltiumSchematicTextRecordFields({
  altiumComponentRecordIndex,
  circuitToAltiumSchematicPoint,
  fontTable,
  schematicText,
}: CreateAltiumSchematicTextRecordFieldsInput): string[] | undefined {
  const text = sanitizeField(asString(schematicText.text))
  if (!text) return undefined
  const presentation = getAltiumSchematicTextPresentation({
    circuitToAltiumSchematicPoint,
    fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR,
    fallbackAltiumPosition: { x: 0, y: 0 },
    fallbackFontId: 2,
    fallbackJustification: 0,
    fontTable,
    schematicText,
  })
  return [
    "RECORD=4",
    `OWNERINDEX=${altiumComponentRecordIndex}`,
    "OWNERPARTID=1",
    `LOCATION.X=${presentation.position.x}`,
    `LOCATION.Y=${presentation.position.y}`,
    `FONTID=${presentation.fontId}`,
    `TEXT=${text}`,
    `COLOR=${presentation.color}`,
    `ORIENTATION=${presentation.orientation}`,
    `JUSTIFICATION=${presentation.justification}`,
  ]
}
