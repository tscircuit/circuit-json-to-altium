import type { Point } from "./types"

/** Keep the electrical endpoint while moving the visible stem to a line record. */
export function getHairlinePassivePinGeometry({
  body,
  length,
  orientation,
  nameMargin,
}: {
  body: Point
  length: number
  orientation: number
  nameMargin: number
}): { connection: Point; nameMargin: number; designatorMargin: number } {
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][orientation & 3]!
  return {
    connection: {
      x: body.x + direction.x * length,
      y: body.y + direction.y * length,
    },
    nameMargin: nameMargin - length,
    designatorMargin: 9 - length,
  }
}
