import { asPoint, isCircuitElement } from "./format"
import type { PointWithBulge } from "./types"

export function getCircuitPathPoints(route: unknown): PointWithBulge[] {
  if (!Array.isArray(route)) return []

  return route.flatMap((routePoint) => {
    if (!isCircuitElement(routePoint)) return []
    const point = asPoint(routePoint)
    if (!point) return []
    const bulge = getCircuitPathPointBulge(routePoint.bulge)

    return [{ ...point, ...(bulge === undefined ? {} : { bulge }) }]
  })
}

export function getCircuitPathPointBulge(
  circuitBulge: unknown,
): number | undefined {
  if (circuitBulge === undefined) return undefined
  if (typeof circuitBulge !== "number" || !Number.isFinite(circuitBulge)) {
    throw new Error("A PCB path bulge must be a finite number")
  }
  return Math.abs(circuitBulge) < 1e-12 ? undefined : circuitBulge
}
