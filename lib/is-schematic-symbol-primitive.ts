import type { CircuitElement } from "./types"

const SCHEMATIC_SYMBOL_PRIMITIVE_TYPES = new Set([
  "schematic_arc",
  "schematic_circle",
  "schematic_line",
  "schematic_path",
  "schematic_rect",
])

export function isSchematicSymbolPrimitive(element: CircuitElement): boolean {
  return (
    SCHEMATIC_SYMBOL_PRIMITIVE_TYPES.has(element.type ?? "") ||
    (element.type === "schematic_text" &&
      typeof element.schematic_symbol_id === "string" &&
      element.schematic_symbol_id.length > 0)
  )
}
