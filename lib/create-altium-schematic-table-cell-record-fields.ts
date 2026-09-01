import type { AltiumSchematicFontTable } from "./create-altium-schematic-font-table"
import { asNumber, asString, formatNumber, sanitizeField } from "./format"
import { getSchematicTableCellGeometry } from "./get-schematic-table-cell-geometry"
import type { CircuitElement, Point, PointTransform } from "./types"

type CreateAltiumSchematicTableCellRecordFieldsInput = {
  cell: CircuitElement
  circuitToAltiumSchematicPoint: PointTransform
  fontTable: AltiumSchematicFontTable
  table: CircuitElement | undefined
}

const ALTIUM_UNITS_PER_CIRCUIT_UNIT = 20
const ALTIUM_SCHEMATIC_DEFAULT_COLOR = 0x37_29_1f
const ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR = 0xff_ff_ff

const ALTIUM_JUSTIFICATION_BY_ALIGNMENT: Record<string, number> = {
  bottom_left: 0,
  bottom_center: 1,
  bottom_right: 2,
  middle_left: 3,
  middle_center: 4,
  middle_right: 5,
  top_left: 6,
  top_center: 7,
  top_right: 8,
}

function getTextPosition({
  cell,
  cellPadding,
  center,
  height,
  width,
}: {
  cell: CircuitElement
  cellPadding: number
  center: Point
  height: number
  width: number
}): Point {
  const horizontalAlign = asString(cell.horizontal_align, "center")
  const verticalAlign = asString(cell.vertical_align, "middle")
  return {
    x:
      horizontalAlign === "left"
        ? center.x - width / 2 + cellPadding
        : horizontalAlign === "right"
          ? center.x + width / 2 - cellPadding
          : center.x,
    y:
      verticalAlign === "top"
        ? center.y + height / 2 - cellPadding
        : verticalAlign === "bottom"
          ? center.y - height / 2 + cellPadding
          : center.y,
  }
}

export function createAltiumSchematicTableCellRecordFields({
  cell,
  circuitToAltiumSchematicPoint,
  fontTable,
  table,
}: CreateAltiumSchematicTableCellRecordFieldsInput): string[][] {
  const geometry = getSchematicTableCellGeometry({ cell, table })
  if (!geometry) return []
  const { center, height, width } = geometry

  const firstCorner = circuitToAltiumSchematicPoint({
    x: center.x - width / 2,
    y: center.y - height / 2,
  })
  const secondCorner = circuitToAltiumSchematicPoint({
    x: center.x + width / 2,
    y: center.y + height / 2,
  })
  const borderWidth = Math.max(asNumber(table?.border_width, 0.05), 0)
  const records: string[][] = [
    [
      "RECORD=14",
      `LOCATION.X=${firstCorner.x}`,
      `LOCATION.Y=${firstCorner.y}`,
      `CORNER.X=${secondCorner.x}`,
      `CORNER.Y=${secondCorner.y}`,
      `LINEWIDTH=${formatNumber(borderWidth * ALTIUM_UNITS_PER_CIRCUIT_UNIT)}`,
      `COLOR=${ALTIUM_SCHEMATIC_DEFAULT_COLOR}`,
      `AREACOLOR=${ALTIUM_SCHEMATIC_DEFAULT_FILL_COLOR}`,
      "ISSOLID=F",
    ],
  ]

  const text = sanitizeField(cell.text)
  if (!text) return records
  const cellPadding = Math.max(asNumber(table?.cell_padding, 0.2), 0)
  const textPosition = circuitToAltiumSchematicPoint(
    getTextPosition({ cell, cellPadding, center, height, width }),
  )
  const horizontalAlign = asString(cell.horizontal_align, "center")
  const verticalAlign = asString(cell.vertical_align, "middle")
  const fontSize = asNumber(cell.font_size)
  records.push([
    "RECORD=4",
    `LOCATION.X=${textPosition.x}`,
    `LOCATION.Y=${textPosition.y}`,
    `FONTID=${fontTable.fontIdBySizeCircuitUnits.get(fontSize) ?? 2}`,
    `TEXT=${text}`,
    `COLOR=${ALTIUM_SCHEMATIC_DEFAULT_COLOR}`,
    "ORIENTATION=0",
    `JUSTIFICATION=${ALTIUM_JUSTIFICATION_BY_ALIGNMENT[`${verticalAlign}_${horizontalAlign}`] ?? 4}`,
  ])
  return records
}
