import { asString, isCircuitElement, sanitizeField } from "./format"
import type { CircuitElement, Point } from "./types"

type CreateAltiumSchematicComponentParameterRecordFieldsInput = {
  altiumComponentRecordIndex: number
  altiumPosition: Point
  sourceComponent: CircuitElement | undefined
}

const SUPPLIER_PARAMETER_NAMES: Record<string, string> = {
  digikey: "DigiKey Part Number",
  jlcpcb: "JLCPCB Part Number",
  lcsc: "LCSC Part Number",
  macrofab: "MacroFab Part Number",
  mouser: "Mouser Part Number",
  pcbway: "PCBWay Part Number",
}

function createParameterRecordFields({
  altiumComponentRecordIndex,
  altiumPosition,
  name,
  text,
}: {
  altiumComponentRecordIndex: number
  altiumPosition: Point
  name: string
  text: string
}): string[] {
  return [
    "RECORD=41",
    `OWNERINDEX=${altiumComponentRecordIndex}`,
    "OWNERPARTID=-1",
    `LOCATION.X=${altiumPosition.x}`,
    `LOCATION.Y=${altiumPosition.y}`,
    "FONTID=1",
    `NAME=${name}`,
    `TEXT=${text}`,
    "SHOWNAME=F",
    "ISHIDDEN=T",
    "ORIENTATION=0",
    "JUSTIFICATION=0",
  ]
}

export function createAltiumSchematicComponentParameterRecordFields({
  altiumComponentRecordIndex,
  altiumPosition,
  sourceComponent,
}: CreateAltiumSchematicComponentParameterRecordFieldsInput): string[][] {
  if (!sourceComponent) return []

  const parameters: Array<{ name: string; text: string }> = []
  const manufacturerPartNumber = sanitizeField(
    sourceComponent.manufacturer_part_number,
  )
  if (manufacturerPartNumber) {
    parameters.push({
      name: "Manufacturer Part Number",
      text: manufacturerPartNumber,
    })
  }

  const supplierPartNumbers = sourceComponent.supplier_part_numbers
  if (isCircuitElement(supplierPartNumbers)) {
    for (const [supplierName, parameterName] of Object.entries(
      SUPPLIER_PARAMETER_NAMES,
    )) {
      const rawPartNumbers = supplierPartNumbers[supplierName]
      if (!Array.isArray(rawPartNumbers)) continue
      const partNumbers = rawPartNumbers
        .map((partNumber) => sanitizeField(asString(partNumber)))
        .filter(Boolean)
      if (partNumbers.length === 0) continue
      parameters.push({ name: parameterName, text: partNumbers.join(", ") })
    }
  }

  return parameters.map(({ name, text }) =>
    createParameterRecordFields({
      altiumComponentRecordIndex,
      altiumPosition,
      name,
      text,
    }),
  )
}
