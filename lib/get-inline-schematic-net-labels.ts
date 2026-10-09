import { asPoint, asString, isCircuitElement, sanitizeField } from "./format"
import { isSchematicSheetAnnotation } from "./is-schematic-sheet-annotation"
import type { CircuitElement, Point, PointTransform } from "./types"

type InlineSchematicNetLabel = {
  altiumPosition: Point
  text: CircuitElement
}

export function getInlineSchematicNetLabels({
  circuitJson,
  schematicElements,
  circuitToAltiumSchematicPoint,
}: {
  circuitJson: CircuitElement[]
  schematicElements: CircuitElement[]
  circuitToAltiumSchematicPoint: PointTransform
}): InlineSchematicNetLabel[] {
  const netNames = new Map(
    circuitJson
      .filter((element) => element.type === "source_net")
      .map((net) => [asString(net.source_net_id), sanitizeField(net.name)]),
  )
  const namesByTraceId = new Map(
    circuitJson
      .filter((element) => element.type === "source_trace")
      .map((trace) => [
        asString(trace.source_trace_id),
        new Set(
          Array.isArray(trace.connected_source_net_ids)
            ? trace.connected_source_net_ids.map((id) =>
                netNames.get(asString(id)),
              )
            : [],
        ),
      ]),
  )
  const edgesByTraceId = new Map<string, { from: Point; to: Point }[]>()
  for (const trace of schematicElements) {
    if (trace.type !== "schematic_trace" || !Array.isArray(trace.edges)) {
      continue
    }
    const traceId = asString(trace.source_trace_id)
    if (!traceId) continue
    const edges = edgesByTraceId.get(traceId) ?? []
    for (const edge of trace.edges) {
      if (!isCircuitElement(edge)) continue
      const from = asPoint(edge.from)
      const to = asPoint(edge.to)
      if (!from || !to) continue
      edges.push({
        from: circuitToAltiumSchematicPoint(from),
        to: circuitToAltiumSchematicPoint(to),
      })
    }
    edgesByTraceId.set(traceId, edges)
  }

  return schematicElements.flatMap((text) => {
    if (text.type !== "schematic_text" || !isSchematicSheetAnnotation(text)) {
      return []
    }
    const traceId = asString(text.source_trace_id)
    const position = asPoint(text.position)
    const name = sanitizeField(text.text)
    if (
      !traceId ||
      !position ||
      !name ||
      !namesByTraceId.get(traceId)?.has(name)
    ) {
      return []
    }
    const altiumTextPosition = circuitToAltiumSchematicPoint(position)
    let altiumPosition: Point | undefined
    let closestDistance = Number.POSITIVE_INFINITY
    // Imported labels are offset from their electrical wire vertices.
    // Reuse a vertex on this trace so the native label is connected even
    // after integer coordinate rounding, including on diagonal wires.
    for (const { from, to } of edgesByTraceId.get(traceId) ?? []) {
      for (const candidate of [from, to]) {
        const distance =
          (candidate.x - altiumTextPosition.x) ** 2 +
          (candidate.y - altiumTextPosition.y) ** 2
        if (distance < closestDistance) {
          closestDistance = distance
          altiumPosition = candidate
        }
      }
    }
    return altiumPosition ? [{ altiumPosition, text }] : []
  })
}
