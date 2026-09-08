import { getAltiumColorFromCss } from "./altium-color"
import { ALTIUM_SCHEMATIC_GRAPHIC_COLOR } from "./altium-schematic-colors"
import { createAltiumSchematicCoordinateFields } from "./create-altium-schematic-coordinate-fields"
import {
  type AltiumSchematicFontTable,
  SCHEMATIC_NET_LABEL_FONT_SIZE_CIRCUIT_UNITS,
} from "./create-altium-schematic-font-table"
import { asNumber, asString } from "./format"
import {
  getAltiumSchematicTextJustification,
  getAltiumSchematicTextOrientation,
} from "./get-altium-schematic-text-presentation"
import type { CircuitElement, Point } from "./types"

type AltiumPowerPortDirection = "down" | "left" | "right" | "up"
type AltiumPowerPortSymbolFamily = "ground" | "rail"

type AltiumPowerPortStyle = {
  orientationIndex: number
  styleIndex: number
}

type SchematicNetLabelRecordFieldsInput = {
  anchorSide: string
  altiumLabelPosition: Point
  fontTable: AltiumSchematicFontTable
  labelText: string
  symbolName: string
  textPresentation: CircuitElement | undefined
}

const ALTIUM_SCHEMATIC_POWER_PORT_FONT_ID = 2
const ALTIUM_SCHEMATIC_POWER_PORT_COLOR_INDEX = 132
const ALTIUM_JUSTIFICATION_BY_NET_LABEL_ANCHOR_SIDE: Record<string, number> = {
  bottom: 3,
  left: 3,
  right: 5,
  top: 5,
}

const ALTIUM_ORIENTATION_INDEX_BY_POWER_PORT_DIRECTION: Record<
  AltiumPowerPortDirection,
  number
> = {
  right: 0,
  up: 1,
  left: 2,
  down: 3,
}

const ALTIUM_STYLE_INDEX_BY_POWER_PORT_SYMBOL_FAMILY: Record<
  AltiumPowerPortSymbolFamily,
  number
> = {
  rail: 2,
  ground: 4,
}

function isAltiumPowerPortDirection(
  direction: string,
): direction is AltiumPowerPortDirection {
  return direction in ALTIUM_ORIENTATION_INDEX_BY_POWER_PORT_DIRECTION
}

function isAltiumPowerPortSymbolFamily(
  symbolFamily: string,
): symbolFamily is AltiumPowerPortSymbolFamily {
  return symbolFamily in ALTIUM_STYLE_INDEX_BY_POWER_PORT_SYMBOL_FAMILY
}

function getAltiumPowerPortStyle(
  symbolName: string,
): AltiumPowerPortStyle | undefined {
  const directionSeparatorIndex = symbolName.lastIndexOf("_")
  if (directionSeparatorIndex < 1) return undefined
  const symbolFamily = symbolName.slice(0, directionSeparatorIndex)
  const direction = symbolName.slice(directionSeparatorIndex + 1)
  if (
    !isAltiumPowerPortSymbolFamily(symbolFamily) ||
    !isAltiumPowerPortDirection(direction)
  ) {
    return undefined
  }
  return {
    orientationIndex:
      ALTIUM_ORIENTATION_INDEX_BY_POWER_PORT_DIRECTION[direction],
    styleIndex: ALTIUM_STYLE_INDEX_BY_POWER_PORT_SYMBOL_FAMILY[symbolFamily],
  }
}

export function createAltiumSchematicNetLabelRecordFields({
  anchorSide,
  altiumLabelPosition,
  fontTable,
  labelText,
  symbolName,
  textPresentation,
}: SchematicNetLabelRecordFieldsInput): string[][] {
  const powerPortStyle = getAltiumPowerPortStyle(symbolName)
  const fontId =
    fontTable.fontIdBySizeCircuitUnits.get(
      asNumber(textPresentation?.font_size),
    ) ??
    (powerPortStyle
      ? ALTIUM_SCHEMATIC_POWER_PORT_FONT_ID
      : (fontTable.fontIdBySizeCircuitUnits.get(
          SCHEMATIC_NET_LABEL_FONT_SIZE_CIRCUIT_UNITS,
        ) ?? ALTIUM_SCHEMATIC_POWER_PORT_FONT_ID))
  const color = getAltiumColorFromCss({
    cssColor: asString(textPresentation?.color),
    fallbackAltiumColor: powerPortStyle
      ? ALTIUM_SCHEMATIC_POWER_PORT_COLOR_INDEX
      : ALTIUM_SCHEMATIC_GRAPHIC_COLOR,
  })
  if (powerPortStyle) {
    return [
      [
        "RECORD=17",
        ...createAltiumSchematicCoordinateFields(
          "LOCATION.X",
          altiumLabelPosition.x,
        ),
        ...createAltiumSchematicCoordinateFields(
          "LOCATION.Y",
          altiumLabelPosition.y,
        ),
        `FONTID=${fontId}`,
        `ORIENTATION=${powerPortStyle.orientationIndex}`,
        `STYLE=${powerPortStyle.styleIndex}`,
        `COLOR=${color}`,
        "SHOWNETNAME=T",
        `TEXT=${labelText}`,
      ],
    ]
  }

  const nativeNetLabelFields = [
    "RECORD=25",
    ...createAltiumSchematicCoordinateFields(
      "LOCATION.X",
      altiumLabelPosition.x,
    ),
    ...createAltiumSchematicCoordinateFields(
      "LOCATION.Y",
      altiumLabelPosition.y,
    ),
    `FONTID=${fontId}`,
    `ORIENTATION=${textPresentation ? getAltiumSchematicTextOrientation(asNumber(textPresentation.rotation)) : anchorSide === "top" || anchorSide === "bottom" ? 1 : 0}`,
    `JUSTIFICATION=${
      textPresentation
        ? getAltiumSchematicTextJustification(asString(textPresentation.anchor))
        : (ALTIUM_JUSTIFICATION_BY_NET_LABEL_ANCHOR_SIDE[anchorSide] ?? 0)
    }`,
    `COLOR=${color}`,
    `TEXT=${labelText}`,
  ]
  // Net labels stay visible in Altium. A single native label at the wire
  // anchor carries both the displayed name and the electrical net identity.
  return [nativeNetLabelFields]
}
