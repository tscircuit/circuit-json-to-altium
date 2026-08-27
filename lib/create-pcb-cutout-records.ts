import { type PcbCutout, pcb_cutout } from "circuit-json"
import {
  createCirclePoints,
  createRoundedRectPoints,
} from "./create-pcb-annotation-primitives"
import { formatMil, getPolygonArea, pointsEqual } from "./format"
import type { CircuitElement, Point, PointTransform } from "./types"

type CreatePcbCutoutRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
}

type CutoutRegion = {
  innerRings?: Point[][]
  outerRing: Point[]
}

const GEOMETRY_EPSILON = 1e-9
const MAXIMUM_MITER_RATIO = 4
const ROUNDED_CORNER_SEGMENTS = 8

export function createPcbCutoutRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
}: CreatePcbCutoutRecordsOptions): string[] {
  const records: string[] = []

  for (const element of circuitJson) {
    if (element.type !== "pcb_cutout") continue
    const cutout = pcb_cutout.parse(element)
    for (const region of getCutoutRegions(cutout)) {
      records.push(
        createBoardCutoutRegionRecord({
          circuitToAltiumPcbPoint,
          innerRings: region.innerRings ?? [],
          outerRing: region.outerRing,
        }),
      )
    }
  }

  return records
}

function getCutoutRegions(cutout: PcbCutout): CutoutRegion[] {
  if (cutout.shape === "rect") {
    return [
      {
        outerRing: createRoundedRectPoints({
          center: cutout.center,
          cornerRadiusMm: cutout.corner_radius ?? 0,
          heightMm: cutout.height,
          rotationDegrees: cutout.rotation ?? 0,
          widthMm: cutout.width,
        }),
      },
    ]
  }
  if (cutout.shape === "circle") {
    return [
      {
        outerRing: createCirclePoints({
          center: cutout.center,
          radiusMm: cutout.radius,
        }),
      },
    ]
  }
  if (cutout.shape === "polygon") {
    return [{ outerRing: cutout.points }]
  }
  return getPathCutoutRegions(cutout)
}

function getPathCutoutRegions(
  cutout: Extract<PcbCutout, { shape: "path" }>,
): CutoutRegion[] {
  const route = removeConsecutiveDuplicatePoints(cutout.route)
  const firstPoint = route[0]
  const lastPoint = route.at(-1)
  const isClosed =
    route.length >= 3 &&
    firstPoint !== undefined &&
    lastPoint !== undefined &&
    pointsEqual(firstPoint, lastPoint)
  if (isClosed) route.pop()
  if (route.length === 0) return []

  const halfWidthMm = cutout.slot_width / 2
  const cornerRadiusMm = Math.min(
    Math.max(cutout.slot_corner_radius ?? halfWidthMm, 0),
    halfWidthMm,
  )
  if (route.length === 1) {
    const center = route[0]
    if (!center) return []
    return [
      {
        outerRing: createRoundedRectPoints({
          center,
          cornerRadiusMm,
          heightMm: cutout.slot_width,
          widthMm: cutout.slot_width,
        }),
      },
    ]
  }

  const hasDashedSlots =
    cutout.slot_length !== undefined &&
    cutout.slot_length > GEOMETRY_EPSILON &&
    cutout.space_between_slots !== undefined &&
    cutout.space_between_slots > GEOMETRY_EPSILON
  if (hasDashedSlots) {
    const path = isClosed ? [...route, route[0] as Point] : route
    return splitPolylineIntoDashes({
      dashLength: cutout.slot_length as number,
      gapLength: cutout.space_between_slots as number,
      points: path,
    }).flatMap((dash) =>
      getOpenStrokeRegion({
        cornerRadiusMm,
        halfWidthMm,
        points: dash,
      }),
    )
  }

  if (isClosed) {
    return getClosedStrokeRegion({ halfWidthMm, points: route })
  }
  return getOpenStrokeRegion({ cornerRadiusMm, halfWidthMm, points: route })
}

function getOpenStrokeRegion({
  cornerRadiusMm,
  halfWidthMm,
  points,
}: {
  cornerRadiusMm: number
  halfWidthMm: number
  points: Point[]
}): CutoutRegion[] {
  const route = removeConsecutiveDuplicatePoints(points)
  if (route.length < 2 || halfWidthMm <= GEOMETRY_EPSILON) return []
  const start = route[0]
  const end = route.at(-1)
  const startDirection = getUnitDirection(start, route[1])
  const endDirection = getUnitDirection(route.at(-2), end)
  if (!start || !end || !startDirection || !endDirection) return []

  const leftBoundary = getOpenOffsetBoundary(route, halfWidthMm)
  const rightBoundary = getOpenOffsetBoundary(route, -halfWidthMm)
  const leftStart = addPoints(
    leftBoundary[0] as Point,
    scalePoint(startDirection, -(halfWidthMm - cornerRadiusMm)),
  )
  const leftEnd = addPoints(
    leftBoundary.at(-1) as Point,
    scalePoint(endDirection, halfWidthMm - cornerRadiusMm),
  )
  const rightEnd = addPoints(
    rightBoundary.at(-1) as Point,
    scalePoint(endDirection, halfWidthMm - cornerRadiusMm),
  )
  const rightStart = addPoints(
    rightBoundary[0] as Point,
    scalePoint(startDirection, -(halfWidthMm - cornerRadiusMm)),
  )
  leftBoundary[0] = leftStart
  leftBoundary[leftBoundary.length - 1] = leftEnd
  rightBoundary[0] = rightStart
  rightBoundary[rightBoundary.length - 1] = rightEnd

  const outerRing = [...leftBoundary]
  appendRoundedEndCap({
    center: end,
    cornerRadiusMm,
    halfWidthMm,
    normal: leftNormal(endDirection),
    outward: endDirection,
    points: outerRing,
  })
  outerRing.push(...rightBoundary.slice(0, -1).reverse())
  appendRoundedEndCap({
    center: start,
    cornerRadiusMm,
    halfWidthMm,
    normal: scalePoint(leftNormal(startDirection), -1),
    outward: scalePoint(startDirection, -1),
    points: outerRing,
  })
  return [{ outerRing }]
}

function getClosedStrokeRegion({
  halfWidthMm,
  points,
}: {
  halfWidthMm: number
  points: Point[]
}): CutoutRegion[] {
  if (points.length < 3 || halfWidthMm <= GEOMETRY_EPSILON) return []
  const leftRing = getClosedOffsetBoundary(points, halfWidthMm)
  const rightRing = getClosedOffsetBoundary(points, -halfWidthMm)
  if (leftRing.length < 3 || rightRing.length < 3) return []
  const [outerRing, innerRing] =
    getPolygonArea(leftRing) >= getPolygonArea(rightRing)
      ? [leftRing, rightRing]
      : [rightRing, leftRing]
  return [{ innerRings: [innerRing], outerRing }]
}

function getOpenOffsetBoundary(points: Point[], offset: number): Point[] {
  const firstDirection = getUnitDirection(points[0], points[1])
  const lastDirection = getUnitDirection(points.at(-2), points.at(-1))
  const firstPoint = points[0]
  const lastPoint = points.at(-1)
  if (!firstPoint || !lastPoint || !firstDirection || !lastDirection) return []
  const boundary = [
    addPoints(firstPoint, scalePoint(leftNormal(firstDirection), offset)),
  ]
  for (let index = 1; index < points.length - 1; index++) {
    appendOffsetJoin({ boundary, index, offset, points })
  }
  boundary.push(
    addPoints(lastPoint, scalePoint(leftNormal(lastDirection), offset)),
  )
  return boundary
}

function getClosedOffsetBoundary(points: Point[], offset: number): Point[] {
  const boundary: Point[] = []
  for (const [index] of points.entries()) {
    appendOffsetJoin({ boundary, index, offset, points, wrap: true })
  }
  return boundary
}

function appendOffsetJoin({
  boundary,
  index,
  offset,
  points,
  wrap = false,
}: {
  boundary: Point[]
  index: number
  offset: number
  points: Point[]
  wrap?: boolean
}): void {
  const point = points[index]
  const previousPoint =
    points[wrap ? (index - 1 + points.length) % points.length : index - 1]
  const nextPoint = points[wrap ? (index + 1) % points.length : index + 1]
  const previousDirection = getUnitDirection(previousPoint, point)
  const nextDirection = getUnitDirection(point, nextPoint)
  if (!point || !previousDirection || !nextDirection) return
  const previousOffsetPoint = addPoints(
    point,
    scalePoint(leftNormal(previousDirection), offset),
  )
  const nextOffsetPoint = addPoints(
    point,
    scalePoint(leftNormal(nextDirection), offset),
  )
  const intersection = getLineIntersection({
    firstDirection: previousDirection,
    firstPoint: previousOffsetPoint,
    secondDirection: nextDirection,
    secondPoint: nextOffsetPoint,
  })
  if (
    intersection &&
    Math.hypot(intersection.x - point.x, intersection.y - point.y) <=
      Math.abs(offset) * MAXIMUM_MITER_RATIO
  ) {
    appendDistinctPoint(boundary, intersection)
    return
  }
  appendDistinctPoint(boundary, previousOffsetPoint)
  appendDistinctPoint(boundary, nextOffsetPoint)
}

function appendRoundedEndCap({
  center,
  cornerRadiusMm,
  halfWidthMm,
  normal,
  outward,
  points,
}: {
  center: Point
  cornerRadiusMm: number
  halfWidthMm: number
  normal: Point
  outward: Point
  points: Point[]
}): void {
  if (cornerRadiusMm <= GEOMETRY_EPSILON) {
    appendDistinctPoint(
      points,
      addPoints(
        center,
        scalePoint(outward, halfWidthMm),
        scalePoint(normal, halfWidthMm),
      ),
    )
    appendDistinctPoint(
      points,
      addPoints(
        center,
        scalePoint(outward, halfWidthMm),
        scalePoint(normal, -halfWidthMm),
      ),
    )
    return
  }

  const inset = halfWidthMm - cornerRadiusMm
  const firstCornerCenter = addPoints(
    center,
    scalePoint(outward, inset),
    scalePoint(normal, inset),
  )
  appendArc({
    center: firstCornerCenter,
    endAngleRadians: 0,
    normal,
    outward,
    points,
    radius: cornerRadiusMm,
    startAngleRadians: Math.PI / 2,
  })
  const secondCornerCenter = addPoints(
    center,
    scalePoint(outward, inset),
    scalePoint(normal, -inset),
  )
  appendArc({
    center: secondCornerCenter,
    endAngleRadians: -Math.PI / 2,
    normal,
    outward,
    points,
    radius: cornerRadiusMm,
    startAngleRadians: 0,
  })
}

function appendArc({
  center,
  endAngleRadians,
  normal,
  outward,
  points,
  radius,
  startAngleRadians,
}: {
  center: Point
  endAngleRadians: number
  normal: Point
  outward: Point
  points: Point[]
  radius: number
  startAngleRadians: number
}): void {
  for (let index = 1; index <= ROUNDED_CORNER_SEGMENTS; index++) {
    const angleRadians =
      startAngleRadians +
      ((endAngleRadians - startAngleRadians) * index) / ROUNDED_CORNER_SEGMENTS
    appendDistinctPoint(
      points,
      addPoints(
        center,
        scalePoint(outward, Math.cos(angleRadians) * radius),
        scalePoint(normal, Math.sin(angleRadians) * radius),
      ),
    )
  }
}

function splitPolylineIntoDashes({
  dashLength,
  gapLength,
  points,
}: {
  dashLength: number
  gapLength: number
  points: Point[]
}): Point[][] {
  const cumulativeLengths = [0]
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1]
    const end = points[index]
    if (!start || !end) continue
    cumulativeLengths.push(
      (cumulativeLengths.at(-1) ?? 0) +
        Math.hypot(end.x - start.x, end.y - start.y),
    )
  }
  const totalLength = cumulativeLengths.at(-1) ?? 0
  const dashes: Point[][] = []
  for (
    let dashStart = 0;
    dashStart < totalLength - GEOMETRY_EPSILON;
    dashStart += dashLength + gapLength
  ) {
    const dashEnd = Math.min(dashStart + dashLength, totalLength)
    const dash: Point[] = []
    const startPoint = getPointAtPolylineDistance({
      cumulativeLengths,
      distance: dashStart,
      points,
    })
    const endPoint = getPointAtPolylineDistance({
      cumulativeLengths,
      distance: dashEnd,
      points,
    })
    if (!startPoint || !endPoint) continue
    dash.push(startPoint)
    for (let index = 1; index < points.length - 1; index++) {
      const pointDistance = cumulativeLengths[index]
      const point = points[index]
      if (
        point &&
        pointDistance !== undefined &&
        pointDistance > dashStart + GEOMETRY_EPSILON &&
        pointDistance < dashEnd - GEOMETRY_EPSILON
      ) {
        dash.push(point)
      }
    }
    appendDistinctPoint(dash, endPoint)
    if (dash.length >= 2) dashes.push(dash)
  }
  return dashes
}

function getPointAtPolylineDistance({
  cumulativeLengths,
  distance,
  points,
}: {
  cumulativeLengths: number[]
  distance: number
  points: Point[]
}): Point | undefined {
  for (let index = 1; index < cumulativeLengths.length; index++) {
    const segmentStartDistance = cumulativeLengths[index - 1]
    const segmentEndDistance = cumulativeLengths[index]
    const segmentStart = points[index - 1]
    const segmentEnd = points[index]
    if (
      segmentStartDistance === undefined ||
      segmentEndDistance === undefined ||
      !segmentStart ||
      !segmentEnd ||
      distance > segmentEndDistance + GEOMETRY_EPSILON
    ) {
      continue
    }
    const segmentLength = segmentEndDistance - segmentStartDistance
    if (segmentLength <= GEOMETRY_EPSILON) continue
    const ratio = Math.min(
      Math.max((distance - segmentStartDistance) / segmentLength, 0),
      1,
    )
    return {
      x: segmentStart.x + (segmentEnd.x - segmentStart.x) * ratio,
      y: segmentStart.y + (segmentEnd.y - segmentStart.y) * ratio,
    }
  }
  return points.at(-1)
}

function createBoardCutoutRegionRecord({
  circuitToAltiumPcbPoint,
  innerRings,
  outerRing,
}: {
  circuitToAltiumPcbPoint: PointTransform
  innerRings: Point[][]
  outerRing: Point[]
}): string {
  const altiumOuterRing = closeValidRing(outerRing).map(circuitToAltiumPcbPoint)
  const altiumInnerRings = innerRings.map((ring) =>
    closeValidRing(ring).map(circuitToAltiumPcbPoint),
  )
  return [
    "|RECORD=Region",
    "LAYER=MULTILAYER",
    "LOCKED=FALSE",
    "KEEPOUT=FALSE",
    "TEARDROP=FALSE",
    "ISBOARDCUTOUT=TRUE",
    "REGIONKIND=COPPER",
    `HOLECOUNT=${altiumInnerRings.length}`,
    ...createContourFields(altiumOuterRing),
    ...altiumInnerRings.flatMap(createHoleFields),
  ].join("|")
}

function closeValidRing(points: Point[]): Point[] {
  const ring = removeConsecutiveDuplicatePoints(points)
  const firstPoint = ring[0]
  const lastPoint = ring.at(-1)
  if (firstPoint && lastPoint && !pointsEqual(firstPoint, lastPoint)) {
    ring.push(firstPoint)
  }
  if (ring.length < 4 || getPolygonArea(ring) <= GEOMETRY_EPSILON) {
    throw new Error("A PCB board cutout requires at least three vertices")
  }
  return ring
}

function createContourFields(points: Point[]): string[] {
  return points.flatMap((point, vertexIndex) => [
    `KIND${vertexIndex}=0`,
    `VX${vertexIndex}=${formatMil(point.x)}`,
    `VY${vertexIndex}=${formatMil(point.y)}`,
  ])
}

function createHoleFields(points: Point[], holeIndex: number): string[] {
  return [
    `HOLE${holeIndex}COUNT=${points.length}`,
    ...points.flatMap((point, vertexIndex) => [
      `HOLE${holeIndex}VX${vertexIndex}=${formatMil(point.x)}`,
      `HOLE${holeIndex}VY${vertexIndex}=${formatMil(point.y)}`,
    ]),
  ]
}

function removeConsecutiveDuplicatePoints(points: readonly Point[]): Point[] {
  const distinctPoints: Point[] = []
  for (const point of points) appendDistinctPoint(distinctPoints, point)
  return distinctPoints
}

function appendDistinctPoint(points: Point[], point: Point): void {
  const previousPoint = points.at(-1)
  if (!previousPoint || !pointsEqual(previousPoint, point)) points.push(point)
}

function getUnitDirection(
  start: Point | undefined,
  end: Point | undefined,
): Point | undefined {
  if (!start || !end) return undefined
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const length = Math.hypot(deltaX, deltaY)
  if (length <= GEOMETRY_EPSILON) return undefined
  return { x: deltaX / length, y: deltaY / length }
}

function leftNormal(direction: Point): Point {
  return { x: -direction.y, y: direction.x }
}

function scalePoint(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale }
}

function addPoints(...points: Point[]): Point {
  return points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  )
}

function crossProduct(left: Point, right: Point): number {
  return left.x * right.y - left.y * right.x
}

function getLineIntersection({
  firstDirection,
  firstPoint,
  secondDirection,
  secondPoint,
}: {
  firstDirection: Point
  firstPoint: Point
  secondDirection: Point
  secondPoint: Point
}): Point | undefined {
  const denominator = crossProduct(firstDirection, secondDirection)
  if (Math.abs(denominator) <= GEOMETRY_EPSILON) return undefined
  const betweenStarts = {
    x: secondPoint.x - firstPoint.x,
    y: secondPoint.y - firstPoint.y,
  }
  const distanceAlongFirst =
    crossProduct(betweenStarts, secondDirection) / denominator
  return addPoints(firstPoint, scalePoint(firstDirection, distanceAlongFirst))
}
