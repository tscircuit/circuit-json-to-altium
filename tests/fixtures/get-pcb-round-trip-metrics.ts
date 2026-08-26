import type { CircuitElement } from "../../lib/types"

const preservedPrimitiveTypes = [
  "source_net",
  "source_component",
  "pcb_component",
  "source_port",
  "pcb_port",
  "pcb_smtpad",
  "pcb_plated_hole",
  "pcb_hole",
  "source_trace",
  "pcb_trace",
  "pcb_via",
  "pcb_copper_pour",
  "pcb_silkscreen_circle",
  "pcb_silkscreen_path",
  "pcb_silkscreen_text",
  "pcb_courtyard_circle",
  "pcb_courtyard_outline",
  "pcb_keepout",
  "pcb_fabrication_note_path",
  "pcb_fabrication_note_text",
  "pcb_fabrication_note_dimension",
  "pcb_note_path",
  "pcb_note_text",
  "pcb_note_dimension",
] as const

const geometryElementTypes = [
  "pcb_component",
  "pcb_smtpad",
  "pcb_plated_hole",
  "pcb_hole",
  "pcb_trace",
  "pcb_via",
  "pcb_silkscreen_text",
] as const

const rotationElementTypes = [
  "pcb_component",
  "pcb_smtpad",
  "pcb_plated_hole",
  "pcb_hole",
  "pcb_silkscreen_text",
] as const

type PreservedPrimitiveType = (typeof preservedPrimitiveTypes)[number]
type GeometryElementType = (typeof geometryElementTypes)[number]
type RotationElementType = (typeof rotationElementTypes)[number]

export type PreservedPrimitiveCounts = Record<PreservedPrimitiveType, number>

export type PcbRoundTripMetrics = {
  arcGeometryMismatches: string[]
  geometryMaxDeltaMm: number
  rotationMismatchCount: number
  roundTripCounts: PreservedPrimitiveCounts
  roundTripSourceNetNames: string[]
  sourceCounts: PreservedPrimitiveCounts
  sourceNetNames: string[]
  sourcePrimitiveTotal: number
  silkscreenTextMismatchCount: number
}

function getArcGeometrySignatures(circuitJson: CircuitElement[]): string[] {
  const anchor = getCircuitGeometryAnchor(circuitJson)
  const signatures: string[] = []
  for (const element of circuitJson) {
    const pathPoints = getArcPathPoints(element)
    for (let pointIndex = 1; pointIndex < pathPoints.length; pointIndex++) {
      const start = pathPoints[pointIndex - 1]
      const end = pathPoints[pointIndex]
      if (!start || !end || Math.abs(start.bulge ?? 0) < 1e-12) continue
      const normalizedStart = {
        x: start.x - anchor.x,
        y: start.y - anchor.y,
      }
      const normalizedEnd = {
        x: end.x - anchor.x,
        y: end.y - anchor.y,
      }
      const reverseSegment = comparePoints(normalizedStart, normalizedEnd) > 0
      const firstPoint = reverseSegment ? normalizedEnd : normalizedStart
      const secondPoint = reverseSegment ? normalizedStart : normalizedEnd
      const normalizedBulge = reverseSegment
        ? -(start.bulge ?? 0)
        : (start.bulge ?? 0)
      const layer = element.type === "pcb_trace" ? start.layer : element.layer
      const widthMm =
        element.type === "pcb_trace" ? start.width : element.stroke_width
      signatures.push(
        [
          element.type,
          layer,
          formatMetricNumber(widthMm, 6),
          formatMetricNumber(firstPoint.x, 4),
          formatMetricNumber(firstPoint.y, 4),
          formatMetricNumber(secondPoint.x, 4),
          formatMetricNumber(secondPoint.y, 4),
          formatMetricNumber(normalizedBulge, 5),
        ].join("|"),
      )
    }

    if (!isArcCircleElement(element) || !isPoint(element.center)) continue
    signatures.push(
      [
        element.type,
        element.layer,
        formatMetricNumber(element.center.x - anchor.x, 4),
        formatMetricNumber(element.center.y - anchor.y, 4),
        formatMetricNumber(element.radius, 6),
      ].join("|"),
    )
  }
  return signatures.sort()
}

function getArcGeometryMismatches(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): string[] {
  const sourceSignatures = getArcGeometrySignatures(sourceCircuitJson)
  const roundTripSignatures = getArcGeometrySignatures(roundTripCircuitJson)
  return [
    ...getMissingSignatures(sourceSignatures, roundTripSignatures).map(
      (signature) => `missing after round trip: ${signature}`,
    ),
    ...getMissingSignatures(roundTripSignatures, sourceSignatures).map(
      (signature) => `added after round trip: ${signature}`,
    ),
  ]
}

function getMissingSignatures(
  expectedSignatures: string[],
  actualSignatures: string[],
): string[] {
  const remainingActualSignatures = [...actualSignatures]
  return expectedSignatures.filter((expectedSignature) => {
    const matchIndex = remainingActualSignatures.indexOf(expectedSignature)
    if (matchIndex < 0) return true
    remainingActualSignatures.splice(matchIndex, 1)
    return false
  })
}

function getArcPathPoints(element: CircuitElement): Array<{
  bulge?: number
  layer?: unknown
  width?: unknown
  x: number
  y: number
}> {
  const pathPoints =
    element.type === "pcb_courtyard_outline" ? element.outline : element.route
  if (
    element.type !== "pcb_trace" &&
    element.type !== "pcb_silkscreen_path" &&
    element.type !== "pcb_courtyard_outline" &&
    element.type !== "pcb_fabrication_note_path" &&
    element.type !== "pcb_note_path"
  ) {
    return []
  }
  if (!Array.isArray(pathPoints)) return []
  return pathPoints.flatMap((pathPoint) => {
    if (!isPoint(pathPoint)) return []
    const bulge =
      "bulge" in pathPoint && typeof pathPoint.bulge === "number"
        ? pathPoint.bulge
        : undefined
    return [
      {
        x: pathPoint.x,
        y: pathPoint.y,
        ...(bulge === undefined ? {} : { bulge }),
        ...(element.type === "pcb_trace" && "layer" in pathPoint
          ? { layer: pathPoint.layer }
          : {}),
        ...(element.type === "pcb_trace" && "width" in pathPoint
          ? { width: pathPoint.width }
          : {}),
      },
    ]
  })
}

function getCircuitGeometryAnchor(circuitJson: CircuitElement[]): {
  x: number
  y: number
} {
  for (const element of circuitJson) {
    if (element.type === "pcb_component" && isPoint(element.center)) {
      return element.center
    }
  }
  return { x: 0, y: 0 }
}

function isArcCircleElement(element: CircuitElement): boolean {
  return (
    element.type === "pcb_silkscreen_circle" ||
    element.type === "pcb_courtyard_circle" ||
    (element.type === "pcb_keepout" && element.shape === "circle")
  )
}

function isPoint(pointCandidate: unknown): pointCandidate is {
  x: number
  y: number
} {
  return (
    typeof pointCandidate === "object" &&
    pointCandidate !== null &&
    "x" in pointCandidate &&
    "y" in pointCandidate &&
    typeof pointCandidate.x === "number" &&
    typeof pointCandidate.y === "number"
  )
}

function comparePoints(
  firstPoint: { x: number; y: number },
  secondPoint: { x: number; y: number },
): number {
  return firstPoint.x - secondPoint.x || firstPoint.y - secondPoint.y
}

function formatMetricNumber(
  metricNumber: unknown,
  fractionDigits: number,
): string {
  return typeof metricNumber === "number"
    ? metricNumber.toFixed(fractionDigits)
    : ""
}

function getSourceNetNames(circuitJson: CircuitElement[]): string[] {
  return circuitJson.flatMap((element) => {
    if (element.type !== "source_net" || typeof element.name !== "string") {
      return []
    }
    return [element.name]
  })
}

function countPreservedPrimitives(
  circuitJson: CircuitElement[],
): PreservedPrimitiveCounts {
  const counts = Object.fromEntries(
    preservedPrimitiveTypes.map((type) => [
      type,
      circuitJson.filter((element) => element.type === type).length,
    ]),
  )
  return counts as PreservedPrimitiveCounts
}

function getGeometryPoints(
  circuitJson: CircuitElement[],
  elementType: GeometryElementType,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []
  for (const element of circuitJson) {
    if (element.type !== elementType) continue
    if (elementType === "pcb_trace" && Array.isArray(element.route)) {
      for (const routePoint of element.route) {
        if (
          typeof routePoint === "object" &&
          routePoint !== null &&
          "x" in routePoint &&
          "y" in routePoint &&
          typeof routePoint.x === "number" &&
          typeof routePoint.y === "number"
        ) {
          points.push({ x: routePoint.x, y: routePoint.y })
        }
      }
      continue
    }
    if (
      elementType === "pcb_component" &&
      typeof element.center === "object" &&
      element.center !== null &&
      "x" in element.center &&
      "y" in element.center &&
      typeof element.center.x === "number" &&
      typeof element.center.y === "number"
    ) {
      points.push({ x: element.center.x, y: element.center.y })
      continue
    }
    if (
      elementType === "pcb_silkscreen_text" &&
      typeof element.anchor_position === "object" &&
      element.anchor_position !== null &&
      "x" in element.anchor_position &&
      "y" in element.anchor_position &&
      typeof element.anchor_position.x === "number" &&
      typeof element.anchor_position.y === "number"
    ) {
      points.push({
        x: element.anchor_position.x,
        y: element.anchor_position.y,
      })
      continue
    }
    if (
      elementType !== "pcb_component" &&
      elementType !== "pcb_trace" &&
      elementType !== "pcb_silkscreen_text" &&
      typeof element.x === "number" &&
      typeof element.y === "number"
    ) {
      points.push({ x: element.x, y: element.y })
    }
  }
  return points
}

function getSilkscreenTextMismatchCount(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  const sourceTexts = sourceCircuitJson.filter(
    (element) => element.type === "pcb_silkscreen_text",
  )
  const roundTripTexts = roundTripCircuitJson.filter(
    (element) => element.type === "pcb_silkscreen_text",
  )
  if (sourceTexts.length !== roundTripTexts.length) {
    return Number.POSITIVE_INFINITY
  }

  return sourceTexts.reduce((mismatchCount, sourceText, index) => {
    const roundTripText = roundTripTexts[index]
    if (!roundTripText) return mismatchCount + 1
    const matches =
      sourceText.text === roundTripText.text &&
      sourceText.anchor_alignment === roundTripText.anchor_alignment &&
      sourceText.is_mirrored === roundTripText.is_mirrored &&
      sourceText.layer === roundTripText.layer
    return mismatchCount + (matches ? 0 : 1)
  }, 0)
}

function getGeometryMaxDeltaMm(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  let maxDeltaMm = 0
  for (const elementType of geometryElementTypes) {
    const sourcePoints = getGeometryPoints(sourceCircuitJson, elementType)
    const roundTripPoints = getGeometryPoints(roundTripCircuitJson, elementType)
    const sourceAnchor = sourcePoints[0]
    const roundTripAnchor = roundTripPoints[0]
    if (sourcePoints.length !== roundTripPoints.length) {
      return Number.POSITIVE_INFINITY
    }
    if (!sourceAnchor || !roundTripAnchor) continue

    for (const [index, sourcePoint] of sourcePoints.entries()) {
      const roundTripPoint = roundTripPoints[index]
      if (!roundTripPoint) return Number.POSITIVE_INFINITY
      maxDeltaMm = Math.max(
        maxDeltaMm,
        Math.abs(
          sourcePoint.x -
            sourceAnchor.x -
            (roundTripPoint.x - roundTripAnchor.x),
        ),
        Math.abs(
          sourcePoint.y -
            sourceAnchor.y -
            (roundTripPoint.y - roundTripAnchor.y),
        ),
      )
    }
  }
  return maxDeltaMm
}

function getCcwRotationsDegrees(
  circuitJson: CircuitElement[],
  elementType: RotationElementType,
): number[] {
  return circuitJson
    .filter((element) => element.type === elementType)
    .flatMap((element) => {
      const ccwRotationDegrees = element.rotation ?? element.ccw_rotation ?? 0
      return typeof ccwRotationDegrees === "number" ? [ccwRotationDegrees] : []
    })
}

function getRotationMismatchCount(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  let mismatchCount = 0
  for (const elementType of rotationElementTypes) {
    const sourceCcwRotationsDegrees = getCcwRotationsDegrees(
      sourceCircuitJson,
      elementType,
    )
    const roundTripCcwRotationsDegrees = getCcwRotationsDegrees(
      roundTripCircuitJson,
      elementType,
    )
    if (
      sourceCcwRotationsDegrees.length !== roundTripCcwRotationsDegrees.length
    ) {
      return Number.POSITIVE_INFINITY
    }
    mismatchCount += sourceCcwRotationsDegrees.reduce(
      (typeMismatchCount, ccwRotationDegrees, index) => {
        const roundTripCcwRotationDegrees =
          roundTripCcwRotationsDegrees[index] ?? 0
        return (
          typeMismatchCount +
          (getCircularRotationDeltaDegrees(
            ccwRotationDegrees,
            roundTripCcwRotationDegrees,
          ) <= 0.0001
            ? 0
            : 1)
        )
      },
      0,
    )
  }
  return mismatchCount
}

function getCircularRotationDeltaDegrees(
  firstCcwRotationDegrees: number,
  secondCcwRotationDegrees: number,
): number {
  const linearDeltaDegrees =
    Math.abs(firstCcwRotationDegrees - secondCcwRotationDegrees) % 360
  return Math.min(linearDeltaDegrees, 360 - linearDeltaDegrees)
}

export function getPcbRoundTripMetrics({
  roundTripCircuitJson,
  sourceCircuitJson,
}: {
  roundTripCircuitJson: CircuitElement[]
  sourceCircuitJson: CircuitElement[]
}): PcbRoundTripMetrics {
  const sourceCounts = countPreservedPrimitives(sourceCircuitJson)
  const roundTripCounts = countPreservedPrimitives(roundTripCircuitJson)

  return {
    arcGeometryMismatches: getArcGeometryMismatches(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    geometryMaxDeltaMm: getGeometryMaxDeltaMm(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    rotationMismatchCount: getRotationMismatchCount(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    roundTripCounts,
    roundTripSourceNetNames: getSourceNetNames(roundTripCircuitJson),
    sourceCounts,
    sourceNetNames: getSourceNetNames(sourceCircuitJson),
    sourcePrimitiveTotal: Object.values(sourceCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
    silkscreenTextMismatchCount: getSilkscreenTextMismatchCount(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
  }
}
