import { formatMil, MILLIMETERS_TO_MILS, pointsEqual } from "./format"
import type { Point, PointTransform } from "./types"

type CreatePcbArcRecordFromBulgeOptions = {
  altiumComponentIndex?: number
  altiumNetIndex?: number
  bulge: number
  circuitEndPoint: Point
  circuitStartPoint: Point
  circuitToAltiumPcbPoint: PointTransform
  layer: string
  isKeepout?: boolean
  widthMm: number
}

type CreatePcbFullCircleArcRecordOptions = {
  altiumComponentIndex?: number
  center: Point
  circuitToAltiumPcbPoint: PointTransform
  layer: string
  isKeepout?: boolean
  radiusMm: number
  widthMm: number
}

export function createPcbArcRecordFromBulge({
  altiumComponentIndex,
  altiumNetIndex,
  bulge,
  circuitEndPoint,
  circuitStartPoint,
  circuitToAltiumPcbPoint,
  layer,
  isKeepout = false,
  widthMm,
}: CreatePcbArcRecordFromBulgeOptions): string {
  if (!Number.isFinite(bulge) || Math.abs(bulge) < 1e-12) {
    throw new Error("A PCB arc requires a finite nonzero bulge")
  }
  if (pointsEqual(circuitStartPoint, circuitEndPoint)) {
    throw new Error("A partial PCB arc requires two distinct endpoints")
  }

  const deltaX = circuitEndPoint.x - circuitStartPoint.x
  const deltaY = circuitEndPoint.y - circuitStartPoint.y
  const centerScale = (1 - bulge * bulge) / (4 * bulge)
  const circuitCenter = {
    x: (circuitStartPoint.x + circuitEndPoint.x) / 2 - deltaY * centerScale,
    y: (circuitStartPoint.y + circuitEndPoint.y) / 2 + deltaX * centerScale,
  }
  const circuitCcwSweepDegrees = radiansToDegrees(4 * Math.atan(bulge))
  const altiumCenter = circuitToAltiumPcbPoint(circuitCenter)
  const altiumArcStart = circuitToAltiumPcbPoint(circuitStartPoint)
  const radiusMils = Math.hypot(
    altiumArcStart.x - altiumCenter.x,
    altiumArcStart.y - altiumCenter.y,
  )
  const startAngleDegrees = getPointAngleDegrees(altiumCenter, altiumArcStart)

  return createPcbArcRecord({
    altiumComponentIndex,
    altiumNetIndex,
    center: altiumCenter,
    endAngleDegrees: startAngleDegrees + circuitCcwSweepDegrees,
    isKeepout,
    layer,
    radiusMils,
    startAngleDegrees,
    widthMils: widthMm * MILLIMETERS_TO_MILS,
  })
}

export function createPcbFullCircleArcRecord({
  altiumComponentIndex,
  center,
  circuitToAltiumPcbPoint,
  layer,
  isKeepout = false,
  radiusMm,
  widthMm,
}: CreatePcbFullCircleArcRecordOptions): string {
  if (!Number.isFinite(radiusMm) || radiusMm <= 0) {
    throw new Error("A PCB circle requires a positive radius")
  }
  return createPcbArcRecord({
    altiumComponentIndex,
    center: circuitToAltiumPcbPoint(center),
    endAngleDegrees: 360,
    isKeepout,
    layer,
    radiusMils: radiusMm * MILLIMETERS_TO_MILS,
    startAngleDegrees: 0,
    widthMils: widthMm * MILLIMETERS_TO_MILS,
  })
}

function createPcbArcRecord({
  altiumComponentIndex,
  altiumNetIndex,
  center,
  endAngleDegrees,
  layer,
  isKeepout,
  radiusMils,
  startAngleDegrees,
  widthMils,
}: {
  altiumComponentIndex?: number
  altiumNetIndex?: number
  center: Point
  endAngleDegrees: number
  layer: string
  isKeepout: boolean
  radiusMils: number
  startAngleDegrees: number
  widthMils: number
}): string {
  return [
    "|RECORD=Arc",
    ...(altiumComponentIndex === undefined
      ? []
      : [`COMPONENT=${altiumComponentIndex}`]),
    ...(altiumNetIndex === undefined ? [] : [`NET=${altiumNetIndex}`]),
    `LAYER=${layer}`,
    `KEEPOUT=${isKeepout ? "TRUE" : "FALSE"}`,
    "LOCKED=FALSE",
    `LOCATION.X=${formatMil(center.x)}`,
    `LOCATION.Y=${formatMil(center.y)}`,
    `RADIUS=${formatMil(radiusMils)}`,
    `STARTANGLE=${formatArcAngleDegrees(startAngleDegrees)}`,
    `ENDANGLE=${formatArcAngleDegrees(endAngleDegrees)}`,
    `WIDTH=${formatMil(widthMils)}`,
  ].join("|")
}

function getPointAngleDegrees(center: Point, point: Point): number {
  return normalizeDegrees(
    radiansToDegrees(Math.atan2(point.y - center.y, point.x - center.x)),
  )
}

function normalizeDegrees(angleDegrees: number): number {
  const normalizedDegrees = ((angleDegrees % 360) + 360) % 360
  return Math.abs(normalizedDegrees - 360) < 1e-9 ? 0 : normalizedDegrees
}

function radiansToDegrees(angleRadians: number): number {
  return (angleRadians * 180) / Math.PI
}

function formatArcAngleDegrees(angleDegrees: number): string {
  const roundedAngleDegrees = Math.round(angleDegrees * 1e10) / 1e10
  return Number.isInteger(roundedAngleDegrees)
    ? String(roundedAngleDegrees)
    : roundedAngleDegrees.toFixed(10).replace(/0+$/u, "")
}
