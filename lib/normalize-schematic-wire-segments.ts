import type { Point } from "./types"

export type SchematicWireSegment = { from: Point; to: Point }

type SchematicWireLineKey = string
type SchematicWirePointKey = string

type Interval = {
  low: Point
  high: Point
  min: number
  max: number
  inputIndex: number
  reversed: boolean
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

function containsInterior(
  { from, to }: SchematicWireSegment,
  point: Point,
): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const along = (point.x - from.x) * dx + (point.y - from.y) * dy
  return (
    (point.x - from.x) * dy === (point.y - from.y) * dx &&
    along > 0 &&
    along < dx * dx + dy * dy
  )
}

// Coordinates have already been rounded to the native schematic grid. Merge
// overlapping collinear wires, preserving the union and unconnected crossings.
export function normalizeSchematicWireSegments(
  segments: SchematicWireSegment[],
): SchematicWireSegment[] {
  const groups = new Map<SchematicWireLineKey, Interval[]>()
  for (const [inputIndex, { from, to }] of segments.entries()) {
    let dx = to.x - from.x
    let dy = to.y - from.y
    if (dx === 0 && dy === 0) continue
    const divisor = gcd(Math.abs(dx), Math.abs(dy))
    dx /= divisor
    dy /= divisor
    if (dx < 0 || (dx === 0 && dy < 0)) {
      dx = -dx
      dy = -dy
    }
    const key: SchematicWireLineKey = `${dx}:${dy}:${dx * from.y - dy * from.x}`
    const start = dx === 0 ? from.y : from.x
    const end = dx === 0 ? to.y : to.x
    const reversed = start > end
    const interval = {
      low: reversed ? to : from,
      high: reversed ? from : to,
      min: Math.min(start, end),
      max: Math.max(start, end),
      inputIndex,
      reversed,
    }
    const group = groups.get(key)
    if (group) group.push(interval)
    else groups.set(key, [interval])
  }

  const output: Interval[] = []
  for (const group of groups.values()) {
    group.sort((a, b) => a.min - b.min || a.inputIndex - b.inputIndex)
    let current: Interval | undefined
    for (const next of group) {
      // Merely touching segments can retain their existing vertex. A positive
      // overlap is what creates redundant electrical objects in Altium.
      if (!current || next.min >= current.max) {
        current = { ...next }
        output.push(current)
        continue
      }
      if (next.max > current.max) {
        current.max = next.max
        current.high = next.high
      }
      if (next.inputIndex < current.inputIndex) {
        current.inputIndex = next.inputIndex
        current.reversed = next.reversed
      }
    }
  }
  const merged = output
    .sort((a, b) => a.inputIndex - b.inputIndex)
    .map(({ low, high, reversed }) => ({
      from: reversed ? high : low,
      to: reversed ? low : high,
    }))
  const finalEnds = new Set<SchematicWirePointKey>(
    merged.flatMap(({ from, to }) => [
      `${from.x}:${from.y}`,
      `${to.x}:${to.y}`,
    ]),
  )
  const removedEnds = new Map<SchematicWirePointKey, Point>(
    segments
      .flatMap(({ from, to }) => [from, to])
      .filter((point) => !finalEnds.has(`${point.x}:${point.y}`))
      .map((point) => [`${point.x}:${point.y}`, point]),
  )
  // Keep a vertex if merging would turn a connected wire-end crossing into
  // two uninterrupted crossing wires (which Altium considers disconnected).
  return merged.flatMap((segment) => {
    const dx = segment.to.x - segment.from.x
    const dy = segment.to.y - segment.from.y
    const splits = [...removedEnds.values()].filter(
      (point) =>
        containsInterior(segment, point) &&
        segments.some(
          (original) =>
            dx * (original.to.y - original.from.y) ===
              dy * (original.to.x - original.from.x) &&
            ((original.from.x === point.x && original.from.y === point.y) ||
              (original.to.x === point.x && original.to.y === point.y)),
        ) &&
        merged.some(
          (other) =>
            dx * (other.to.y - other.from.y) !==
              dy * (other.to.x - other.from.x) &&
            containsInterior(other, point),
        ),
    )
    splits.sort((a, b) => (a.x - b.x) * dx + (a.y - b.y) * dy)
    const points = [segment.from, ...splits, segment.to]
    return points.slice(1).map((to, index) => ({ from: points[index]!, to }))
  })
}
