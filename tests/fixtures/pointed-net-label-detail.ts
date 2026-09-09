import { board, type CircuitElement } from "../fixtures"

export const pointedNetLabelDetail: CircuitElement[] = [
  board(),
  ...["VIN_DC_DC", "EN_3P3"].flatMap((text, index) => {
    const anchor = { x: 0, y: -index * 0.8 }
    return [
      { type: "source_net", source_net_id: `net_${index}`, name: text },
      {
        type: "schematic_net_label",
        schematic_net_label_id: `label_${index}`,
        source_net_id: `net_${index}`,
        text,
        anchor_position: anchor,
        center: { x: -text.length * 0.06, y: anchor.y },
        anchor_side: "right",
      },
      {
        type: "schematic_trace",
        schematic_trace_id: `trace_${index}`,
        edges: [{ from: anchor, to: { x: 2, y: anchor.y } }],
        junctions: [],
      },
    ]
  }),
]
