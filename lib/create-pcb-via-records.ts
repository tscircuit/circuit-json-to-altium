import { type PcbVia, pcb_via } from "circuit-json"
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

function getCopperLayerOrder(layer: string): number {
  if (layer === "TOP") return 0
  if (layer === "BOTTOM") return 32
  return Number(layer.slice("MID-LAYER".length))
}

function readVia(
  via: CircuitElement,
  defaults: {
    source_trace_id?: SourceTraceId
    pcb_trace_id?: PcbTraceId
    from_layer?: string
    to_layer?: string
  } = {},
): PcbVia {
  const layers =
    Array.isArray(via.layers) && via.layers.length > 0
      ? via.layers.map((layer) => asString(layer))
      : [
          asString(via.from_layer, defaults.from_layer ?? "top"),
          asString(via.to_layer, defaults.to_layer ?? "bottom"),
        ]
  return pcb_via.parse({
    type: "pcb_via",
    pcb_via_id: asString(via.pcb_via_id) || undefined,
    x: asNumber(via.x),
    y: asNumber(via.y),
    // Core route points can use via_diameter/via_hole_diameter.
    outer_diameter: asPositiveNumber(
      via.outer_diameter,
      asPositiveNumber(via.via_diameter, 0.6),
    ),
    hole_diameter: asPositiveNumber(
      via.hole_diameter,
      asPositiveNumber(via.via_hole_diameter, 0.3),
    ),
    layers: layers.map((layer) => layer.toLowerCase()),
    source_trace_id: asString(via.source_trace_id, defaults.source_trace_id),
    source_net_id: asString(via.source_net_id) || undefined,
    pcb_trace_id: defaults.pcb_trace_id ?? "",
  })
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
  const traces = byType(circuitJson, "pcb_trace")
  const traceById = new Map(
    traces.map((trace) => [
      asString(trace.pcb_trace_id),
      {
        pcb_trace_id: asString(trace.pcb_trace_id),
        source_trace_id: asString(trace.source_trace_id),
      },
    ]),
  )
  const vias = byType(circuitJson, "pcb_via").map((via) =>
    readVia(via, traceById.get(asString(via.pcb_trace_id))),
  )
  const inlineVias = new Set<PcbVia>()
  for (const trace of traces) {
    const route = Array.isArray(trace.route)
      ? trace.route.filter(
          (point): point is CircuitElement =>
            isCircuitElement(point) && asPoint(point) !== undefined,
        )
      : []
    for (const [index, point] of route.entries()) {
      if (point.route_type !== "via") continue
      const via = readVia(point, {
        pcb_trace_id: asString(trace.pcb_trace_id),
        source_trace_id: asString(trace.source_trace_id),
        from_layer: asString(route[index - 1]?.layer, "top"),
        to_layer: asString(route[index + 1]?.layer, "bottom"),
      })
      vias.push(via)
      inlineVias.add(via)
    }
  }

  const netByTraceId = new Map<SourceTraceId, PcbNetEntry>(
    netEntries.flatMap((net) => net.traceIds.map((id) => [id, net] as const)),
  )
  const netBySourceNetId = new Map<SourceNetId, PcbNetEntry>(
    netEntries.flatMap((net) =>
      net.sourceNetIds.map((id) => [id, net] as const),
    ),
  )
  const records: string[] = []
  const emitted = new Set<string>()
  for (const via of vias) {
    const net =
      netBySourceNetId.get(via.source_net_id ?? "") ??
      netByTraceId.get(via.source_trace_id ?? "")
    const center = circuitToAltiumPcbPoint({ x: via.x, y: via.y })
    const layers = via.layers
      .map(getAltiumPcbTrackLayer)
      .sort((a, b) => getCopperLayerOrder(a) - getCopperLayerOrder(b))
    const startLayer = layers[0]!
    const stopLayer = layers[layers.length - 1]!
    let connection = `trace:${via.pcb_trace_id}`
    if (via.source_trace_id) connection = `source:${via.source_trace_id}`
    if (net) connection = `net:${net.index}`
    const key = JSON.stringify([
      connection,
      center.x,
      center.y,
      startLayer,
      stopLayer,
    ])
    // Explicit records retain their dimensions when the route repeats a via.
    if (inlineVias.has(via) && emitted.has(key)) continue
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
  return records
}
