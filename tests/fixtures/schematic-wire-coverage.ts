import type { Point } from "../../lib/types"

type Segment = { from: Point; to: Point }
type SegmentLine = { from: Point; dx: number; dy: number; length: number }

function projectPoint(
  point: Point,
  { from, dx, dy, length }: SegmentLine,
): number {
  return ((point.x - from.x) * dx + (point.y - from.y) * dy) / length
}

function isPointOnLine({
  point,
  line: { from, dx, dy, length },
  tolerance,
}: {
  point: Point
  line: SegmentLine
  tolerance: number
}): boolean {
  return (
    Math.abs((point.x - from.x) * dy - (point.y - from.y) * dx) / length <=
    tolerance
  )
}

function isSegmentCovered({
  segment,
  candidates,
  tolerance,
}: {
  segment: Segment
  candidates: Segment[]
  tolerance: number
}): boolean {
  const dx = segment.to.x - segment.from.x
  const dy = segment.to.y - segment.from.y
  const length = Math.hypot(dx, dy)
  if (length <= tolerance) return true
  const line = { from: segment.from, dx, dy, length }
  const intervals = candidates
    .filter(
      ({ from, to }) =>
        isPointOnLine({ point: from, line, tolerance }) &&
        isPointOnLine({ point: to, line, tolerance }),
    )
    .map(
      ({ from, to }) =>
        [
          Math.min(projectPoint(from, line), projectPoint(to, line)),
          Math.max(projectPoint(from, line), projectPoint(to, line)),
        ] as const,
    )
    .sort((a, b) => a[0] - b[0])
  let end = 0
  for (const [start, nextEnd] of intervals) {
    if (start > end + tolerance) return false
    end = Math.max(end, nextEnd)
    if (end >= length - tolerance) return true
  }
  return false
}

/** Compare the complete union, independently of vertex/record counts. */
export function schematicWireCoverageMatches({
  source,
  output,
  tolerance = 0.00001,
}: {
  source: Segment[]
  output: Segment[]
  tolerance?: number
}): boolean {
  return (
    source.every((segment) =>
      isSegmentCovered({ segment, candidates: output, tolerance }),
    ) &&
    output.every((segment) =>
      isSegmentCovered({ segment, candidates: source, tolerance }),
    )
  )
}
