import {
  type AltiumSchDoc,
  getSchematicRecordPoints,
  parseAltiumSchDoc,
} from "altiumts"

/** Compare logical pin geometry when a native terminal is extended by a thin wire. */
export function normalizeHairlinePinStems(
  document: AltiumSchDoc,
): AltiumSchDoc {
  const copy = parseAltiumSchDoc(document.getString())
  const consumed = new Set<(typeof copy.records)[number]>()
  for (const pin of copy.pins) {
    const length = pin.getNumber("PINLENGTH") ?? 10
    if (
      length !== 0 &&
      !(length === 5 && pin.getNumber("SYMBOL_OUTEREDGE") === 1)
    )
      continue
    const direction = pin.getNumber("PINCONGLOMERATE")! & 3
    const dx = [1, 0, -1, 0][direction]!
    const dy = [0, 1, 0, -1][direction]!
    const body = pin.position!
    const start = { x: body.x + dx * length, y: body.y + dy * length }
    const stem = copy.wires.find((wire) => {
      const points = getSchematicRecordPoints(wire)
      if (
        points.length !== 2 ||
        consumed.has(wire) ||
        wire.getNumber("LINEWIDTH") !== 0 ||
        wire.getNumber("COLOR") !== pin.getNumber("COLOR")
      )
        return false
      const [a, b] = points
      return (
        a!.x === start.x &&
        a!.y === start.y &&
        (b!.x - a!.x) * dy === (b!.y - a!.y) * dx &&
        (b!.x - a!.x) * dx + (b!.y - a!.y) * dy > 0
      )
    })
    if (!stem) continue
    const end = getSchematicRecordPoints(stem)[1]!
    pin.set("PINLENGTH", String((end.x - body.x) * dx + (end.y - body.y) * dy))
    consumed.add(stem)
  }
  const previous = copy.records
  const retained = previous.filter((r) => !consumed.has(r))
  const indexes = new Map(retained.map((r, i) => [r, i]))
  for (const record of retained) {
    const owner = record.getNumber("OWNERINDEX")
    if (owner !== undefined && owner >= 0)
      record.set("OWNERINDEX", String(indexes.get(previous[owner]!) ?? owner))
  }
  copy.lines = copy.lines.filter(
    (line) => !consumed.has(line as (typeof previous)[number]),
  )
  return copy
}
