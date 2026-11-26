import type { PcbVia } from "circuit-json"
import type { PcbNetEntry } from "./create-pcb-net-entries"
import { formatMil, MILLIMETERS_TO_MILS } from "./format"
import { getAltiumPcbTrackLayer } from "./get-altium-pcb-track-layer"
import type { Point, SourceNetId, SourceTraceId } from "./types"

function getCopperLayerOrder(layer: string): number {
  if (layer === "TOP") return 0
  if (layer === "BOTTOM") return 32
  return Number(layer.slice("MID-LAYER".length))
}

export function createPcbViaRecords({
  vias,
  inlineVias,
  netEntries,
  circuitToAltiumPcbPoint,
}: {
  vias: PcbVia[]
  inlineVias: Set<PcbVia>
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
