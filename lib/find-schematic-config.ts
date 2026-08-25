import { asString, byType } from "./format"
import type { CircuitElement, SchematicSheetId } from "./types"

export function findSchematicConfig({
  circuitJson,
  schematicSheetId,
}: {
  circuitJson: CircuitElement[]
  schematicSheetId: SchematicSheetId | undefined
}): CircuitElement | undefined {
  const matchingSchematicConfigs = byType(
    circuitJson,
    "schematic_config",
  ).filter(
    (schematicConfig) =>
      (asString(schematicConfig.schematic_sheet_id) || undefined) ===
      schematicSheetId,
  )
  if (matchingSchematicConfigs.length > 1) {
    const targetDescription = schematicSheetId
      ? `schematic sheet ${schematicSheetId}`
      : "unassigned schematic elements"
    throw new Error(
      `Expected at most one schematic_config for ${targetDescription}, got ${matchingSchematicConfigs.length}`,
    )
  }
  return matchingSchematicConfigs[0]
}
