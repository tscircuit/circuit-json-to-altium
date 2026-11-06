import { asNumber, asPoint, asString } from "./format"
import type { CircuitElement, Point } from "./types"

export type SchematicTableBounds = {
  bottom: number
  left: number
  right: number
  top: number
}

export type SchematicTableCellGeometry = {
  center: Point
  height: number
  width: number
}

function getPositiveNumberArray(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  const values = input.map((value) => asNumber(value))
  return values.every((value) => value > 0) ? values : []
}

export function getSchematicTableBounds(
  table: CircuitElement | undefined,
): SchematicTableBounds | undefined {
  if (!table) return undefined
  const anchorPosition = asPoint(table.anchor_position)
  const columnWidths = getPositiveNumberArray(table.column_widths)
  const rowHeights = getPositiveNumberArray(table.row_heights)
  if (!anchorPosition || columnWidths.length === 0 || rowHeights.length === 0) {
    return undefined
  }

  const width = columnWidths.reduce((sum, value) => sum + value, 0)
  const height = rowHeights.reduce((sum, value) => sum + value, 0)
  const anchor = asString(table.anchor, "center")
  const left = anchor.includes("left")
    ? anchorPosition.x
    : anchor.includes("right")
      ? anchorPosition.x - width
      : anchorPosition.x - width / 2
  const top = anchor.includes("top")
    ? anchorPosition.y
    : anchor.includes("bottom")
      ? anchorPosition.y + height
      : anchorPosition.y + height / 2

  return {
    bottom: top - height,
    left,
    right: left + width,
    top,
  }
}

function getFallbackCellGeometry(
  cell: CircuitElement,
): SchematicTableCellGeometry | undefined {
  const center = asPoint(cell.center)
  const width = asNumber(cell.width)
  const height = asNumber(cell.height)
  return center && width > 0 && height > 0
    ? { center, height, width }
    : undefined
}

export function getSchematicTableCellGeometry({
  cell,
  table,
}: {
  cell: CircuitElement
  table: CircuitElement | undefined
}): SchematicTableCellGeometry | undefined {
  const tableBounds = getSchematicTableBounds(table)
  const columnWidths = getPositiveNumberArray(table?.column_widths)
  const rowHeights = getPositiveNumberArray(table?.row_heights)
  const startColumnIndex = Math.trunc(asNumber(cell.start_column_index, -1))
  const endColumnIndex = Math.trunc(asNumber(cell.end_column_index, -1))
  const startRowIndex = Math.trunc(asNumber(cell.start_row_index, -1))
  const endRowIndex = Math.trunc(asNumber(cell.end_row_index, -1))
  if (
    !tableBounds ||
    startColumnIndex < 0 ||
    endColumnIndex < startColumnIndex ||
    endColumnIndex >= columnWidths.length ||
    startRowIndex < 0 ||
    endRowIndex < startRowIndex ||
    endRowIndex >= rowHeights.length
  ) {
    return getFallbackCellGeometry(cell)
  }

  const width = columnWidths
    .slice(startColumnIndex, endColumnIndex + 1)
    .reduce((sum, value) => sum + value, 0)
  const height = rowHeights
    .slice(startRowIndex, endRowIndex + 1)
    .reduce((sum, value) => sum + value, 0)
  const left =
    tableBounds.left +
    columnWidths
      .slice(0, startColumnIndex)
      .reduce((sum, value) => sum + value, 0)
  const top =
    tableBounds.top -
    rowHeights.slice(0, startRowIndex).reduce((sum, value) => sum + value, 0)

  return {
    center: { x: left + width / 2, y: top - height / 2 },
    height,
    width,
  }
}
