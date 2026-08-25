import type { CircuitElement, LengthTransform } from "./types"

type SchematicConfigRecordFieldsInput = {
  circuitToAltiumSchematicLength: LengthTransform
  schematicConfig: CircuitElement | undefined
}

type PositiveIntegerFieldName = "horizontal_zone_count" | "vertical_zone_count"

function getOptionalPositiveInteger({
  fieldName,
  schematicConfig,
}: {
  fieldName: PositiveIntegerFieldName
  schematicConfig: CircuitElement
}): number | undefined {
  const count = schematicConfig[fieldName]
  if (count === undefined) return undefined
  if (typeof count !== "number" || !Number.isInteger(count) || count <= 0) {
    throw new Error(`schematic_config.${fieldName} must be a positive integer`)
  }
  return count
}

function appendOptionalBooleanField({
  circuitFieldName,
  nativeFieldName,
  recordFields,
  schematicConfig,
}: {
  circuitFieldName: "show_border" | "show_reference_zones" | "show_title_block"
  nativeFieldName: "BORDERON" | "REFERENCEZONESON" | "TITLEBLOCKON"
  recordFields: string[]
  schematicConfig: CircuitElement
}): void {
  const enabled = schematicConfig[circuitFieldName]
  if (enabled === undefined) return
  if (typeof enabled !== "boolean") {
    throw new Error(`schematic_config.${circuitFieldName} must be a boolean`)
  }
  recordFields.push(`${nativeFieldName}=${enabled ? "T" : "F"}`)
}

export function createAltiumSchematicConfigRecordFields({
  circuitToAltiumSchematicLength,
  schematicConfig,
}: SchematicConfigRecordFieldsInput): string[] {
  if (!schematicConfig) return []
  const recordFields: string[] = []
  appendOptionalBooleanField({
    circuitFieldName: "show_border",
    nativeFieldName: "BORDERON",
    recordFields,
    schematicConfig,
  })
  appendOptionalBooleanField({
    circuitFieldName: "show_title_block",
    nativeFieldName: "TITLEBLOCKON",
    recordFields,
    schematicConfig,
  })
  appendOptionalBooleanField({
    circuitFieldName: "show_reference_zones",
    nativeFieldName: "REFERENCEZONESON",
    recordFields,
    schematicConfig,
  })

  const borderMargin = schematicConfig.border_margin
  if (borderMargin !== undefined) {
    if (
      typeof borderMargin !== "number" ||
      !Number.isFinite(borderMargin) ||
      borderMargin < 0
    ) {
      throw new Error("schematic_config.border_margin must be non-negative")
    }
    recordFields.push(
      `CUSTOMMARGINWIDTH=${circuitToAltiumSchematicLength(borderMargin)}`,
    )
  }

  const horizontalZoneCount = getOptionalPositiveInteger({
    fieldName: "horizontal_zone_count",
    schematicConfig,
  })
  if (horizontalZoneCount !== undefined) {
    recordFields.push(`CUSTOMXZONES=${horizontalZoneCount}`)
  }
  const verticalZoneCount = getOptionalPositiveInteger({
    fieldName: "vertical_zone_count",
    schematicConfig,
  })
  if (verticalZoneCount !== undefined) {
    recordFields.push(`CUSTOMYZONES=${verticalZoneCount}`)
  }
  return recordFields
}
