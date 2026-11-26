import { type PcbVia, pcb_via } from "circuit-json"
import {
  asNumber,
  asPoint,
  asPositiveNumber,
  asString,
  byType,
  isCircuitElement,
} from "./format"
import type { CircuitElement } from "./types"

export function collectPcbVias(circuitJson: CircuitElement[]): {
  vias: PcbVia[]
  inlineVias: Set<PcbVia>
} {
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
  const vias: PcbVia[] = byType(circuitJson, "pcb_via").map((element) => {
    const trace = traceById.get(asString(element.pcb_trace_id))
    return pcb_via.parse({
      type: "pcb_via",
      pcb_via_id: asString(element.pcb_via_id) || undefined,
      x: asNumber(element.x),
      y: asNumber(element.y),
      outer_diameter: asPositiveNumber(
        element.outer_diameter,
        asPositiveNumber(element.via_diameter, 0.6),
      ),
      hole_diameter: asPositiveNumber(
        element.hole_diameter,
        asPositiveNumber(element.via_hole_diameter, 0.3),
      ),
      layers: (Array.isArray(element.layers) && element.layers.length > 0
        ? element.layers
        : [
            asString(element.from_layer, "top"),
            asString(element.to_layer, "bottom"),
          ]
      ).map((layer) => asString(layer).toLowerCase()),
      source_trace_id: asString(
        element.source_trace_id,
        trace?.source_trace_id,
      ),
      source_net_id: asString(element.source_net_id) || undefined,
      pcb_trace_id: trace?.pcb_trace_id ?? "",
    })
  })
  const inlineVias = new Set<PcbVia>()
  for (const trace of traces) {
    const route = Array.isArray(trace.route)
      ? trace.route.filter(
          (point): point is CircuitElement =>
            isCircuitElement(point) && asPoint(point) !== undefined,
        )
      : []
    for (const [index, element] of route.entries()) {
      if (element.route_type !== "via") continue
      // Legacy route vias can omit endpoints and inherit adjacent wire layers.
      const layerReferences: string[] = (
        Array.isArray(element.layers) && element.layers.length > 0
          ? element.layers
          : [
              asString(
                element.from_layer,
                asString(route[index - 1]?.layer, "top"),
              ),
              asString(
                element.to_layer,
                asString(route[index + 1]?.layer, "bottom"),
              ),
            ]
      ).map((layer) => asString(layer).toLowerCase())
      const via: PcbVia = pcb_via.parse({
        type: "pcb_via",
        pcb_via_id: asString(element.pcb_via_id) || undefined,
        x: element.x,
        y: element.y,
        layers: layerReferences,
        from_layer: layerReferences[0],
        to_layer: layerReferences[layerReferences.length - 1],
        // Core route points can use via_diameter/via_hole_diameter.
        outer_diameter: asPositiveNumber(
          element.outer_diameter,
          asPositiveNumber(element.via_diameter, 0.6),
        ),
        hole_diameter: asPositiveNumber(
          element.hole_diameter,
          asPositiveNumber(element.via_hole_diameter, 0.3),
        ),
        source_trace_id: asString(
          element.source_trace_id,
          asString(trace.source_trace_id),
        ),
        source_net_id: asString(element.source_net_id) || undefined,
        pcb_trace_id: asString(trace.pcb_trace_id),
      })
      vias.push(via)
      inlineVias.add(via)
    }
  }
  return { vias, inlineVias }
}
