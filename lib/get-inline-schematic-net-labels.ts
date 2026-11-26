import { asPoint, asString, sanitizeField } from "./format"
import { isSchematicSheetAnnotation } from "./is-schematic-sheet-annotation"
import type {
  CircuitElement,
  Point,
  PointTransform,
  SourceNetId,
  SourceTraceId,
} from "./types"

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
  const netNames = new Map<SourceNetId, string>(
    circuitJson
      .filter((element) => element.type === "source_net")
      .map((net) => [asString(net.source_net_id), sanitizeField(net.name)]),
  )
  const namesByTraceId = new Map<SourceTraceId, Set<string | undefined>>(
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
  const sheetTraceIds = new Set<SourceTraceId>(
    schematicElements
      .filter(
        (element) =>
          element.type === "schematic_trace" &&
          Array.isArray(element.edges) &&
          element.edges.length > 0,
      )
      .map((element) => asString(element.source_trace_id)),
  )

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
      !sheetTraceIds.has(traceId) ||
      !namesByTraceId.get(traceId)?.has(name)
    ) {
      return []
    }
    return [{ altiumPosition: circuitToAltiumSchematicPoint(position), text }]
  })
}
