import {
  type AltiumRecord,
  type AltiumSchComponentRecord,
  type AltiumSchDoc,
  getSchematicRecordPoints,
} from "altiumts"
import type {
  CircuitElement,
  SchematicComponentId,
  SchematicSymbolId,
} from "../../lib/types"
import {
  getRecordCorner,
  getRecordLocation,
  getSchematicCoordinate,
  toCircuitLength,
  toCircuitPoint,
} from "./altium-schematic-coordinate-utils"
import { getCssColorFromAltiumRecord } from "./get-css-color-from-altium-record"
import { isAltiumSchematicComponentRecordVisible } from "./is-altium-schematic-component-record-visible"

type AppendAltiumSchematicSymbolPrimitivesInput = {
  component: AltiumSchComponentRecord
  document: AltiumSchDoc
  elements: CircuitElement[]
  schematicComponentId: SchematicComponentId
  schematicSymbolId: SchematicSymbolId
}

const COMPONENT_GRAPHIC_RECORD_KINDS = new Set([
  "6",
  "7",
  "8",
  "10",
  "11",
  "12",
  "13",
  "14",
])

function getGraphicStroke(record: AltiumRecord): {
  is_dashed: boolean
  stroke_width: number
} {
  return {
    is_dashed: (record.getNumber("LINESTYLE") ?? 0) !== 0,
    stroke_width: toCircuitLength(
      getSchematicCoordinate({ fallback: 1, key: "LINEWIDTH", record }),
    ),
  }
}

function getGraphicColor(record: AltiumRecord): string {
  return getCssColorFromAltiumRecord({
    fallbackCssColor: "#1f2937",
    fieldNames: ["COLOR"],
    record,
  })
}

function getGraphicFill(record: AltiumRecord): {
  fill_color?: string
  is_filled: boolean
} {
  const isFilled = record.getBoolean("ISSOLID") === true
  return {
    is_filled: isFilled,
    ...(isFilled
      ? {
          fill_color: getCssColorFromAltiumRecord({
            fallbackCssColor: "#ffffff",
            fieldNames: ["AREACOLOR"],
            record,
          }),
        }
      : {}),
  }
}

function createPathElement({
  graphicIndex,
  record,
  schematicComponentId,
  schematicSymbolId,
}: {
  graphicIndex: number
  record: AltiumRecord
  schematicComponentId: SchematicComponentId
  schematicSymbolId: SchematicSymbolId
}): CircuitElement | undefined {
  const points = getSchematicRecordPoints(record).map(toCircuitPoint)
  if (points.length < 2) return undefined
  const isFilled = record.recordKind === "7"
  return {
    type: "schematic_path",
    schematic_path_id: `schematic_path_component_${graphicIndex}`,
    schematic_component_id: schematicComponentId,
    schematic_symbol_id: schematicSymbolId,
    points,
    ...getGraphicStroke(record),
    stroke_color: getGraphicColor(record),
    is_filled: isFilled,
    ...(isFilled
      ? {
          fill_color: getCssColorFromAltiumRecord({
            fallbackCssColor: "#ffffff",
            fieldNames: ["AREACOLOR"],
            record,
          }),
        }
      : {}),
  }
}

function createCircleElement({
  graphicIndex,
  record,
  schematicComponentId,
  schematicSymbolId,
}: {
  graphicIndex: number
  record: AltiumRecord
  schematicComponentId: SchematicComponentId
  schematicSymbolId: SchematicSymbolId
}): CircuitElement | undefined {
  const radiusX = getSchematicCoordinate({ key: "RADIUS", record })
  const radiusY = getSchematicCoordinate({
    fallback: radiusX,
    key: "SECONDARYRADIUS",
    record,
  })
  if (radiusX !== radiusY) return undefined
  return {
    type: "schematic_circle",
    schematic_circle_id: `schematic_circle_component_${graphicIndex}`,
    schematic_component_id: schematicComponentId,
    schematic_symbol_id: schematicSymbolId,
    center: toCircuitPoint(getRecordLocation(record)),
    radius: toCircuitLength(radiusX),
    ...getGraphicStroke(record),
    color: getGraphicColor(record),
    ...getGraphicFill(record),
  }
}

function createArcElement({
  graphicIndex,
  record,
  schematicComponentId,
  schematicSymbolId,
}: {
  graphicIndex: number
  record: AltiumRecord
  schematicComponentId: SchematicComponentId
  schematicSymbolId: SchematicSymbolId
}): CircuitElement | undefined {
  const radius = getSchematicCoordinate({ key: "RADIUS", record })
  const secondaryRadius = getSchematicCoordinate({
    fallback: radius,
    key: "SECONDARYRADIUS",
    record,
  })
  if (radius !== secondaryRadius) return undefined
  return {
    type: "schematic_arc",
    schematic_arc_id: `schematic_arc_component_${graphicIndex}`,
    schematic_component_id: schematicComponentId,
    schematic_symbol_id: schematicSymbolId,
    center: toCircuitPoint(getRecordLocation(record)),
    radius: toCircuitLength(radius),
    start_angle_degrees: record.getNumber("STARTANGLE") ?? 0,
    end_angle_degrees: record.getNumber("ENDANGLE") ?? 360,
    direction: "counterclockwise",
    ...getGraphicStroke(record),
    color: getGraphicColor(record),
  }
}

function createLineElement({
  graphicIndex,
  record,
  schematicComponentId,
  schematicSymbolId,
}: {
  graphicIndex: number
  record: AltiumRecord
  schematicComponentId: SchematicComponentId
  schematicSymbolId: SchematicSymbolId
}): CircuitElement {
  const start = toCircuitPoint(getRecordLocation(record))
  const end = toCircuitPoint(getRecordCorner(record))
  return {
    type: "schematic_line",
    schematic_line_id: `schematic_line_component_${graphicIndex}`,
    schematic_component_id: schematicComponentId,
    schematic_symbol_id: schematicSymbolId,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    ...getGraphicStroke(record),
    color: getGraphicColor(record),
  }
}

function createRectElement({
  graphicIndex,
  record,
  schematicComponentId,
  schematicSymbolId,
}: {
  graphicIndex: number
  record: AltiumRecord
  schematicComponentId: SchematicComponentId
  schematicSymbolId: SchematicSymbolId
}): CircuitElement {
  const location = getRecordLocation(record)
  const corner = getRecordCorner(record)
  return {
    type: "schematic_rect",
    schematic_rect_id: `schematic_rect_component_${graphicIndex}`,
    schematic_component_id: schematicComponentId,
    schematic_symbol_id: schematicSymbolId,
    center: toCircuitPoint({
      x: (location.x + corner.x) / 2,
      y: (location.y + corner.y) / 2,
    }),
    width: toCircuitLength(Math.abs(corner.x - location.x)),
    height: toCircuitLength(Math.abs(corner.y - location.y)),
    rotation: 0,
    ...getGraphicStroke(record),
    color: getGraphicColor(record),
    ...getGraphicFill(record),
  }
}

function createSymbolPrimitiveElement({
  graphicIndex,
  record,
  schematicComponentId,
  schematicSymbolId,
}: {
  graphicIndex: number
  record: AltiumRecord
  schematicComponentId: SchematicComponentId
  schematicSymbolId: SchematicSymbolId
}): CircuitElement | undefined {
  if (record.recordKind === "6" || record.recordKind === "7") {
    return createPathElement({
      graphicIndex,
      record,
      schematicComponentId,
      schematicSymbolId,
    })
  }
  if (record.recordKind === "8") {
    return createCircleElement({
      graphicIndex,
      record,
      schematicComponentId,
      schematicSymbolId,
    })
  }
  if (record.recordKind === "11" || record.recordKind === "12") {
    return createArcElement({
      graphicIndex,
      record,
      schematicComponentId,
      schematicSymbolId,
    })
  }
  if (record.recordKind === "13") {
    return createLineElement({
      graphicIndex,
      record,
      schematicComponentId,
      schematicSymbolId,
    })
  }
  if (record.recordKind === "10" || record.recordKind === "14") {
    return createRectElement({
      graphicIndex,
      record,
      schematicComponentId,
      schematicSymbolId,
    })
  }
  return undefined
}

export function appendAltiumSchematicSymbolPrimitives({
  component,
  document,
  elements,
  schematicComponentId,
  schematicSymbolId,
}: AppendAltiumSchematicSymbolPrimitivesInput): void {
  for (const [graphicIndex, record] of document.records.entries()) {
    if (
      document.getParent(record) !== component ||
      !COMPONENT_GRAPHIC_RECORD_KINDS.has(record.recordKind ?? "") ||
      !isAltiumSchematicComponentRecordVisible({ component, record })
    ) {
      continue
    }
    const graphicElement = createSymbolPrimitiveElement({
      graphicIndex,
      record,
      schematicComponentId,
      schematicSymbolId,
    })
    if (graphicElement) elements.push(graphicElement)
  }
}
