import type { CircuitElement, Point } from "../../lib/types"

const POSITION_TOLERANCE_MM = 0.0001
const ROTATION_TOLERANCE_DEGREES = 0.0001

type SolderPasteComparisonOptions = {
  roundTripCircuitJson: CircuitElement[]
  sourceCircuitJson: CircuitElement[]
}

export function getSolderPasteMismatchCount({
  roundTripCircuitJson,
  sourceCircuitJson,
}: SolderPasteComparisonOptions): number {
  const sourceSolderPaste = getSolderPasteElements(sourceCircuitJson)
  const roundTripSolderPaste = getSolderPasteElements(roundTripCircuitJson)
  if (sourceSolderPaste.length !== roundTripSolderPaste.length) {
    return Number.POSITIVE_INFINITY
  }
  const sourceAnchor = getSolderPasteAnchor(sourceSolderPaste[0])
  const roundTripAnchor = getSolderPasteAnchor(roundTripSolderPaste[0])

  return sourceSolderPaste.reduce(
    (mismatchCount, sourceSolderPasteElement, solderPasteIndex) => {
      const roundTripSolderPasteElement = roundTripSolderPaste[solderPasteIndex]
      if (!roundTripSolderPasteElement) return mismatchCount + 1
      return (
        mismatchCount +
        (solderPasteElementsMatch({
          roundTripAnchor,
          roundTripSolderPasteElement,
          sourceAnchor,
          sourceSolderPasteElement,
        })
          ? 0
          : 1)
      )
    },
    0,
  )
}

function getSolderPasteElements(
  circuitJson: CircuitElement[],
): CircuitElement[] {
  return circuitJson.filter((element) => element.type === "pcb_solder_paste")
}

function solderPasteElementsMatch({
  roundTripAnchor,
  roundTripSolderPasteElement,
  sourceAnchor,
  sourceSolderPasteElement,
}: {
  roundTripAnchor: Point | undefined
  roundTripSolderPasteElement: CircuitElement
  sourceAnchor: Point | undefined
  sourceSolderPasteElement: CircuitElement
}): boolean {
  if (
    sourceSolderPasteElement.shape !== roundTripSolderPasteElement.shape ||
    sourceSolderPasteElement.layer !== roundTripSolderPasteElement.layer
  ) {
    return false
  }
  if (
    !optionalNumbersMatch({
      left: sourceSolderPasteElement.ccw_rotation,
      right: roundTripSolderPasteElement.ccw_rotation,
      tolerance: ROTATION_TOLERANCE_DEGREES,
    })
  ) {
    return false
  }
  for (const fieldName of ["height", "radius", "width"] as const) {
    if (
      !optionalNumbersMatch({
        left: sourceSolderPasteElement[fieldName],
        right: roundTripSolderPasteElement[fieldName],
        tolerance: POSITION_TOLERANCE_MM,
      })
    ) {
      return false
    }
  }
  return pointsMatch({
    roundTripAnchor,
    roundTripPoints: getSolderPastePoints(roundTripSolderPasteElement),
    sourceAnchor,
    sourcePoints: getSolderPastePoints(sourceSolderPasteElement),
  })
}

function getSolderPasteAnchor(
  solderPasteElement: CircuitElement | undefined,
): Point | undefined {
  return solderPasteElement
    ? getSolderPastePoints(solderPasteElement)[0]
    : undefined
}

function getSolderPastePoints(solderPasteElement: CircuitElement): Point[] {
  if (Array.isArray(solderPasteElement.points)) {
    return solderPasteElement.points.flatMap((point) => {
      const circuitPoint = getPoint(point)
      return circuitPoint ? [circuitPoint] : []
    })
  }
  const center = getPoint(solderPasteElement)
  return center ? [center] : []
}

function getPoint(input: unknown): Point | undefined {
  if (
    typeof input !== "object" ||
    input === null ||
    !("x" in input) ||
    !("y" in input) ||
    typeof input.x !== "number" ||
    typeof input.y !== "number"
  ) {
    return undefined
  }
  return { x: input.x, y: input.y }
}

function pointsMatch({
  roundTripAnchor,
  roundTripPoints,
  sourceAnchor,
  sourcePoints,
}: {
  roundTripAnchor: Point | undefined
  roundTripPoints: Point[]
  sourceAnchor: Point | undefined
  sourcePoints: Point[]
}): boolean {
  if (
    sourcePoints.length !== roundTripPoints.length ||
    !sourceAnchor ||
    !roundTripAnchor
  ) {
    return sourcePoints.length === 0 && roundTripPoints.length === 0
  }
  return sourcePoints.every((sourcePoint, pointIndex) => {
    const roundTripPoint = roundTripPoints[pointIndex]
    return (
      roundTripPoint !== undefined &&
      numbersMatch({
        left: sourcePoint.x - sourceAnchor.x,
        right: roundTripPoint.x - roundTripAnchor.x,
        tolerance: POSITION_TOLERANCE_MM,
      }) &&
      numbersMatch({
        left: sourcePoint.y - sourceAnchor.y,
        right: roundTripPoint.y - roundTripAnchor.y,
        tolerance: POSITION_TOLERANCE_MM,
      })
    )
  })
}

function optionalNumbersMatch({
  left,
  right,
  tolerance,
}: {
  left: unknown
  right: unknown
  tolerance: number
}): boolean {
  if (left === undefined || right === undefined) return left === right
  return (
    typeof left === "number" &&
    typeof right === "number" &&
    numbersMatch({ left, right, tolerance })
  )
}

function numbersMatch({
  left,
  right,
  tolerance,
}: {
  left: number
  right: number
  tolerance: number
}): boolean {
  return Math.abs(left - right) <= tolerance
}
