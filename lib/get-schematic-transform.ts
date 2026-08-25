import type { Matrix } from "transformation-matrix"
import { applyToPoint, compose, scale, translate } from "transformation-matrix"
import { asNumber, asPoint, asString, isCircuitElement } from "./format"
import { isSchematicSheetAnnotation } from "./is-schematic-sheet-annotation"
import { isSchematicSymbolPrimitive } from "./is-schematic-symbol-primitive"
import type {
  CircuitElement,
  LengthTransform,
  Point,
  PointTransform,
} from "./types"

type SchematicTransform = {
  altiumSheetHeight: number
  altiumSheetWidth: number
  circuitToAltiumSchematicLength: LengthTransform
  circuitToAltiumSchematicPoint: PointTransform
  hasExplicitSheetBounds: boolean
}

type GetSchematicTransformParams = {
  schematicElements: CircuitElement[]
  schematicSheet: CircuitElement | undefined
}

type SchematicSheetBounds = {
  center: Point
  height: number
  width: number
}

const ALTIUM_UNITS_PER_CIRCUIT_UNIT = 20
const ALTIUM_SCHEMATIC_CONTENT_MARGIN = 100

function getSchematicSheetBounds(
  schematicSheet: CircuitElement | undefined,
): SchematicSheetBounds | undefined {
  const width = asNumber(schematicSheet?.width)
  const height = asNumber(schematicSheet?.height)
  if (width <= 0 || height <= 0) return undefined
  return {
    center: asPoint(schematicSheet?.center) ?? { x: 0, y: 0 },
    height,
    width,
  }
}

function getAltiumSchematicPoint(
  circuitPoint: Point,
  circuitToAltiumSchematicMatrix: Matrix,
): Point {
  const altiumPoint = applyToPoint(circuitToAltiumSchematicMatrix, circuitPoint)
  return { x: Math.round(altiumPoint.x), y: Math.round(altiumPoint.y) }
}

function appendSchematicSymbolPrimitivePoints({
  element,
  points,
}: {
  element: CircuitElement
  points: Point[]
}): void {
  if (element.type === "schematic_line") {
    points.push(
      { x: asNumber(element.x1), y: asNumber(element.y1) },
      { x: asNumber(element.x2), y: asNumber(element.y2) },
    )
    return
  }
  if (element.type === "schematic_path" && Array.isArray(element.points)) {
    for (const point of element.points) {
      const circuitPoint = asPoint(point)
      if (circuitPoint) points.push(circuitPoint)
    }
    return
  }
  const center = asPoint(element.center)
  if (!center) return
  if (element.type === "schematic_rect") {
    const width = asNumber(element.width)
    const height = asNumber(element.height)
    points.push(
      { x: center.x - width / 2, y: center.y - height / 2 },
      { x: center.x + width / 2, y: center.y + height / 2 },
    )
    return
  }
  if (element.type === "schematic_circle" || element.type === "schematic_arc") {
    const radius = asNumber(element.radius)
    points.push(
      { x: center.x - radius, y: center.y - radius },
      { x: center.x + radius, y: center.y + radius },
    )
    return
  }
}

export function getSchematicTransform({
  schematicElements,
  schematicSheet,
}: GetSchematicTransformParams): SchematicTransform {
  const circuitPoints: Point[] = []
  for (const element of schematicElements) {
    const center = asPoint(element.center)
    if (center) circuitPoints.push(center)
    if (
      isSchematicSymbolPrimitive(element) &&
      (asString(element.schematic_symbol_id) ||
        asString(element.schematic_component_id))
    ) {
      appendSchematicSymbolPrimitivePoints({
        element,
        points: circuitPoints,
      })
    }
    const anchor = asPoint(element.anchor_position)
    if (anchor) circuitPoints.push(anchor)
    const isSheetAnnotation = isSchematicSheetAnnotation(element)
    const position = isSheetAnnotation ? asPoint(element.position) : undefined
    if (position) circuitPoints.push(position)
    if (isSheetAnnotation && element.type === "schematic_rect") {
      const width = asNumber(element.width)
      const height = asNumber(element.height)
      if (center && width > 0 && height > 0) {
        circuitPoints.push(
          { x: center.x - width / 2, y: center.y - height / 2 },
          { x: center.x + width / 2, y: center.y + height / 2 },
        )
      }
    }
    if (
      isSheetAnnotation &&
      element.type === "schematic_path" &&
      Array.isArray(element.points)
    ) {
      for (const point of element.points) {
        const circuitPoint = asPoint(point)
        if (circuitPoint) circuitPoints.push(circuitPoint)
      }
    }
    if (element.type === "schematic_trace" && Array.isArray(element.edges)) {
      for (const edge of element.edges) {
        if (!isCircuitElement(edge)) continue
        const from = asPoint(edge.from)
        const to = asPoint(edge.to)
        if (from) circuitPoints.push(from)
        if (to) circuitPoints.push(to)
      }
    }
    if (
      element.type === "schematic_trace" &&
      Array.isArray(element.junctions)
    ) {
      for (const junction of element.junctions) {
        const circuitPoint = asPoint(junction)
        if (circuitPoint) circuitPoints.push(circuitPoint)
      }
    }
  }
  const schematicSheetBounds = getSchematicSheetBounds(schematicSheet)
  const minX = schematicSheetBounds
    ? schematicSheetBounds.center.x - schematicSheetBounds.width / 2
    : circuitPoints.length > 0
      ? Math.min(...circuitPoints.map((point) => point.x))
      : 0
  const minY = schematicSheetBounds
    ? schematicSheetBounds.center.y - schematicSheetBounds.height / 2
    : circuitPoints.length > 0
      ? Math.min(...circuitPoints.map((point) => point.y))
      : 0
  const altiumGridMinX =
    Math.round(minX * ALTIUM_UNITS_PER_CIRCUIT_UNIT) /
    ALTIUM_UNITS_PER_CIRCUIT_UNIT
  const altiumGridMinY =
    Math.round(minY * ALTIUM_UNITS_PER_CIRCUIT_UNIT) /
    ALTIUM_UNITS_PER_CIRCUIT_UNIT
  const circuitToAltiumSchematicMatrix = compose(
    translate(
      schematicSheetBounds ? 0 : ALTIUM_SCHEMATIC_CONTENT_MARGIN,
      schematicSheetBounds ? 0 : ALTIUM_SCHEMATIC_CONTENT_MARGIN,
    ),
    scale(ALTIUM_UNITS_PER_CIRCUIT_UNIT, ALTIUM_UNITS_PER_CIRCUIT_UNIT),
    translate(-altiumGridMinX, -altiumGridMinY),
  )
  const altiumPoints = circuitPoints.map((circuitPoint) =>
    getAltiumSchematicPoint(circuitPoint, circuitToAltiumSchematicMatrix),
  )
  const altiumOrigin = applyToPoint(circuitToAltiumSchematicMatrix, {
    x: 0,
    y: 0,
  })

  return {
    altiumSheetWidth: schematicSheetBounds
      ? Math.max(
          1,
          Math.round(
            schematicSheetBounds.width * ALTIUM_UNITS_PER_CIRCUIT_UNIT,
          ),
        )
      : Math.max(
          400,
          ...altiumPoints.map(
            (point) => point.x + ALTIUM_SCHEMATIC_CONTENT_MARGIN,
          ),
        ),
    altiumSheetHeight: schematicSheetBounds
      ? Math.max(
          1,
          Math.round(
            schematicSheetBounds.height * ALTIUM_UNITS_PER_CIRCUIT_UNIT,
          ),
        )
      : Math.max(
          300,
          ...altiumPoints.map(
            (point) => point.y + ALTIUM_SCHEMATIC_CONTENT_MARGIN,
          ),
        ),
    circuitToAltiumSchematicLength: (circuitLength) => {
      const altiumLengthPoint = applyToPoint(circuitToAltiumSchematicMatrix, {
        x: circuitLength,
        y: 0,
      })
      return Math.abs(altiumLengthPoint.x - altiumOrigin.x)
    },
    circuitToAltiumSchematicPoint: (circuitPoint) =>
      getAltiumSchematicPoint(circuitPoint, circuitToAltiumSchematicMatrix),
    hasExplicitSheetBounds: schematicSheetBounds !== undefined,
  }
}
