import { ALTIUM_SCHEMATIC_HAIRLINE_WIDTH } from "./altium-schematic-line-width"
import { asPoint, isCircuitElement } from "./format"
import type { CircuitElement, PointTransform } from "./types"

export function createSchematicWireRecords({
  circuitToAltiumSchematicPoint,
  schematicElements,
}: {
  circuitToAltiumSchematicPoint: PointTransform
  schematicElements: CircuitElement[]
}): string[][] {
  const records: string[][] = []
  const emittedSegments = new Set<string>()
  for (const trace of schematicElements) {
    if (trace.type !== "schematic_trace" || !Array.isArray(trace.edges))
      continue
    for (const edge of trace.edges) {
      if (!isCircuitElement(edge)) continue
      const from = asPoint(edge.from)
      const to = asPoint(edge.to)
      if (!from || !to) continue
      const start = circuitToAltiumSchematicPoint(from)
      const end = circuitToAltiumSchematicPoint(to)
      const startKey = `${start.x}:${start.y}`
      const endKey = `${end.x}:${end.y}`
      // Compare the emitted coordinates: rounding can collapse distinct input edges.
      if (startKey === endKey) continue
      const segmentKey = [startKey, endKey].sort().join("/")
      if (emittedSegments.has(segmentKey)) continue
      emittedSegments.add(segmentKey)
      records.push([
        "RECORD=27",
        `LINEWIDTH=${ALTIUM_SCHEMATIC_HAIRLINE_WIDTH}`,
        "LOCATIONCOUNT=2",
        `X1=${start.x}`,
        `Y1=${start.y}`,
        `X2=${end.x}`,
        `Y2=${end.y}`,
        "COLOR=34816",
      ])
    }
  }
  return records
}
