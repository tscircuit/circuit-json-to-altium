import { type AltiumRecord, parseAltiumSchDoc } from "altiumts"
import type { Point } from "./types"

const pointKey = ({ x, y }: Point) => `${x.toFixed(5)}:${y.toFixed(5)}`
const coordinate = (record: AltiumRecord, field: string) =>
  (record.getNumber(field) ?? 0) +
  (record.getNumber(`${field}_FRAC`) ?? 0) / 100_000

/** Junctions that Altium otherwise generates using its compiler display defaults. */
export function getSchematicAutoJunctionPoints(asciiContent: string): Point[] {
  const document = parseAltiumSchDoc(asciiContent)
  const candidates = new Map<string, Point>()
  const terminals = new Map<string, number>()
  const segments: {
    start: Point
    end: Point
    startKey: string
    endKey: string
  }[] = []
  for (const wire of document.wires) {
    const count = wire.getNumber("LOCATIONCOUNT") ?? 0
    for (let index = 1; index < count; index++) {
      const start = {
        x: coordinate(wire, `X${index}`),
        y: coordinate(wire, `Y${index}`),
      }
      const end = {
        x: coordinate(wire, `X${index + 1}`),
        y: coordinate(wire, `Y${index + 1}`),
      }
      if (pointKey(start) === pointKey(end)) continue
      segments.push({
        start,
        end,
        startKey: pointKey(start),
        endKey: pointKey(end),
      })
      candidates.set(pointKey(start), start)
      candidates.set(pointKey(end), end)
    }
  }
  // Net-label text does not contribute a branch. Pin and power-port electrical
  // terminals do, including the shortened pins used for hairline stems.
  for (const record of [...document.pins, ...document.powerPorts]) {
    const point = {
      x: coordinate(record, "LOCATION.X"),
      y: coordinate(record, "LOCATION.Y"),
    }
    if (record.recordKind === "2") {
      const flags = record.getNumber("PINCONGLOMERATE") ?? 0
      if ((flags & 4) !== 0) continue
      const direction = [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
      ][flags & 3]!
      const length = coordinate(record, "PINLENGTH")
      point.x += direction.x * length
      point.y += direction.y * length
    }
    point.x = Number(point.x.toFixed(5))
    point.y = Number(point.y.toFixed(5))
    const key = pointKey(point)
    candidates.set(key, point)
    terminals.set(key, (terminals.get(key) ?? 0) + 1)
  }

  return [...candidates].flatMap(([key, point]) => {
    let connections = terminals.get(key) ?? 0
    for (const { start, end, startKey, endKey } of segments) {
      if (startKey === key || endKey === key) {
        connections++
      } else if (
        Math.abs(
          (end.x - start.x) * (point.y - start.y) -
            (end.y - start.y) * (point.x - start.x),
        ) < 1e-8 &&
        point.x >= Math.min(start.x, end.x) &&
        point.x <= Math.max(start.x, end.x) &&
        point.y >= Math.min(start.y, end.y) &&
        point.y <= Math.max(start.y, end.y)
      ) {
        connections += 2
      }
      if (connections >= 3) break
    }
    // Interior crossings without an endpoint or electrical terminal are not
    // candidates: placing a manual junction there could connect unrelated nets.
    return connections >= 3 ? [point] : []
  })
}
