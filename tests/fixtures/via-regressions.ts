import type { CircuitElement } from "../fixtures"

export const viaRegressionCases: {
  name: string
  elements: CircuitElement[]
  layers: string[]
}[] = [
  {
    name: "inner-layer via",
    elements: [
      {
        type: "pcb_via",
        pcb_via_id: "v1",
        x: 1,
        y: 2,
        outer_diameter: 0.7,
        hole_diameter: 0.35,
        layers: ["inner1", "inner2"],
        source_net_id: "gnd",
      },
    ],
    layers: ["MID-LAYER1", "MID-LAYER2"],
  },
  {
    name: "standalone via net",
    elements: [
      {
        type: "pcb_via",
        pcb_via_id: "v1",
        x: 1,
        y: 2,
        outer_diameter: 0.7,
        hole_diameter: 0.35,
        layers: ["top", "bottom"],
        source_net_id: "gnd",
      },
    ],
    layers: ["TOP", "BOTTOM"],
  },
  {
    name: "inline route via",
    elements: [
      {
        type: "source_trace",
        source_trace_id: "st1",
        connected_source_port_ids: [],
        connected_source_net_ids: ["gnd"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pt1",
        source_trace_id: "st1",
        route: [
          { route_type: "wire", x: 0, y: 2, width: 0.2, layer: "top" },
          {
            route_type: "via",
            x: 1,
            y: 2,
            from_layer: "top",
            to_layer: "inner1",
            outer_diameter: 0.7,
            hole_diameter: 0.35,
          },
          { route_type: "wire", x: 2, y: 2, width: 0.2, layer: "inner1" },
        ],
      },
    ],
    layers: ["TOP", "MID-LAYER1"],
  },
]
