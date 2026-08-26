import { applyToPoint, compose, rotate, translate } from "transformation-matrix"
import { convertCircuitPcbCcwRotationDegreesToAltium } from "./convert-circuit-pcb-ccw-rotation-degrees-to-altium"
import { createPcbArcRecordFromBulge } from "./create-pcb-arc-record"
import {
  formatMil,
  formatNumber,
  MILLIMETERS_TO_MILS,
  pointsEqual,
} from "./format"
import type { Point, PointTransform, PointWithBulge } from "./types"

type CreateAltiumPcbPathRecordsOptions = {
  altiumComponentIndex?: number
  circuitPoints: readonly PointWithBulge[]
  circuitToAltiumPcbPoint: PointTransform
  closePath?: boolean
  layer: string
  strokeWidthMm: number
}

export function createAltiumPcbPathRecords({
  altiumComponentIndex,
  circuitPoints,
  circuitToAltiumPcbPoint,
  closePath = false,
  layer,
  strokeWidthMm,
}: CreateAltiumPcbPathRecordsOptions): string[] {
  const points = closePath ? closePointLoop(circuitPoints) : [...circuitPoints]
  const records: string[] = []

  for (let pointIndex = 1; pointIndex < points.length; pointIndex++) {
    const circuitStart = points[pointIndex - 1]
    const circuitEnd = points[pointIndex]
    if (!circuitStart || !circuitEnd) continue
    const bulge = circuitStart.bulge ?? 0
    if (Math.abs(bulge) >= 1e-12) {
      records.push(
        createPcbArcRecordFromBulge({
          altiumComponentIndex,
          bulge,
          circuitEndPoint: circuitEnd,
          circuitStartPoint: circuitStart,
          circuitToAltiumPcbPoint,
          layer,
          widthMm: strokeWidthMm,
        }),
      )
      continue
    }
    const altiumStart = circuitToAltiumPcbPoint(circuitStart)
    const altiumEnd = circuitToAltiumPcbPoint(circuitEnd)
    if (pointsEqual(altiumStart, altiumEnd)) continue
    records.push(
      [
        "|RECORD=Track",
        ...(altiumComponentIndex === undefined
          ? []
          : [`COMPONENT=${altiumComponentIndex}`]),
        `LAYER=${layer}`,
        "LOCKED=FALSE",
        `X1=${formatMil(altiumStart.x)}`,
        `Y1=${formatMil(altiumStart.y)}`,
        `X2=${formatMil(altiumEnd.x)}`,
        `Y2=${formatMil(altiumEnd.y)}`,
        `WIDTH=${formatMil(strokeWidthMm * MILLIMETERS_TO_MILS)}`,
      ].join("|"),
    )
  }

  return records
}

export function createAltiumFillRecord({
  altiumComponentIndex,
  center,
  circuitToAltiumPcbPoint,
  heightMm,
  isKeepout = false,
  layer,
  rotationDegrees = 0,
  widthMm,
}: {
  altiumComponentIndex?: number
  center: Point
  circuitToAltiumPcbPoint: PointTransform
  heightMm: number
  isKeepout?: boolean
  layer: string
  rotationDegrees?: number
  widthMm: number
}): string {
  const altiumStart = circuitToAltiumPcbPoint({
    x: center.x - widthMm / 2,
    y: center.y - heightMm / 2,
  })
  const altiumEnd = circuitToAltiumPcbPoint({
    x: center.x + widthMm / 2,
    y: center.y + heightMm / 2,
  })
  return [
    "|RECORD=Fill",
    ...(altiumComponentIndex === undefined
      ? []
      : [`COMPONENT=${altiumComponentIndex}`]),
    `LAYER=${layer}`,
    `KEEPOUT=${isKeepout ? "TRUE" : "FALSE"}`,
    "LOCKED=FALSE",
    `X1=${formatMil(altiumStart.x)}`,
    `Y1=${formatMil(altiumStart.y)}`,
    `X2=${formatMil(altiumEnd.x)}`,
    `Y2=${formatMil(altiumEnd.y)}`,
    `ROTATION=${formatNumber(convertCircuitPcbCcwRotationDegreesToAltium(rotationDegrees))}`,
  ].join("|")
}

export function createAltiumRegionRecord({
  altiumComponentIndex,
  circuitPoints,
  circuitToAltiumPcbPoint,
  isKeepout = false,
  layer,
}: {
  altiumComponentIndex?: number
  circuitPoints: readonly Point[]
  circuitToAltiumPcbPoint: PointTransform
  isKeepout?: boolean
  layer: string
}): string {
  const altiumPoints = closePointLoop(circuitPoints).map(
    circuitToAltiumPcbPoint,
  )
  if (altiumPoints.length < 4) {
    throw new Error("An Altium PCB region requires at least three vertices")
  }
  return [
    "|RECORD=Region",
    ...(altiumComponentIndex === undefined
      ? []
      : [`COMPONENT=${altiumComponentIndex}`]),
    `LAYER=${layer}`,
    "LOCKED=FALSE",
    `KEEPOUT=${isKeepout ? "TRUE" : "FALSE"}`,
    "TEARDROP=FALSE",
    "REGIONKIND=COPPER",
    "HOLECOUNT=0",
    ...altiumPoints.flatMap((point, vertexIndex) => [
      `KIND${vertexIndex}=0`,
      `VX${vertexIndex}=${formatMil(point.x)}`,
      `VY${vertexIndex}=${formatMil(point.y)}`,
    ]),
  ].join("|")
}

export function createRoundedRectPoints({
  center,
  cornerRadiusMm,
  heightMm,
  rotationDegrees = 0,
  widthMm,
}: {
  center: Point
  cornerRadiusMm: number
  heightMm: number
  rotationDegrees?: number
  widthMm: number
}): Point[] {
  const halfWidthMm = widthMm / 2
  const halfHeightMm = heightMm / 2
  const radiusMm = Math.min(
    Math.max(cornerRadiusMm, 0),
    halfWidthMm,
    halfHeightMm,
  )
  const localPoints =
    radiusMm === 0
      ? [
          { x: -halfWidthMm, y: -halfHeightMm },
          { x: halfWidthMm, y: -halfHeightMm },
          { x: halfWidthMm, y: halfHeightMm },
          { x: -halfWidthMm, y: halfHeightMm },
        ]
      : createRoundedCornerPoints({ halfHeightMm, halfWidthMm, radiusMm })
  const localToCircuit = compose(
    translate(center.x, center.y),
    rotate((rotationDegrees * Math.PI) / 180),
  )
  return localPoints.map((point) => applyToPoint(localToCircuit, point))
}

function createRoundedCornerPoints({
  halfHeightMm,
  halfWidthMm,
  radiusMm,
}: {
  halfHeightMm: number
  halfWidthMm: number
  radiusMm: number
}): Point[] {
  const cornerCenters = [
    { x: halfWidthMm - radiusMm, y: halfHeightMm - radiusMm, start: 0 },
    {
      x: -halfWidthMm + radiusMm,
      y: halfHeightMm - radiusMm,
      start: 90,
    },
    {
      x: -halfWidthMm + radiusMm,
      y: -halfHeightMm + radiusMm,
      start: 180,
    },
    {
      x: halfWidthMm - radiusMm,
      y: -halfHeightMm + radiusMm,
      start: 270,
    },
  ]
  const segmentsPerCorner = 8
  return cornerCenters.flatMap((corner) =>
    Array.from({ length: segmentsPerCorner }, (_, segmentIndex) => {
      const angleDegrees =
        corner.start + (segmentIndex * 90) / segmentsPerCorner
      const angleRadians = (angleDegrees * Math.PI) / 180
      return {
        x: corner.x + Math.cos(angleRadians) * radiusMm,
        y: corner.y + Math.sin(angleRadians) * radiusMm,
      }
    }),
  )
}

function closePointLoop(points: readonly PointWithBulge[]): PointWithBulge[] {
  const loop = [...points]
  const firstPoint = loop[0]
  const lastPoint = loop.at(-1)
  if (firstPoint && lastPoint && !pointsEqual(firstPoint, lastPoint)) {
    loop.push(firstPoint)
  }
  return loop
}
