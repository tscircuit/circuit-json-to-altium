import type { Point } from "./types"

// Polygon points are absolute PCB coordinates. Find an interior anchor even
// when the bounding-box center lies outside a concave polygon.
export function getPolygonPadAnchor(points: readonly Point[]): {
  center: Point
  diameter: number
} {
  if (points.length < 3)
    throw new Error("A polygon pad requires three vertices")
  const ys = [...new Set(points.map((point) => point.y))].sort((a, b) => a - b)
  let best: { center: Point; diameter: number } | undefined
  for (let row = 1; row < ys.length; row++) {
    const y = ((ys[row - 1] ?? 0) + (ys[row] ?? 0)) / 2
    const crossings: number[] = []
    for (let index = 0; index < points.length; index++) {
      const a = points[index]!
      const b = points[(index + 1) % points.length]!
      if (y < Math.min(a.y, b.y) || y >= Math.max(a.y, b.y)) continue
      crossings.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y))
    }
    crossings.sort((a, b) => a - b)
    for (let index = 1; index < crossings.length; index += 2) {
      const center = { x: (crossings[index - 1]! + crossings[index]!) / 2, y }
      const distance = Math.min(
        ...points.map((a, edge) => {
          const b = points[(edge + 1) % points.length]!
          const dx = b.x - a.x
          const dy = b.y - a.y
          const lengthSquared = dx * dx + dy * dy
          const t =
            lengthSquared === 0
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    1,
                    ((center.x - a.x) * dx + (center.y - a.y) * dy) /
                      lengthSquared,
                  ),
                )
          return Math.hypot(center.x - a.x - t * dx, center.y - a.y - t * dy)
        }),
      )
      // Keep the round anchor strictly inside the copper contour.
      const diameter = distance
      if (!best || diameter > best.diameter) best = { center, diameter }
    }
  }
  if (!best || best.diameter <= 0)
    throw new Error("A polygon pad requires a non-zero area")
  return best
}
