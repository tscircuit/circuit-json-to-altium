import { asString } from "./format"
import type { CircuitElement } from "./types"

const SCHEMATIC_SHEET_ANNOTATION_TYPES = new Set([
  "schematic_line",
  "schematic_path",
  "schematic_rect",
  "schematic_text",
])

export function isSchematicSheetAnnotation(element: CircuitElement): boolean {
  return (
    SCHEMATIC_SHEET_ANNOTATION_TYPES.has(element.type ?? "") &&
    !asString(element.schematic_component_id) &&
    !asString(element.schematic_symbol_id)
  )
}
