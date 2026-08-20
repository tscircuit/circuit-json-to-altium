import { asNumber, asPoint, isCircuitElement } from "./format"
import type { PointWithBulge } from "./types"

export function getCircuitPathPoints(route: unknown): PointWithBulge[] {
  if (!Array.isArray(route)) return []

  return route.flatMap((routePoint) => {
    if (!isCircuitElement(routePoint)) return []
    const point = asPoint(routePoint)
    if (!point) return []
    const bulge = asNumber(routePoint.bulge)

    return [{ ...point, ...(Math.abs(bulge) < 1e-12 ? {} : { bulge }) }]
  })
}
