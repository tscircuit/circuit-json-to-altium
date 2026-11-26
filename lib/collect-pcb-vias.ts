import {
  type LayerRef,
  layer_ref,
  type PcbVia,
  pcb_trace_route_point_via,
  pcb_via,
} from "circuit-json"
import {
  asNumber,
  asPoint,
  asPositiveNumber,
  asString,
  byType,
  isCircuitElement,
} from "./format"
import type { CircuitElement } from "./types"

function parseViaLayers(
  layers: unknown,
  fromLayer: string,
  toLayer: string,
): LayerRef[] {
  const references =
    Array.isArray(layers) && layers.length > 0 ? layers : [fromLayer, toLayer]
  return references.map((layer) =>
    layer_ref.parse(asString(layer).toLowerCase()),
  )
}

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
  const vias = byType(circuitJson, "pcb_via").map((element) => {
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
      layers: parseViaLayers(
        element.layers,
        asString(element.from_layer, "top"),
        asString(element.to_layer, "bottom"),
      ),
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
      const layers = parseViaLayers(
        element.layers,
        asString(element.from_layer, asString(route[index - 1]?.layer, "top")),
        asString(element.to_layer, asString(route[index + 1]?.layer, "bottom")),
      )
      const point = pcb_trace_route_point_via.parse({
        route_type: "via",
        x: element.x,
        y: element.y,
        from_layer: layers[0],
        to_layer: layers[layers.length - 1],
        // Core route points can use via_diameter/via_hole_diameter.
        outer_diameter: asPositiveNumber(
          element.outer_diameter,
          asPositiveNumber(element.via_diameter, 0.6),
        ),
        hole_diameter: asPositiveNumber(
          element.hole_diameter,
          asPositiveNumber(element.via_hole_diameter, 0.3),
        ),
      })
      const via = pcb_via.parse({
        ...point,
        type: "pcb_via",
        pcb_via_id: asString(element.pcb_via_id) || undefined,
        layers,
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
