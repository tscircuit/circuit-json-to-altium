import { applyToPoint, compose, rotateDEG, scale } from "transformation-matrix"
import { asNumber, formatMil, MILLIMETERS_TO_MILS } from "./format"
import type { CircuitElement } from "./types"

export function createPcbHoleOffsetFields({
  hole,
  padCcwRotationDegrees,
}: {
  hole: CircuitElement
  padCcwRotationDegrees: number
}): string[] {
  const offset = {
    x: asNumber(hole.hole_offset_x),
    y: asNumber(hole.hole_offset_y),
  }
  if (offset.x === 0 && offset.y === 0) return []
  // Circuit JSON offsets are board-relative; Altium rotates the offsets with
  // the copper pad. Undo that rotation before converting mm to native mils.
  const boardToPadOffset = compose(
    scale(MILLIMETERS_TO_MILS),
    rotateDEG(-padCcwRotationDegrees),
  )
  const localOffset = applyToPoint(boardToPadOffset, offset)
  const x = formatMil(localOffset.x)
  const y = formatMil(localOffset.y)
  // One physical drill must have the same position on every copper layer.
  return Array.from({ length: 32 }, (_, ordinal) => [
    `LAYER${ordinal}HOLEXOFFSET=${x}`,
    `LAYER${ordinal}HOLEYOFFSET=${y}`,
  ]).flat()
}
