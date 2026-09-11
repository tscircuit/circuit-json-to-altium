import {
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID,
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_NAME,
  ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS,
} from "./create-altium-schematic-off-sheet-port-record-fields"
import type { AltiumSchematicTemplateFontFields } from "./extract-altium-schematic-template"
import { asNumber, asPositiveNumber, asString, formatNumber } from "./format"
import type { CircuitElement } from "./types"

type AltiumSchematicFontId = number
type SchematicFontSizeCircuitUnits = number

export type AltiumSchematicFontTable = {
  nativeTextFontIdBySizeCircuitUnits: Map<
    SchematicFontSizeCircuitUnits,
    AltiumSchematicFontId
  >
  fontIdBySizeCircuitUnits: Map<
    SchematicFontSizeCircuitUnits,
    AltiumSchematicFontId
  >
  fontSizePointsById: Map<AltiumSchematicFontId, number>
  sheetRecordFields: string[]
  templateFontIdBySourceFontId: Map<
    AltiumSchematicFontId,
    AltiumSchematicFontId
  >
}

type CreateAltiumSchematicFontTableInput = {
  netLabelTextPresentations?: CircuitElement[]
  schematicElements: CircuitElement[]
  templateFontFields?: AltiumSchematicTemplateFontFields[]
}

const ALTIUM_UNITS_PER_CIRCUIT_UNIT = 20
const ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS = 4
const ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME = "Arial"
// Circuit JSON renders ordinary net labels at 0.18 circuit units.
export const SCHEMATIC_NET_LABEL_FONT_SIZE_CIRCUIT_UNITS = 0.18
// Match Circuit JSON's default pin-name size; numbers remain at 4 pt.
export const SCHEMATIC_PIN_NAME_FONT_SIZE_CIRCUIT_UNITS = 0.15
export const SCHEMATIC_PIN_NUMBER_FONT_SIZE_CIRCUIT_UNITS = 0.2

export function createAltiumSchematicFontTable({
  netLabelTextPresentations = [],
  schematicElements,
  templateFontFields = [],
}: CreateAltiumSchematicFontTableInput): AltiumSchematicFontTable {
  const fontIdBySizeCircuitUnits = new Map<
    SchematicFontSizeCircuitUnits,
    AltiumSchematicFontId
  >()
  const fontSizePointsById = new Map([
    [1, ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS],
    [2, ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS],
    [
      ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID,
      ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS,
    ],
  ])
  const offSheetPortFontSizeCircuitUnits =
    ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS /
    ALTIUM_UNITS_PER_CIRCUIT_UNIT
  fontIdBySizeCircuitUnits.set(
    offSheetPortFontSizeCircuitUnits,
    ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID,
  )
  const hasNetLabels = schematicElements.some(
    (element) => element.type === "schematic_net_label",
  )
  const schematicFontSizesCircuitUnits = [
    ...new Set([
      ...(hasNetLabels ? [SCHEMATIC_NET_LABEL_FONT_SIZE_CIRCUIT_UNITS] : []),
      ...schematicElements.flatMap((element) => {
        const fontSizeCircuitUnits =
          element.type === "schematic_text" ? asNumber(element.font_size) : 0
        return fontSizeCircuitUnits > 0 ? [fontSizeCircuitUnits] : []
      }),
    ]),
  ].sort((left, right) => left - right)

  const schematicFontRecordFields: string[] = []
  let nextFontId = ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID + 1
  for (const fontSizeCircuitUnits of schematicFontSizesCircuitUnits) {
    if (fontIdBySizeCircuitUnits.has(fontSizeCircuitUnits)) continue
    const fontId = nextFontId++
    fontIdBySizeCircuitUnits.set(fontSizeCircuitUnits, fontId)
    fontSizePointsById.set(
      fontId,
      fontSizeCircuitUnits * ALTIUM_UNITS_PER_CIRCUIT_UNIT,
    )
    schematicFontRecordFields.push(
      `SIZE${fontId}=${formatNumber(fontSizeCircuitUnits * ALTIUM_UNITS_PER_CIRCUIT_UNIT)}`,
      `FONTNAME${fontId}=${ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME}`,
    )
  }

  const templateFontIdBySourceFontId = new Map<
    AltiumSchematicFontId,
    AltiumSchematicFontId
  >()
  for (const templateFont of templateFontFields) {
    const fontId = nextFontId++
    templateFontIdBySourceFontId.set(templateFont.sourceFontId, fontId)
    schematicFontRecordFields.push(
      ...templateFont.fields.map((field) =>
        field.replace(/^(\w+?)\d+=/u, `$1${fontId}=`),
      ),
    )
  }

  const nativeTextFontIdBySizeCircuitUnits = new Map(fontIdBySizeCircuitUnits)
  const nativeTextFontIdBySizePoints = new Map([
    [ALTIUM_SCHEMATIC_COMPONENT_FONT_SIZE_POINTS, 1],
  ])
  for (const [fontId, points] of fontSizePointsById) {
    // Only reuse the generated Arial fonts, not the off-sheet port font.
    if (
      fontId > ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID &&
      Number.isInteger(points)
    ) {
      nativeTextFontIdBySizePoints.set(points, fontId)
    }
  }
  const nativeTextSizesCircuitUnits = [
    ...schematicElements.flatMap((text) =>
      text.type === "schematic_text" ? [asNumber(text.font_size)] : [],
    ),
    ...(hasNetLabels ? [SCHEMATIC_NET_LABEL_FONT_SIZE_CIRCUIT_UNITS] : []),
    ...netLabelTextPresentations.map((text) => asNumber(text.font_size)),
    ...schematicElements.flatMap((port) =>
      port.type === "schematic_port" && asString(port.schematic_component_id)
        ? [
            SCHEMATIC_PIN_NUMBER_FONT_SIZE_CIRCUIT_UNITS,
            asPositiveNumber(
              port.display_pin_label_font_size,
              SCHEMATIC_PIN_NAME_FONT_SIZE_CIRCUIT_UNITS,
            ),
          ]
        : [],
    ),
  ]
  for (const size of nativeTextSizesCircuitUnits) {
    if (size <= 0) continue
    const existingFontId = nativeTextFontIdBySizeCircuitUnits.get(size)
    if (
      existingFontId !== undefined &&
      Number.isInteger(fontSizePointsById.get(existingFontId))
    ) {
      continue
    }
    // Generated text, including custom-symbol primitives, uses integer points.
    // For example, 0.18 becomes Arial 4, and inline labels at 0.12 become Arial 3.
    const points = Math.max(
      1,
      Math.ceil(Number(formatNumber(size * ALTIUM_UNITS_PER_CIRCUIT_UNIT))),
    )
    let fontId = nativeTextFontIdBySizePoints.get(points)
    if (fontId === undefined) {
      fontId = nextFontId++
      nativeTextFontIdBySizePoints.set(points, fontId)
      fontSizePointsById.set(fontId, points)
      schematicFontRecordFields.push(
        `SIZE${fontId}=${points}`,
        `FONTNAME${fontId}=${ALTIUM_SCHEMATIC_ANNOTATION_FONT_NAME}`,
      )
    }
    nativeTextFontIdBySizeCircuitUnits.set(size, fontId)
  }

  return {
    nativeTextFontIdBySizeCircuitUnits,
    fontIdBySizeCircuitUnits,
    fontSizePointsById,
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
    templateFontIdBySourceFontId,
  }
}
