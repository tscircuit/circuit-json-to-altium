import type { Point } from "../../lib/types"

type Segment = { from: Point; to: Point }

/** Compare the complete union, independently of vertex/record counts. */
export function schematicWireCoverageMatches(
  source: Segment[],
  output: Segment[],
  tolerance = 0.00001,
): boolean {
  const covered = (segment: Segment, candidates: Segment[]) => {
    const dx = segment.to.x - segment.from.x
    const dy = segment.to.y - segment.from.y
    const length = Math.hypot(dx, dy)
    if (length <= tolerance) return true
    const project = (point: Point) =>
      ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) /
      length
    const onLine = (point: Point) =>
      Math.abs(
        (point.x - segment.from.x) * dy - (point.y - segment.from.y) * dx,
      ) /
        length <=
      tolerance
    const intervals = candidates
      .filter(({ from, to }) => onLine(from) && onLine(to))
      .map(
        ({ from, to }) =>
          [
            Math.min(project(from), project(to)),
            Math.max(project(from), project(to)),
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
  return (
    source.every((segment) => covered(segment, output)) &&
    output.every((segment) => covered(segment, source))
  )
}
