import { asString } from "./format"
import type { CircuitElement } from "./types"

const SCHEMATIC_COMPONENT_GRAPHIC_TYPES = new Set([
  "schematic_arc",
  "schematic_circle",
  "schematic_line",
  "schematic_oval",
  "schematic_path",
  "schematic_rect",
])

export function isSchematicComponentGraphic(element: CircuitElement): boolean {
  return (
    SCHEMATIC_COMPONENT_GRAPHIC_TYPES.has(element.type ?? "") &&
    asString(element.schematic_component_id) !== ""
  )
}
