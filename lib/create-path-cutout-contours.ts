import { EndType, inflatePathsD, JoinType, type PathD } from "clipper2-ts"
import type { Point } from "./types"

type CreatePathCutoutContoursOptions = {
  route: readonly Point[]
  slotWidthMm: number
  slotLengthMm?: number
  spaceBetweenSlotsMm?: number
  slotCornerRadiusMm?: number
}

export function createPathCutoutContours({
  route,
  slotWidthMm,
  slotLengthMm,
  spaceBetweenSlotsMm,
  slotCornerRadiusMm,
}: CreatePathCutoutContoursOptions): Point[][] {
  if (route.length < 2) {
    throw new Error("A path cutout route must contain at least two points")
  }
  if (slotWidthMm <= 0) {
    throw new Error("A path cutout width must be positive")
  }
  if (slotLengthMm !== undefined || spaceBetweenSlotsMm !== undefined) {
    throw new Error("Dashed path cutouts are not supported")
  }

  const halfWidthMm = slotWidthMm / 2
  const endType = getPathEndType({ halfWidthMm, slotCornerRadiusMm })
  const path: PathD = route.map(({ x, y }) => ({ x, y }))
  const contours = inflatePathsD([path], halfWidthMm, JoinType.Round, endType)
  if (contours.length === 0) {
    throw new Error("A path cutout route must contain two distinct points")
  }
  return contours
}

function getPathEndType({
  halfWidthMm,
  slotCornerRadiusMm,
}: {
  halfWidthMm: number
  slotCornerRadiusMm?: number
}): EndType {
  if (slotCornerRadiusMm === undefined || slotCornerRadiusMm === halfWidthMm) {
    return EndType.Round
  }
  if (slotCornerRadiusMm === 0) return EndType.Square
  throw new Error(
    "Path cutout slot_corner_radius must be zero or half of slot_width",
  )
}
