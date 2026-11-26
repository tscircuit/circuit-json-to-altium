import { ALTIUM_SCHEMATIC_HAIRLINE_WIDTH } from "./altium-schematic-line-width"
import { asPoint, asString, isCircuitElement } from "./format"
import {
  normalizeSchematicWireSegments,
  type SchematicWireSegment,
} from "./normalize-schematic-wire-segments"
import { splitSchematicWireAtAttachments } from "./split-schematic-wire-at-attachments"
import type { CircuitElement, PointTransform } from "./types"

export function createSchematicWireRecords({
  circuitToAltiumSchematicPoint,
  schematicElements,
  inlineNetLabelTexts = [],
}: {
  circuitToAltiumSchematicPoint: PointTransform
  schematicElements: CircuitElement[]
  inlineNetLabelTexts?: CircuitElement[]
}): string[][] {
  const segments: SchematicWireSegment[] = []
  const altiumAttachments = inlineNetLabelTexts.flatMap((text) => {
    const point = asPoint(text.position)
    return point ? [circuitToAltiumSchematicPoint(point)] : []
  })
  for (const trace of schematicElements) {
    if (trace.type !== "schematic_trace" || !Array.isArray(trace.edges))
      continue
    const attachments = inlineNetLabelTexts.flatMap((text) => {
      const point = asPoint(text.position)
      return point &&
        asString(text.source_trace_id) === asString(trace.source_trace_id)
        ? [point]
        : []
    })
    for (const edge of trace.edges) {
      if (!isCircuitElement(edge)) continue
      const from = asPoint(edge.from)
      const to = asPoint(edge.to)
      if (!from || !to) continue
      for (const segment of splitSchematicWireAtAttachments(
        { from, to },
        attachments,
      )) {
        segments.push({
          from: circuitToAltiumSchematicPoint(segment.from),
          to: circuitToAltiumSchematicPoint(segment.to),
        })
      }
    }
  }
  // Preserve label vertices after overlapping wire segments have been merged.
  return normalizeSchematicWireSegments(segments)
    .flatMap((segment) =>
      splitSchematicWireAtAttachments(segment, altiumAttachments),
    )
    .map(({ from, to }) => [
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
