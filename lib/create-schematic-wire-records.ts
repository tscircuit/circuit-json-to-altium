import { ALTIUM_SCHEMATIC_HAIRLINE_WIDTH } from "./altium-schematic-line-width"
import { asPoint, isCircuitElement } from "./format"
import {
  normalizeSchematicWireSegments,
  type SchematicWireSegment,
} from "./normalize-schematic-wire-segments"
import type { CircuitElement, PointTransform } from "./types"

export function createSchematicWireRecords({
  circuitToAltiumSchematicPoint,
  schematicElements,
}: {
  circuitToAltiumSchematicPoint: PointTransform
  schematicElements: CircuitElement[]
}): string[][] {
  const segments: SchematicWireSegment[] = []
  for (const trace of schematicElements) {
    if (trace.type !== "schematic_trace" || !Array.isArray(trace.edges))
      continue
    for (const edge of trace.edges) {
      if (!isCircuitElement(edge)) continue
      const from = asPoint(edge.from)
      const to = asPoint(edge.to)
      if (!from || !to) continue
      segments.push({
        from: circuitToAltiumSchematicPoint(from),
        to: circuitToAltiumSchematicPoint(to),
      })
    }
  }
  return normalizeSchematicWireSegments(segments).map(({ from, to }) => [
    "RECORD=27",
    `LINEWIDTH=${ALTIUM_SCHEMATIC_HAIRLINE_WIDTH}`,
    "LOCATIONCOUNT=2",
    `X1=${from.x}`,
    `Y1=${from.y}`,
    `X2=${to.x}`,
    `Y2=${to.y}`,
    "COLOR=34816",
  ])
}
