// Allows for Altium measurement quantization and re-sampled arc points.
const MAXIMUM_COORDINATE_DELTA_MM = 0.002
const SIGNATURE_PRECISION_DECIMAL_PLACES = 3
const POINT_PATTERN = /(-?\d+\.\d+),(-?\d+\.\d+)/gu

export type PcbSemanticPoint = {
  bulge?: number
  x: number
  y: number
}

export type PcbSemanticOrigin = {
  x: number
  y: number
}

type ParsedSemanticSignature = {
  coordinates: number[]
  discreteSignature: string
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function asPoint(value: unknown): PcbSemanticPoint | undefined {
  if (typeof value !== "object" || value === null) return undefined
  if (!("x" in value) || !("y" in value)) return undefined
  const x = asNumber(value.x)
  const y = asNumber(value.y)
  if (x === undefined || y === undefined) return undefined
  const bulge = "bulge" in value ? asNumber(value.bulge) : undefined
  return bulge === undefined ? { x, y } : { bulge, x, y }
}

export function asPoints(value: unknown): PcbSemanticPoint[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const point = asPoint(entry)
    return point ? [point] : []
  })
}

export function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const stringValue = asString(entry)
    return stringValue === undefined ? [] : [stringValue]
  })
}

export function formatNumber(value: number | undefined): string {
  if (value === undefined) return ""
  const multiplier = 10 ** SIGNATURE_PRECISION_DECIMAL_PLACES
  const rounded = Math.round(value * multiplier) / multiplier
  return rounded.toFixed(SIGNATURE_PRECISION_DECIMAL_PLACES)
}

export function formatPoint(
  point: PcbSemanticPoint,
  origin: PcbSemanticOrigin,
): string {
  return `${formatNumber(point.x - origin.x)},${formatNumber(point.y - origin.y)}`
}

export function formatLayer(value: unknown): string {
  const directLayer = asString(value)
  if (directLayer !== undefined) return directLayer
  if (typeof value !== "object" || value === null || !("name" in value)) {
    return ""
  }
  return asString(value.name) ?? ""
}

function getCanonicalSegmentSignature({
  end,
  origin,
  start,
}: {
  end: PcbSemanticPoint
  origin: PcbSemanticOrigin
  start: PcbSemanticPoint
}): string {
  const startPoint = formatPoint(start, origin)
  const endPoint = formatPoint(end, origin)
  const bulge = start.bulge ?? 0
  const forward = `${startPoint}>${endPoint}@${formatNumber(bulge)}`
  const reverse = `${endPoint}>${startPoint}@${formatNumber(-bulge)}`
  return forward < reverse ? forward : reverse
}

export function getPathSegmentSignatures({
  origin,
  points,
  style,
}: {
  origin: PcbSemanticOrigin
  points: PcbSemanticPoint[]
  style: string
}): string[] {
  return points.slice(0, -1).flatMap((start, index) => {
    const end = points[index + 1]
    if (!end || formatPoint(start, origin) === formatPoint(end, origin)) {
      return []
    }
    return [`${style}|${getCanonicalSegmentSignature({ end, origin, start })}`]
  })
}

export function getClosedPathSegmentSignatures({
  origin,
  points,
  style,
}: {
  origin: PcbSemanticOrigin
  points: PcbSemanticPoint[]
  style: string
}): string[] {
  const firstPoint = points[0]
  const lastPoint = points.at(-1)
  if (!firstPoint || !lastPoint) return []
  const closedPoints =
    formatPoint(firstPoint, origin) === formatPoint(lastPoint, origin)
      ? points
      : [...points, firstPoint]
  return getPathSegmentSignatures({ origin, points: closedPoints, style })
}

function parseSemanticSignature(signature: string): ParsedSemanticSignature {
  const coordinates: number[] = []
  const discreteSignature = signature.replace(
    POINT_PATTERN,
    (_match, x: string, y: string) => {
      coordinates.push(Number(x), Number(y))
      return "<point>"
    },
  )
  return { coordinates, discreteSignature }
}

function compareCoordinates(first: number[], second: number[]): number {
  for (let index = 0; index < first.length; index++) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0)
    if (difference !== 0) return difference
  }
  return first.length - second.length
}

function groupParsedSignatures(
  signatures: string[],
): Map<string, ParsedSemanticSignature[]> {
  const signaturesByDiscreteValue = new Map<string, ParsedSemanticSignature[]>()
  for (const signature of signatures) {
    const parsedSignature = parseSemanticSignature(signature)
    const group =
      signaturesByDiscreteValue.get(parsedSignature.discreteSignature) ?? []
    group.push(parsedSignature)
    signaturesByDiscreteValue.set(parsedSignature.discreteSignature, group)
  }
  for (const group of signaturesByDiscreteValue.values()) {
    group.sort((first, second) =>
      compareCoordinates(first.coordinates, second.coordinates),
    )
  }
  return signaturesByDiscreteValue
}

export function getSemanticSignatureMismatches({
  category,
  roundTripSignatures,
  sourceSignatures,
}: {
  category: string
  roundTripSignatures: string[]
  sourceSignatures: string[]
}): string[] {
  const sourceGroups = groupParsedSignatures(sourceSignatures)
  const roundTripGroups = groupParsedSignatures(roundTripSignatures)
  const discreteSignatures = new Set([
    ...sourceGroups.keys(),
    ...roundTripGroups.keys(),
  ])
  const mismatches: string[] = []

  for (const discreteSignature of [...discreteSignatures].sort()) {
    const sourceGroup = sourceGroups.get(discreteSignature) ?? []
    const roundTripGroup = roundTripGroups.get(discreteSignature) ?? []
    if (sourceGroup.length !== roundTripGroup.length) {
      mismatches.push(
        `${category} count changed from ${sourceGroup.length} to ${roundTripGroup.length}: ${discreteSignature}`,
      )
      continue
    }
    for (const [index, sourceSignature] of sourceGroup.entries()) {
      const roundTripSignature = roundTripGroup[index]
      if (!roundTripSignature) continue
      const coordinateDeltaMm = Math.max(
        0,
        ...sourceSignature.coordinates.map((coordinate, coordinateIndex) =>
          Math.abs(
            coordinate -
              (roundTripSignature.coordinates[coordinateIndex] ?? coordinate),
          ),
        ),
      )
      if (coordinateDeltaMm > MAXIMUM_COORDINATE_DELTA_MM) {
        mismatches.push(
          `${category} geometry changed by ${coordinateDeltaMm.toFixed(3)} mm: ${discreteSignature}`,
        )
        break
      }
    }
  }

  return mismatches
}
