import type { Point } from "./types"

/** Replace the exposed pin stem with a wire connected to a zero-length pin. */
export function getHairlinePinGeometry({
  body,
  length,
  orientation,
}: {
  body: Point
  length: number
  orientation: number
}): { connection: Point; start: Point; nativeLength: number } {
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][orientation & 3]!
  const nativeLength = 0
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
