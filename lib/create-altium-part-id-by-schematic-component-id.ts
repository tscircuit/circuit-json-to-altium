import { asString } from "./format"
import type {
  AltiumPartId,
  CircuitElement,
  SchematicComponentId,
  SourceComponentId,
} from "./types"

type CreateAltiumPartIdBySchematicComponentIdParams = {
  circuitJson: CircuitElement[]
}

const FIRST_ALTIUM_PART_ID = 1

export function createAltiumPartIdBySchematicComponentId({
  circuitJson,
}: CreateAltiumPartIdBySchematicComponentIdParams): Map<
  SchematicComponentId,
  AltiumPartId
> {
  const altiumPartIdBySchematicComponentId = new Map<
    SchematicComponentId,
    AltiumPartId
  >()
  const nextAltiumPartIdBySourceComponentId = new Map<
    SourceComponentId,
    AltiumPartId
  >()

  for (const schematicComponent of circuitJson) {
    if (
      schematicComponent.type !== "schematic_component" ||
      schematicComponent.is_schematic_group === true
    ) {
      continue
    }
    const schematicComponentId = asString(
      schematicComponent.schematic_component_id,
    )
    if (!schematicComponentId) continue

    const sourceComponentId = asString(schematicComponent.source_component_id)
    if (!sourceComponentId) {
      altiumPartIdBySchematicComponentId.set(
        schematicComponentId,
        FIRST_ALTIUM_PART_ID,
      )
      continue
    }

    const altiumPartId =
      nextAltiumPartIdBySourceComponentId.get(sourceComponentId) ??
      FIRST_ALTIUM_PART_ID
    altiumPartIdBySchematicComponentId.set(schematicComponentId, altiumPartId)
    nextAltiumPartIdBySourceComponentId.set(sourceComponentId, altiumPartId + 1)
  }

  return altiumPartIdBySchematicComponentId
}
