import type { SchematicWireSegment } from "./normalize-schematic-wire-segments"
import type { Point } from "./types"

const TOLERANCE = 0.00001

function pointsEqual(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= TOLERANCE
}

function containsPoint(
  { from, to }: SchematicWireSegment,
  point: Point,
): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length <= TOLERANCE) return false
  const distance =
    Math.abs((point.x - from.x) * dy - (point.y - from.y) * dx) / length
  const along = ((point.x - from.x) * dx + (point.y - from.y) * dy) / length
  return (
    distance <= TOLERANCE && along >= -TOLERANCE && along <= length + TOLERANCE
  )
}

/** Native automatic junctions at wire vertices and pin/power terminals.
 * Interior crossings without a vertex or terminal remain unconnected.
 */
export function getSchematicConnectionJunctions({
  segments,
  terminals = [],
}: {
  segments: SchematicWireSegment[]
  terminals?: Point[]
}): Point[] {
  const candidates = new Map<string, Point>()
  for (const point of [
    ...segments.flatMap(({ from, to }) => [from, to]),
    ...terminals,
  ]) {
    candidates.set(`${point.x.toFixed(5)}:${point.y.toFixed(5)}`, point)
  }
  return [...candidates.values()].filter((point) => {
    let arms = terminals.filter((terminal) =>
      pointsEqual(terminal, point),
    ).length
    let touchesWire = false
    for (const segment of segments) {
      if (!containsPoint(segment, point)) continue
      touchesWire = true
      arms +=
        pointsEqual(segment.from, point) || pointsEqual(segment.to, point)
          ? 1
          : 2
    }
    return touchesWire && arms >= 3
  })
}
