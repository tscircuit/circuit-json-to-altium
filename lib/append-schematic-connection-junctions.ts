import {
  AltiumSchJunctionRecord,
  getSchematicRecordPoints,
  parseAltiumSchDoc,
} from "altiumts"
import { createAltiumSchematicCoordinateFields } from "./create-altium-schematic-coordinate-fields"
import { getSchematicConnectionJunctions } from "./get-schematic-connection-junctions"
import { normalizeSchematicDocumentWires } from "./normalize-schematic-document-wires"
import type { SchematicWireSegment } from "./normalize-schematic-wire-segments"
import type { Point } from "./types"

function pointKey(point: Point): string {
  return `${point.x.toFixed(5)}:${point.y.toFixed(5)}`
}

/** Include junctions introduced by the exported power ports and label leaders.
 * Locked native records retain their wire color when Altium recompiles the sheet.
 */
export function appendSchematicConnectionJunctions(
  asciiContent: string,
): string {
  const normalizedContent = normalizeSchematicDocumentWires(asciiContent)
  const document = parseAltiumSchDoc(normalizedContent)
  const segments: SchematicWireSegment[] = document.wires.flatMap((wire) => {
    const points = getSchematicRecordPoints(wire)
    return points.flatMap((from, index) => {
      const to = points[index + 1]
      return to ? [{ from, to }] : []
    })
  })
  const terminals: Point[] = document.powerPorts.flatMap((port) =>
    port.position ? [port.position] : [],
  )
  for (const pin of document.pins) {
    const flags = pin.getNumber("PINCONGLOMERATE") ?? 0
    if (pin.getBoolean("ISHIDDEN") || (flags & 4) !== 0 || !pin.position)
      continue
    const orientation = flags & 3
    const length = pin.getNumber("PINLENGTH") ?? 10
    terminals.push({
      x:
        pin.position.x +
        (orientation === 0 ? length : orientation === 2 ? -length : 0),
      y:
        pin.position.y +
        (orientation === 1 ? length : orientation === 3 ? -length : 0),
    })
  }
  const existing = new Set(
    document.records
      .filter(
        (record): record is AltiumSchJunctionRecord =>
          record instanceof AltiumSchJunctionRecord,
      )
      .flatMap((record) =>
        record.position ? [pointKey(record.position)] : [],
      ),
  )
  const points = getSchematicConnectionJunctions({
    segments,
    terminals,
  }).filter((point) => !existing.has(pointKey(point)))
  const records = points.map((point, index) => [
    "RECORD=29",
    "OWNERPARTID=-1",
    `INDEXINSHEET=${document.records.length + index}`,
    ...createAltiumSchematicCoordinateFields("LOCATION.X", point.x),
    ...createAltiumSchematicCoordinateFields("LOCATION.Y", point.y),
    "COLOR=34816",
    "SIZE=0",
    "LOCKED=T",
  ])
  return (
    normalizedContent +
    records.map((record) => `|${record.join("|")}\r\n`).join("")
  )
}
