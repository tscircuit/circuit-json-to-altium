import { getAltiumColorFromCss } from "./altium-color"
import {
  ALTIUM_SCHEMATIC_GRAPHIC_COLOR,
  ALTIUM_SCHEMATIC_SHEET_AREA_COLOR,
} from "./altium-schematic-colors"
import type { AltiumSchematicFontTable } from "./create-altium-schematic-font-table"
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
  altiumLabelCenter: Point
  altiumLabelPosition: Point
  decorationIndex: number
  fontTable: AltiumSchematicFontTable
  labelText: string
  symbolName: string
  textPresentation: CircuitElement | undefined
}

const ALTIUM_SCHEMATIC_LABEL_FONT_ID = 2
const ALTIUM_SCHEMATIC_POWER_PORT_COLOR_INDEX = 132
const ALTIUM_SCHEMATIC_NET_LABEL_HEIGHT = 4
const ALTIUM_SCHEMATIC_NET_LABEL_MINIMUM_WIDTH = 10
const ALTIUM_SCHEMATIC_NET_LABEL_POINT_DEPTH = 1
const ALTIUM_SCHEMATIC_NET_LABEL_TEXT_INSET = 2

type NetLabelAnchorSide = "bottom" | "left" | "right" | "top"

type NetLabelDisplayGeometry = {
  orientation: number
  outlinePoints: Point[]
  textJustification: number
  textPosition: Point
}

const NET_LABEL_GROWTH_DIRECTION_BY_ANCHOR_SIDE: Record<
  NetLabelAnchorSide,
  Point
> = {
  bottom: { x: 0, y: 1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  top: { x: 0, y: -1 },
}

const NET_LABEL_TEXT_PRESENTATION_BY_ANCHOR_SIDE: Record<
  NetLabelAnchorSide,
  { justification: number; orientation: number }
> = {
  bottom: { justification: 3, orientation: 1 },
  left: { justification: 3, orientation: 0 },
  right: { justification: 5, orientation: 0 },
  top: { justification: 5, orientation: 3 },
}

const ALTIUM_JUSTIFICATION_BY_NET_LABEL_ANCHOR_SIDE: Record<string, number> = {
  bottom: 1,
  left: 3,
  right: 5,
  top: 7,
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

function isNetLabelAnchorSide(value: string): value is NetLabelAnchorSide {
  return value in NET_LABEL_GROWTH_DIRECTION_BY_ANCHOR_SIDE
}

function getNetLabelDecorationUniqueId(
  decorationIndex: number,
  decorationKind: "P" | "T",
): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXY"
  let remainingIndex = Math.max(Math.floor(decorationIndex), 0)
  let encodedIndex = ""
  for (let digitIndex = 0; digitIndex < 4; digitIndex++) {
    encodedIndex = alphabet[remainingIndex % alphabet.length] + encodedIndex
    remainingIndex = Math.floor(remainingIndex / alphabet.length)
  }
  return `CJN${decorationKind}${encodedIndex}`
}

function getNetLabelDisplayGeometry({
  altiumLabelCenter,
  altiumLabelPosition,
  anchorSide,
  labelText,
}: Pick<
  SchematicNetLabelRecordFieldsInput,
  "altiumLabelCenter" | "altiumLabelPosition" | "anchorSide" | "labelText"
>): NetLabelDisplayGeometry | undefined {
  if (!isNetLabelAnchorSide(anchorSide)) return undefined

  const direction = NET_LABEL_GROWTH_DIRECTION_BY_ANCHOR_SIDE[anchorSide]
  const centerOffset = {
    x: altiumLabelCenter.x - altiumLabelPosition.x,
    y: altiumLabelCenter.y - altiumLabelPosition.y,
  }
  const projectedHalfWidth =
    centerOffset.x * direction.x + centerOffset.y * direction.y
  const estimatedWidth = Math.max(
    labelText.length * 2 + 6,
    ALTIUM_SCHEMATIC_NET_LABEL_MINIMUM_WIDTH,
  )
  const width =
    projectedHalfWidth > 0
      ? Math.max(
          projectedHalfWidth * 2,
          ALTIUM_SCHEMATIC_NET_LABEL_MINIMUM_WIDTH,
        )
      : estimatedWidth
  const perpendicular = { x: -direction.y, y: direction.x }
  const point = (along: number, across = 0): Point => ({
    x: altiumLabelPosition.x + direction.x * along + perpendicular.x * across,
    y: altiumLabelPosition.y + direction.y * along + perpendicular.y * across,
  })
  const halfHeight = ALTIUM_SCHEMATIC_NET_LABEL_HEIGHT / 2
  const textPresentation =
    NET_LABEL_TEXT_PRESENTATION_BY_ANCHOR_SIDE[anchorSide]

  return {
    orientation: textPresentation.orientation,
    outlinePoints: [
      point(0),
      point(ALTIUM_SCHEMATIC_NET_LABEL_POINT_DEPTH, halfHeight),
      point(width, halfHeight),
      point(width, -halfHeight),
      point(ALTIUM_SCHEMATIC_NET_LABEL_POINT_DEPTH, -halfHeight),
    ],
    textJustification: textPresentation.justification,
    textPosition: point(ALTIUM_SCHEMATIC_NET_LABEL_TEXT_INSET),
  }
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
  altiumLabelCenter,
  altiumLabelPosition,
  decorationIndex,
  fontTable,
  labelText,
  symbolName,
  textPresentation,
}: SchematicNetLabelRecordFieldsInput): string[][] {
  const powerPortStyle = getAltiumPowerPortStyle(symbolName)
  const fontId =
    fontTable.fontIdBySizeCircuitUnits.get(
      asNumber(textPresentation?.font_size),
    ) ?? ALTIUM_SCHEMATIC_LABEL_FONT_ID
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
        `LOCATION.X=${altiumLabelPosition.x}`,
        `LOCATION.Y=${altiumLabelPosition.y}`,
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
    `LOCATION.X=${altiumLabelPosition.x}`,
    `LOCATION.Y=${altiumLabelPosition.y}`,
    `FONTID=${fontId}`,
    `ORIENTATION=${getAltiumSchematicTextOrientation(asNumber(textPresentation?.rotation))}`,
    `JUSTIFICATION=${
      textPresentation
        ? getAltiumSchematicTextJustification(asString(textPresentation.anchor))
        : (ALTIUM_JUSTIFICATION_BY_NET_LABEL_ANCHOR_SIDE[anchorSide] ?? 0)
    }`,
    `COLOR=${color}`,
    `TEXT=${labelText}`,
  ]
  const displayGeometry = getNetLabelDisplayGeometry({
    altiumLabelCenter,
    altiumLabelPosition,
    anchorSide,
    labelText,
  })
  if (!displayGeometry) return [nativeNetLabelFields]

  // A native Altium net label only paints text. Keep it hidden at the wire
  // anchor for net identity, then reproduce Circuit JSON's pointed label body
  // with ordinary schematic graphics.
  return [
    [...nativeNetLabelFields, "ISHIDDEN=T"],
    [
      "RECORD=7",
      "OWNERPARTID=-1",
      "LINEWIDTH=1",
      `LOCATIONCOUNT=${displayGeometry.outlinePoints.length}`,
      ...displayGeometry.outlinePoints.flatMap((point, pointIndex) => [
        `X${pointIndex + 1}=${point.x}`,
        `Y${pointIndex + 1}=${point.y}`,
      ]),
      `COLOR=${color}`,
      `AREACOLOR=${ALTIUM_SCHEMATIC_SHEET_AREA_COLOR}`,
      "ISSOLID=T",
      `UNIQUEID=${getNetLabelDecorationUniqueId(decorationIndex, "P")}`,
    ],
    [
      "RECORD=4",
      "OWNERPARTID=-1",
      `LOCATION.X=${displayGeometry.textPosition.x}`,
      `LOCATION.Y=${displayGeometry.textPosition.y}`,
      `FONTID=${fontId}`,
      `ORIENTATION=${displayGeometry.orientation}`,
      `JUSTIFICATION=${displayGeometry.textJustification}`,
      `COLOR=${color}`,
      `TEXT=${labelText}`,
      `UNIQUEID=${getNetLabelDecorationUniqueId(decorationIndex, "T")}`,
    ],
  ]
}
