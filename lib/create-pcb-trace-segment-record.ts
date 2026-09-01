import { formatMil, formatNumber } from "./format"
import type { Point } from "./types"

type CreatePcbTraceSegmentRecordOptions = {
  altiumEndPoint: Point
  altiumStartPoint: Point
  bulge: number
  layer: string
  netIndex?: number
  widthMils: number
}

type PcbArcGeometry = {
  center: Point
  endAngleDegrees: number
  radiusMils: number
  startAngleDegrees: number
}

const MINIMUM_BULGE_MAGNITUDE = 1e-12

export function createPcbTraceSegmentRecord({
  altiumEndPoint,
  altiumStartPoint,
  bulge,
  layer,
  netIndex,
  widthMils,
}: CreatePcbTraceSegmentRecordOptions): string {
  const sharedFields = [
    ...(netIndex === undefined ? [] : [`NET=${netIndex}`]),
    `LAYER=${layer}`,
    "LOCKED=FALSE",
  ]
  const arcGeometry = getPcbArcGeometry({
    bulge,
    endPoint: altiumEndPoint,
    startPoint: altiumStartPoint,
  })
  if (arcGeometry) {
    return [
      "|RECORD=Arc",
      ...sharedFields,
      `LOCATION.X=${formatMil(arcGeometry.center.x)}`,
      `LOCATION.Y=${formatMil(arcGeometry.center.y)}`,
      `RADIUS=${formatMil(arcGeometry.radiusMils)}`,
      `STARTANGLE=${formatNumber(arcGeometry.startAngleDegrees)}`,
      `ENDANGLE=${formatNumber(arcGeometry.endAngleDegrees)}`,
      `WIDTH=${formatMil(widthMils)}`,
    ].join("|")
  }

  return [
    "|RECORD=Track",
    ...sharedFields,
    `X1=${formatMil(altiumStartPoint.x)}`,
    `Y1=${formatMil(altiumStartPoint.y)}`,
    `X2=${formatMil(altiumEndPoint.x)}`,
    `Y2=${formatMil(altiumEndPoint.y)}`,
    `WIDTH=${formatMil(widthMils)}`,
  ].join("|")
}

function getPcbArcGeometry({
  bulge,
  endPoint,
  startPoint,
}: {
  bulge: number
  endPoint: Point
  startPoint: Point
}): PcbArcGeometry | undefined {
  if (!Number.isFinite(bulge) || Math.abs(bulge) < MINIMUM_BULGE_MAGNITUDE) {
    return undefined
  }

  const deltaX = endPoint.x - startPoint.x
  const deltaY = endPoint.y - startPoint.y
  const centerScale = (1 - bulge * bulge) / (4 * bulge)
  const center = {
    x: (startPoint.x + endPoint.x) / 2 - deltaY * centerScale,
    y: (startPoint.y + endPoint.y) / 2 + deltaX * centerScale,
  }
  const radiusMils = Math.hypot(
    startPoint.x - center.x,
    startPoint.y - center.y,
  )
  if (!Number.isFinite(radiusMils) || radiusMils <= 0) return undefined

  const startAngleDegrees = normalizeAngleDegreesToUnsignedTurn(
    radiansToDegrees(
      Math.atan2(startPoint.y - center.y, startPoint.x - center.x),
    ),
  )
  return {
    center,
    endAngleDegrees: startAngleDegrees + radiansToDegrees(4 * Math.atan(bulge)),
    radiusMils,
    startAngleDegrees,
  }
}

function normalizeAngleDegreesToUnsignedTurn(angleDegrees: number): number {
  return ((angleDegrees % 360) + 360) % 360
}

function radiansToDegrees(angleRadians: number): number {
  return (angleRadians * 180) / Math.PI
}
