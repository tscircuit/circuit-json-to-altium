import type { AltiumRecord, AltiumSchComponentRecord } from "altiumts"

export function isAltiumSchematicComponentRecordVisible({
  component,
  record,
}: {
  component: AltiumSchComponentRecord
  record: AltiumRecord
}): boolean {
  const ownerPartId = record.getNumber("OWNERPARTID")
  const currentPartId = component.getNumber("CURRENTPARTID") ?? 1
  const partMatches =
    ownerPartId === undefined ||
    ownerPartId <= 0 ||
    ownerPartId === currentPartId
  const ownerPartDisplayMode = record.getNumber("OWNERPARTDISPLAYMODE")
  return (
    partMatches &&
    (ownerPartDisplayMode === undefined || ownerPartDisplayMode === 0)
  )
}
