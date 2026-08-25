import type { AltiumSchDoc } from "altiumts"
import type { CircuitElement } from "../../lib/types"
import {
  getSchematicCoordinate,
  toCircuitLength,
  toCircuitPoint,
} from "./altium-schematic-coordinate-utils"

export function appendAltiumSchematicSheetElements(
  document: AltiumSchDoc,
  elements: CircuitElement[],
): void {
  for (const [sheetIndex, sheetLink] of document.sheetLinks.entries()) {
    const schematicSheetId = `schematic_sheet_hierarchy_${sheetIndex}`
    const subcircuitId = `subcircuit_hierarchy_${sheetIndex}`
    const sourceGroupId = `source_group_hierarchy_${sheetIndex}`
    const schematicGroupId = `schematic_group_hierarchy_${sheetIndex}`
    const schematicComponentId = `schematic_component_hierarchy_${sheetIndex}`
    const location = sheetLink.symbol.position ?? { x: 0, y: 0 }
    const width = Math.max(
      getSchematicCoordinate({ key: "XSIZE", record: sheetLink.symbol }),
      1,
    )
    const height = Math.max(
      getSchematicCoordinate({ key: "YSIZE", record: sheetLink.symbol }),
      1,
    )
    const center = toCircuitPoint({
      x: location.x + width / 2,
      y: location.y - height / 2,
    })
    const size = {
      height: toCircuitLength(height),
      width: toCircuitLength(width),
    }
    const name =
      sheetLink.name || sheetLink.fileName || `Sheet ${sheetIndex + 1}`
    elements.push(
      {
        type: "schematic_sheet",
        schematic_sheet_id: schematicSheetId,
        name,
        sheet_index: sheetIndex,
        subcircuit_id: subcircuitId,
      },
      {
        type: "source_group",
        source_group_id: sourceGroupId,
        subcircuit_id: subcircuitId,
        is_subcircuit: true,
        show_as_schematic_box: true,
        name,
      },
      {
        type: "schematic_group",
        schematic_group_id: schematicGroupId,
        source_group_id: sourceGroupId,
        subcircuit_id: subcircuitId,
        is_subcircuit: true,
        show_as_schematic_box: true,
        schematic_component_ids: [schematicComponentId],
        center,
        ...size,
        name,
      },
      {
        type: "schematic_component",
        schematic_component_id: schematicComponentId,
        schematic_group_id: schematicGroupId,
        source_group_id: sourceGroupId,
        subcircuit_id: subcircuitId,
        is_schematic_group: true,
        is_box_with_pins: true,
        center,
        size,
      },
    )

    const entries = document
      .getOwnedRecords(sheetLink.symbol)
      .filter((record) => record.recordKind === "16")
    for (const [entryIndex, entry] of entries.entries()) {
      const name = entry.getDecoded("NAME") ?? ""
      if (!name) continue
      const sourcePortId = `source_port_sheet_${sheetIndex}_${entryIndex}`
      const side = Math.round(entry.getNumber("SIDE") ?? 0)
      const ioType = Math.round(entry.getNumber("IOTYPE") ?? 0)
      const entryPosition = toCircuitPoint({
        x: side === 1 ? location.x + width : location.x,
        y:
          location.y -
          Math.max(entry.getNumber("DISTANCEFROMTOP") ?? 0, 0) * 10,
      })
      elements.push(
        {
          type: "source_port",
          source_port_id: sourcePortId,
          name,
        },
        {
          type: "schematic_port",
          schematic_port_id: `schematic_port_sheet_${sheetIndex}_${entryIndex}`,
          schematic_sheet_id: schematicSheetId,
          source_port_id: sourcePortId,
          center: entryPosition,
          display_pin_label: name,
          facing_direction: side === 1 ? "right" : "left",
          is_internal_circuit_port: true,
          ...(ioType === 1 || ioType === 3 ? { has_input_arrow: true } : {}),
          ...(ioType === 2 || ioType === 3 ? { has_output_arrow: true } : {}),
        },
      )
    }
  }
}
