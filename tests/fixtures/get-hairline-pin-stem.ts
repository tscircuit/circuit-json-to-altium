import type { AltiumSchDoc, AltiumSchPinRecord } from "altiumts"
import { getRecordCorner } from "./altium-schematic-coordinate-utils"

export function getHairlinePinStem(
  document: AltiumSchDoc,
  pin: AltiumSchPinRecord,
) {
  return document.records.find((record) => {
    if (
      record.recordKind !== "13" ||
      record.getNumber("OWNERINDEX") !== pin.getNumber("OWNERINDEX") ||
      record.getNumber("COLOR") !== pin.getNumber("COLOR") ||
      record.getNumber("LINEWIDTH") !== 0
    )
      return false
    const end = getRecordCorner(record)
    return end.x === pin.position!.x && end.y === pin.position!.y
  })
}
