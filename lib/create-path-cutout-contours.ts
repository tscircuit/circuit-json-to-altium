import type { Point } from "./types"

const GEOMETRY_EPSILON_MM = 1e-9
const MAXIMUM_ARC_ERROR_MM = 0.01

type PathSegment = {
  start: Point
  end: Point
  direction: Point
  normal: Point
  lengthMm: number
}

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
  slotCornerRadiusMm = slotWidthMm / 2,
}: CreatePathCutoutContoursOptions): Point[][] {
  if (slotWidthMm <= 0) throw new Error("A path cutout width must be positive")
  const segments = createPathSegments(route)
  const cornerRadiusMm = Math.min(
    Math.max(slotCornerRadiusMm, 0),
    slotWidthMm / 2,
  )

  if (slotLengthMm === undefined && spaceBetweenSlotsMm === undefined) {
    return [createStrokeContour(segments, slotWidthMm, cornerRadiusMm)]
  }
  if (
    slotLengthMm === undefined ||
    spaceBetweenSlotsMm === undefined ||
    slotLengthMm <= 0 ||
    spaceBetweenSlotsMm < 0
  ) {
    throw new Error(
      "Dashed path cutouts require a positive slot_length and non-negative space_between_slots",
    )
  }

  return splitPathIntoSlots(segments, slotLengthMm, spaceBetweenSlotsMm).map(
    (slotRoute) =>
      createStrokeContour(
        createPathSegments(slotRoute),
        slotWidthMm,
        cornerRadiusMm,
      ),
  )
}

function createPathSegments(route: readonly Point[]): PathSegment[] {
  const segments: PathSegment[] = []
  for (let pointIndex = 1; pointIndex < route.length; pointIndex++) {
    const start = route[pointIndex - 1]
    const end = route[pointIndex]
    if (!start || !end) continue
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthMm = Math.hypot(dx, dy)
    if (lengthMm <= GEOMETRY_EPSILON_MM) continue
    const direction = { x: dx / lengthMm, y: dy / lengthMm }
    segments.push({
      start,
      end,
      direction,
      normal: { x: -direction.y, y: direction.x },
      lengthMm,
    })
  }
  if (segments.length === 0) {
    throw new Error("A path cutout route must contain two distinct points")
  }
  return segments
}

function createStrokeContour(
  segments: readonly PathSegment[],
  slotWidthMm: number,
  cornerRadiusMm: number,
): Point[] {
  const halfWidthMm = slotWidthMm / 2
  const firstSegment = segments[0]!
  const lastSegment = segments.at(-1)!
  const leftSide = createOffsetSide(segments, halfWidthMm)
  const rightSide = createOffsetSide(segments, -halfWidthMm).reverse()
  return [
    ...createEndCap(firstSegment, halfWidthMm, cornerRadiusMm, true),
    ...leftSide.slice(1),
    ...createEndCap(lastSegment, halfWidthMm, cornerRadiusMm, false).slice(1),
    ...rightSide.slice(1),
  ]
}

function createOffsetSide(
  segments: readonly PathSegment[],
  offsetMm: number,
): Point[] {
  const firstSegment = segments[0]!
  const points: Point[] = [
    offsetPoint(firstSegment.start, firstSegment.normal, offsetMm),
  ]
  for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex++) {
    const previous = segments[segmentIndex - 1]!
    const next = segments[segmentIndex]!
    const previousStart = offsetPoint(previous.start, previous.normal, offsetMm)
    const nextStart = offsetPoint(next.start, next.normal, offsetMm)
    points.push(
      intersectLines(
        previousStart,
        previous.direction,
        nextStart,
        next.direction,
      ) ?? nextStart,
    )
  }
  const lastSegment = segments.at(-1)!
  points.push(offsetPoint(lastSegment.end, lastSegment.normal, offsetMm))
  return points
}

function createEndCap(
  segment: PathSegment,
  halfWidthMm: number,
  cornerRadiusMm: number,
  isStart: boolean,
): Point[] {
  const center = isStart ? segment.start : segment.end
  const directionSign = isStart ? -1 : 1
  const fromNormalSign = isStart ? -1 : 1
  const points: Point[] = [
    offsetPoint(center, segment.normal, fromNormalSign * halfWidthMm),
  ]
  if (cornerRadiusMm === 0) {
    points.push(
      offsetPoint(center, segment.normal, -fromNormalSign * halfWidthMm),
    )
    return points
  }

  const arcCenterOffsetMm = halfWidthMm - cornerRadiusMm
  const firstArcCenter = {
    x: center.x + segment.normal.x * fromNormalSign * arcCenterOffsetMm,
    y: center.y + segment.normal.y * fromNormalSign * arcCenterOffsetMm,
  }
  const secondArcCenter = {
    x: center.x - segment.normal.x * fromNormalSign * arcCenterOffsetMm,
    y: center.y - segment.normal.y * fromNormalSign * arcCenterOffsetMm,
  }
  const startAngleRadians = Math.atan2(
    segment.normal.y * fromNormalSign,
    segment.normal.x * fromNormalSign,
  )
  appendArc(
    points,
    firstArcCenter,
    cornerRadiusMm,
    startAngleRadians,
    -Math.PI / 2,
  )
  const faceOffset = {
    x: segment.direction.x * directionSign * cornerRadiusMm,
    y: segment.direction.y * directionSign * cornerRadiusMm,
  }
  points.push({
    x: secondArcCenter.x + faceOffset.x,
    y: secondArcCenter.y + faceOffset.y,
  })
  appendArc(
    points,
    secondArcCenter,
    cornerRadiusMm,
    Math.atan2(faceOffset.y, faceOffset.x),
    -Math.PI / 2,
  )
  return points
}

function appendArc(
  points: Point[],
  center: Point,
  radiusMm: number,
  startAngleRadians: number,
  sweepRadians: number,
): void {
  const maximumStepRadians =
    radiusMm <= MAXIMUM_ARC_ERROR_MM
      ? Math.PI / 2
      : 2 * Math.acos(1 - MAXIMUM_ARC_ERROR_MM / radiusMm)
  const segmentCount = Math.max(
    1,
    Math.ceil(Math.abs(sweepRadians) / maximumStepRadians),
  )
  for (let segmentIndex = 1; segmentIndex <= segmentCount; segmentIndex++) {
    const angleRadians =
      startAngleRadians + (sweepRadians * segmentIndex) / segmentCount
    points.push({
      x: center.x + Math.cos(angleRadians) * radiusMm,
      y: center.y + Math.sin(angleRadians) * radiusMm,
    })
  }
}

function splitPathIntoSlots(
  segments: readonly PathSegment[],
  slotLengthMm: number,
  spaceBetweenSlotsMm: number,
): Point[][] {
  const routeLengthMm = segments.reduce(
    (totalLengthMm, segment) => totalLengthMm + segment.lengthMm,
    0,
  )
  const slots: Point[][] = []
  for (
    let slotStartMm = 0;
    slotStartMm < routeLengthMm - GEOMETRY_EPSILON_MM;
    slotStartMm += slotLengthMm + spaceBetweenSlotsMm
  ) {
    slots.push(
      slicePath(
        segments,
        slotStartMm,
        Math.min(slotStartMm + slotLengthMm, routeLengthMm),
      ),
    )
  }
  return slots
}

function slicePath(
  segments: readonly PathSegment[],
  startDistanceMm: number,
  endDistanceMm: number,
): Point[] {
  const points: Point[] = []
  let traversedMm = 0
  for (const segment of segments) {
    const segmentStartMm = traversedMm
    const segmentEndMm = traversedMm + segment.lengthMm
    traversedMm = segmentEndMm
    if (segmentEndMm < startDistanceMm || segmentStartMm > endDistanceMm)
      continue
    const localStartMm = Math.max(startDistanceMm - segmentStartMm, 0)
    const localEndMm = Math.min(
      endDistanceMm - segmentStartMm,
      segment.lengthMm,
    )
    const start = pointAlongSegment(segment, localStartMm)
    const end = pointAlongSegment(segment, localEndMm)
    if (points.length === 0) points.push(start)
    points.push(end)
    if (segmentEndMm >= endDistanceMm) break
  }
  return points
}

function pointAlongSegment(segment: PathSegment, distanceMm: number): Point {
  return {
    x: segment.start.x + segment.direction.x * distanceMm,
    y: segment.start.y + segment.direction.y * distanceMm,
  }
}

function offsetPoint(point: Point, normal: Point, offsetMm: number): Point {
  return { x: point.x + normal.x * offsetMm, y: point.y + normal.y * offsetMm }
}

function intersectLines(
  firstPoint: Point,
  firstDirection: Point,
  secondPoint: Point,
  secondDirection: Point,
): Point | undefined {
  const denominator =
    firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x
  if (Math.abs(denominator) <= GEOMETRY_EPSILON_MM) return undefined
  const dx = secondPoint.x - firstPoint.x
  const dy = secondPoint.y - firstPoint.y
  const distanceAlongFirst =
    (dx * secondDirection.y - dy * secondDirection.x) / denominator
  return {
    x: firstPoint.x + firstDirection.x * distanceAlongFirst,
    y: firstPoint.y + firstDirection.y * distanceAlongFirst,
  }
}
