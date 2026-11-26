import type { SchematicWireSegment } from "./normalize-schematic-wire-segments"
import type { Point } from "./types"

type AttachmentPointKey = string

const ATTACHMENT_POINT_TOLERANCE = 1e-8

export function splitSchematicWireAtAttachments(
  segment: SchematicWireSegment,
  attachments: Point[],
): SchematicWireSegment[] {
  const dx = segment.to.x - segment.from.x
  const dy = segment.to.y - segment.from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return []
  const interior = new Map<AttachmentPointKey, Point>()
  for (const point of attachments) {
    const px = point.x - segment.from.x
    const py = point.y - segment.from.y
    const along = px * dx + py * dy
    if (
      // Accept floating-point noise without projecting or moving the point.
      Math.abs(px * dy - py * dx) <=
        ATTACHMENT_POINT_TOLERANCE * Math.sqrt(lengthSquared) &&
      along > 0 &&
      along < lengthSquared
    ) {
      interior.set(`${point.x}:${point.y}`, point)
    }
  }
  const points = [
    segment.from,
    ...[...interior.values()].sort(
      (a, b) => (a.x - b.x) * dx + (a.y - b.y) * dy,
    ),
    segment.to,
  ]
  return points.slice(1).map((to, index) => ({ from: points[index]!, to }))
}
