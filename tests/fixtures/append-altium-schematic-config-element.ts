import type { AltiumSchDoc } from "altiumts"
import type { CircuitElement } from "../../lib/types"
import {
  getSchematicCoordinate,
  toCircuitLength,
} from "./altium-schematic-coordinate-utils"

export function appendAltiumSchematicConfigElement({
  document,
  elements,
}: {
  document: AltiumSchDoc
  elements: CircuitElement[]
}): void {
  const sheetRecord = document.getRecordsByKind("31")[0]
  if (!sheetRecord) return

  elements.push({
    type: "schematic_config",
    schematic_config_id: "schematic_config_root",
    show_border: sheetRecord.getBoolean("BORDERON") !== false,
    show_title_block: sheetRecord.getBoolean("TITLEBLOCKON") === true,
    show_reference_zones: sheetRecord.getBoolean("REFERENCEZONESON") !== false,
    border_margin: toCircuitLength(
      getSchematicCoordinate({
        fallback: 10,
        key: "CUSTOMMARGINWIDTH",
        record: sheetRecord,
      }),
    ),
    horizontal_zone_count: Math.max(
      Math.round(sheetRecord.getNumber("CUSTOMXZONES") ?? 6),
      1,
    ),
    vertical_zone_count: Math.max(
      Math.round(sheetRecord.getNumber("CUSTOMYZONES") ?? 4),
      1,
    ),
  })
}
