import type { PcbNetEntry } from "./create-pcb-net-entries"
import {
  asNumber,
  asPoint,
  asPositiveNumber,
  asString,
  byType,
  formatMil,
  isCircuitElement,
  MILLIMETERS_TO_MILS,
} from "./format"
import { getAltiumPcbTrackLayer } from "./get-altium-pcb-track-layer"
import type { CircuitElement, Point } from "./types"

function getViaLayers(
  via: CircuitElement,
  before?: CircuitElement,
  after?: CircuitElement,
): [string, string] {
  const layers =
    Array.isArray(via.layers) && via.layers.length > 0
      ? via.layers.map((layer) => getAltiumPcbTrackLayer(asString(layer)))
      : [
          getAltiumPcbTrackLayer(
            asString(via.from_layer, asString(before?.layer, "top")),
          ),
          getAltiumPcbTrackLayer(
            asString(via.to_layer, asString(after?.layer, "bottom")),
          ),
        ]
  const order = (layer: string) =>
    layer === "TOP"
      ? 0
      : layer === "BOTTOM"
        ? 32
        : Number(layer.slice("MID-LAYER".length))
  layers.sort((a, b) => order(a) - order(b))
  return [layers[0]!, layers[layers.length - 1]!]
}

export function createPcbViaRecords({
  circuitJson,
  netEntries,
  circuitToAltiumPcbPoint,
}: {
  circuitJson: CircuitElement[]
  netEntries: PcbNetEntry[]
  circuitToAltiumPcbPoint: (point: Point) => Point
}): string[] {
  const netByTraceId = new Map(
    netEntries.flatMap((net) => net.traceIds.map((id) => [id, net] as const)),
  )
  const netBySourceNetId = new Map(
    netEntries.flatMap((net) =>
      net.sourceNetIds.map((id) => [id, net] as const),
    ),
  )
  const traces = byType(circuitJson, "pcb_trace")
  const traceById = new Map(
    traces.map((trace) => [asString(trace.pcb_trace_id), trace]),
  )
  const records: string[] = []
  const emitted = new Set<string>()
  const addVia = (
    via: CircuitElement,
    trace?: CircuitElement,
    before?: CircuitElement,
    after?: CircuitElement,
  ) => {
    const sourceTraceId = asString(
      via.source_trace_id,
      asString(trace?.source_trace_id),
    )
    const net =
      netBySourceNetId.get(asString(via.source_net_id)) ??
      netByTraceId.get(sourceTraceId)
    const [startLayer, stopLayer] = getViaLayers(via, before, after)
    const center = circuitToAltiumPcbPoint({
      x: asNumber(via.x),
      y: asNumber(via.y),
    })
    // Match physical vias within their electrical connection and layer span.
    // Explicit records are emitted first and retain their authoritative sizes.
    const connection = net
      ? `net:${net.index}`
      : sourceTraceId
        ? `source:${sourceTraceId}`
        : `trace:${asString(trace?.pcb_trace_id)}`
    const key = JSON.stringify([
      connection,
      center.x,
      center.y,
      startLayer,
      stopLayer,
    ])
    if (via.route_type === "via" && emitted.has(key)) return
    emitted.add(key)
    records.push(
      [
        "|RECORD=Via",
        ...(net ? [`NET=${net.index}`] : []),
        `X=${formatMil(center.x)}`,
        `Y=${formatMil(center.y)}`,
        `DIAMETER=${formatMil(asPositiveNumber(via.outer_diameter, 0.6) * MILLIMETERS_TO_MILS)}`,
        `HOLESIZE=${formatMil(asPositiveNumber(via.hole_diameter, 0.3) * MILLIMETERS_TO_MILS)}`,
        `STARTLAYER=${startLayer}`,
        `STOPLAYER=${stopLayer}`,
        "LOCKED=FALSE",
      ].join("|"),
    )
  }
  for (const via of byType(circuitJson, "pcb_via")) {
    addVia(via, traceById.get(asString(via.pcb_trace_id)))
  }
  for (const trace of traces) {
    const route = Array.isArray(trace.route)
      ? trace.route.filter(
          (point): point is CircuitElement =>
            isCircuitElement(point) && asPoint(point) !== undefined,
        )
      : []
    for (const [index, point] of route.entries()) {
      if (point.route_type === "via")
        addVia(point, trace, route[index - 1], route[index + 1])
    }
  }
  return records
}
