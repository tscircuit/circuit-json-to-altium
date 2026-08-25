import type {
  AltiumRecord,
  AltiumSchComponentRecord,
  AltiumSchDoc,
} from "altiumts"
import type { CircuitElement, SchematicComponentId } from "../../lib/types"
import { getAltiumSchematicTextPresentation } from "./get-altium-schematic-text-presentation"
import { isAltiumSchematicComponentRecordVisible } from "./is-altium-schematic-component-record-visible"

type AppendAltiumSchematicComponentTextElementsInput = {
  component: AltiumSchComponentRecord
  document: AltiumSchDoc
  elements: CircuitElement[]
  excludedRecords: ReadonlySet<AltiumRecord>
  schematicComponentId: SchematicComponentId
}

function isOwnedByComponent({
  component,
  document,
  record,
}: {
  component: AltiumSchComponentRecord
  document: AltiumSchDoc
  record: AltiumRecord
}): boolean {
  const visitedRecords = new Set<AltiumRecord>()
  let currentRecord: AltiumRecord | undefined = record
  while (currentRecord && !visitedRecords.has(currentRecord)) {
    visitedRecords.add(currentRecord)
    const parentRecord = document.getParent(currentRecord)
    if (parentRecord === component) return true
    currentRecord = parentRecord
  }
  return false
}

export function appendAltiumSchematicComponentTextElements({
  component,
  document,
  elements,
  excludedRecords,
  schematicComponentId,
}: AppendAltiumSchematicComponentTextElementsInput): void {
  for (const [recordIndex, record] of document.records.entries()) {
    if (
      (record.recordKind !== "4" && record.recordKind !== "41") ||
      excludedRecords.has(record) ||
      !isOwnedByComponent({ component, document, record }) ||
      !isAltiumSchematicComponentRecordVisible({ component, record })
    ) {
      continue
    }
    const text = record.getDecoded("TEXT") ?? record.getDecoded("NAME") ?? ""
    if (!text || record.getBoolean("ISHIDDEN") === true) continue
    elements.push({
      type: "schematic_text",
      schematic_text_id: `schematic_text_component_label_${recordIndex}`,
      schematic_component_id: schematicComponentId,
      text,
      ...getAltiumSchematicTextPresentation({
        document,
        fallbackFontSizePoints: 9,
        record,
      }),
    })
  }
}
