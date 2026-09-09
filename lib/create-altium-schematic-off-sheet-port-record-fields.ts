import type { Point } from "./types"

type SchematicOffSheetPortRecordFieldsInput = {
  altiumPortPosition: Point
  facingDirection: string
  hasInputArrow: boolean
  hasOutputArrow: boolean
  portName: string
}

const ALTIUM_SCHEMATIC_PORT_AREA_COLOR = 16777215
const ALTIUM_SCHEMATIC_PORT_COLOR = 16711680
const ALTIUM_SCHEMATIC_PORT_MINIMUM_WIDTH = 16
const ALTIUM_SCHEMATIC_PORT_TEXT_CHARACTER_WIDTH = 8

export const ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID = 3
export const ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_NAME = "Times New Roman"
export const ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_SIZE_POINTS = 11

function getAltiumSchematicPortIoType({
  hasInputArrow,
  hasOutputArrow,
}: Pick<
  SchematicOffSheetPortRecordFieldsInput,
  "hasInputArrow" | "hasOutputArrow"
>): number {
  if (hasInputArrow && hasOutputArrow) return 3
  if (hasInputArrow) return 1
  if (hasOutputArrow) return 2
  return 0
}

export function createAltiumSchematicOffSheetPortRecordFields({
  altiumPortPosition,
  facingDirection,
  hasInputArrow,
  hasOutputArrow,
  portName,
}: SchematicOffSheetPortRecordFieldsInput): string[] {
  const altiumPortWidth = Math.max(
    [...portName].length * ALTIUM_SCHEMATIC_PORT_TEXT_CHARACTER_WIDTH,
    ALTIUM_SCHEMATIC_PORT_MINIMUM_WIDTH,
  )
  return [
    "RECORD=18",
    `LOCATION.X=${altiumPortPosition.x}`,
    `LOCATION.Y=${altiumPortPosition.y}`,
    `WIDTH=${altiumPortWidth}`,
    `IOTYPE=${getAltiumSchematicPortIoType({ hasInputArrow, hasOutputArrow })}`,
    ...(facingDirection === "up" || facingDirection === "down"
      ? ["STYLE=4"]
      : []),
    `NAME=${portName}`,
    `FONTID=${ALTIUM_SCHEMATIC_OFF_SHEET_PORT_FONT_ID}`,
    `COLOR=${ALTIUM_SCHEMATIC_PORT_COLOR}`,
    `AREACOLOR=${ALTIUM_SCHEMATIC_PORT_AREA_COLOR}`,
    `TEXTCOLOR=${ALTIUM_SCHEMATIC_PORT_COLOR}`,
  ]
}
