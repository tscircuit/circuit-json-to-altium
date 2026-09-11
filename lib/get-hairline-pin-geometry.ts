import type { Point } from "./types"

/** Retain the inversion bubble, and replace the exposed pin stem with a wire. */
export function getHairlinePinGeometry({
  body,
  length,
  orientation,
  hasInversionCircle,
}: {
  body: Point
  length: number
  orientation: number
  hasInversionCircle: boolean
}): { connection: Point; start: Point; nativeLength: number } {
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][orientation & 3]!
  // An Altium inversion bubble spans five schematic units from the body.
  const nativeLength = hasInversionCircle ? Math.min(length, 5) : 0
  const pointAt = (distance: number): Point => ({
    x: body.x + direction.x * distance,
    y: body.y + direction.y * distance,
  })
  return {
    nativeLength,
    start: pointAt(nativeLength),
    connection: pointAt(length),
  }
}
