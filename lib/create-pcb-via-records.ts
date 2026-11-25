import type { PcbTrace, PcbVia } from "circuit-json"
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
import type {
  CircuitElement,
  PcbTraceId,
  Point,
  SourceNetId,
  SourceTraceId,
} from "./types"

type Via = Pick<
  PcbVia,
  | "x"
  | "y"
  | "outer_diameter"
  | "hole_diameter"
  | "source_trace_id"
  | "source_net_id"
> & {
  layers: string[]
  from_layer?: string
  to_layer?: string
  route_type?: "via"
}

type ViaTrace = Pick<PcbTrace, "pcb_trace_id" | "source_trace_id">

type ViaInput = {
  via: Via
  trace?: ViaTrace
  beforeLayer?: string
  afterLayer?: string
}

type ViaContext = {
  netByTraceId: Map<SourceTraceId, PcbNetEntry>
  netBySourceNetId: Map<SourceNetId, PcbNetEntry>
  circuitToAltiumPcbPoint: (point: Point) => Point
  records: string[]
  emitted: Set<string>
}

function getCopperLayerOrder(layer: string): number {
  if (layer === "TOP") return 0
  if (layer === "BOTTOM") return 32
  return Number(layer.slice("MID-LAYER".length))
}

// Normalize permissive legacy input before passing it to the typed via helpers.
function readVia(via: CircuitElement): Via {
  return {
    x: asNumber(via.x),
    y: asNumber(via.y),
    outer_diameter: asPositiveNumber(
      via.outer_diameter,
      asPositiveNumber(via.via_diameter, 0.6),
    ),
    hole_diameter: asPositiveNumber(
      via.hole_diameter,
      asPositiveNumber(via.via_hole_diameter, 0.3),
    ),
    layers: Array.isArray(via.layers)
      ? via.layers.map((layer) => asString(layer))
      : [],
    from_layer: typeof via.from_layer === "string" ? via.from_layer : undefined,
    to_layer: typeof via.to_layer === "string" ? via.to_layer : undefined,
    source_trace_id:
      typeof via.source_trace_id === "string" ? via.source_trace_id : undefined,
    source_net_id: asString(via.source_net_id),
    route_type: via.route_type === "via" ? "via" : undefined,
  }
}

function getViaLayers({
  via,
  beforeLayer,
  afterLayer,
}: ViaInput): [string, string] {
  const layers =
    via.layers.length > 0
      ? via.layers.map(getAltiumPcbTrackLayer)
      : [
          getAltiumPcbTrackLayer(via.from_layer ?? beforeLayer ?? "top"),
          getAltiumPcbTrackLayer(via.to_layer ?? afterLayer ?? "bottom"),
        ]
  layers.sort((a, b) => getCopperLayerOrder(a) - getCopperLayerOrder(b))
  return [layers[0]!, layers[layers.length - 1]!]
}

function addVia(
  { via, trace, beforeLayer, afterLayer }: ViaInput,
  {
    netByTraceId,
    netBySourceNetId,
    circuitToAltiumPcbPoint,
    records,
    emitted,
  }: ViaContext,
): void {
  const source_trace_id = via.source_trace_id ?? trace?.source_trace_id ?? ""
  const net =
    netBySourceNetId.get(via.source_net_id ?? "") ??
    netByTraceId.get(source_trace_id)
  const [startLayer, stopLayer] = getViaLayers({ via, beforeLayer, afterLayer })
  const center = circuitToAltiumPcbPoint({
    x: via.x,
    y: via.y,
  })
  // Match physical vias within their electrical connection and layer span.
  // Explicit records are emitted first and retain their authoritative sizes.
  const connection = net
    ? `net:${net.index}`
    : source_trace_id
      ? `source:${source_trace_id}`
      : `trace:${trace?.pcb_trace_id ?? ""}`
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
      `DIAMETER=${formatMil(via.outer_diameter * MILLIMETERS_TO_MILS)}`,
      `HOLESIZE=${formatMil(via.hole_diameter * MILLIMETERS_TO_MILS)}`,
      `STARTLAYER=${startLayer}`,
      `STOPLAYER=${stopLayer}`,
      "LOCKED=FALSE",
    ].join("|"),
  )
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
  const netByTraceId = new Map<SourceTraceId, PcbNetEntry>(
    netEntries.flatMap((net) => net.traceIds.map((id) => [id, net] as const)),
  )
  const netBySourceNetId = new Map<SourceNetId, PcbNetEntry>(
    netEntries.flatMap((net) =>
      net.sourceNetIds.map((id) => [id, net] as const),
    ),
  )
  const traces = byType(circuitJson, "pcb_trace").map((trace) => ({
    pcb_trace_id: asString(trace.pcb_trace_id),
    source_trace_id: asString(trace.source_trace_id),
    route: Array.isArray(trace.route)
      ? trace.route.filter(
          (point): point is CircuitElement =>
            isCircuitElement(point) && asPoint(point) !== undefined,
        )
      : [],
  }))
  const traceById = new Map<PcbTraceId, ViaTrace>(
    traces.map((trace) => [trace.pcb_trace_id, trace]),
  )
  const records: string[] = []
  const emitted = new Set<string>()
  const context: ViaContext = {
    netByTraceId,
    netBySourceNetId,
    circuitToAltiumPcbPoint,
    records,
    emitted,
  }

  for (const via of byType(circuitJson, "pcb_via")) {
    addVia(
      { via: readVia(via), trace: traceById.get(asString(via.pcb_trace_id)) },
      context,
    )
  }
  for (const trace of traces) {
    const { route } = trace
    for (const [index, point] of route.entries()) {
      if (point.route_type === "via")
        addVia(
          {
            via: readVia(point),
            trace,
            beforeLayer: asString(route[index - 1]?.layer, "top"),
            afterLayer: asString(route[index + 1]?.layer, "bottom"),
          },
          context,
        )
    }
  }
  return records
}
