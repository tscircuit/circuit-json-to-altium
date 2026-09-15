import type { CircuitElement } from "../fixtures"

export const pinNumberPositionCircuit: CircuitElement[] = [
  { type: "source_component", source_component_id: "chip", name: "U1" },
  {
    type: "schematic_component",
    schematic_component_id: "schematic_chip",
    source_component_id: "chip",
    center: { x: 0, y: 0 },
    size: { width: 4, height: 4 },
  },
  ...[
    { direction: "right", side: "right", x: 2.5, y: 0, number: 5 },
    { direction: "up", side: "top", x: 0, y: 2.5, number: 6 },
    { direction: "left", side: "left", x: -2.5, y: 0, number: 17 },
    { direction: "down", side: "bottom", x: 0, y: -2.5, number: 18 },
  ].flatMap(({ direction, side, x, y, number }) => [
    {
      type: "source_port",
      source_port_id: `pin_${number}`,
      source_component_id: "chip",
      pin_number: number,
      name: `pin${number}`,
    },
    {
      type: "schematic_port",
      schematic_port_id: `schematic_pin_${number}`,
      schematic_component_id: "schematic_chip",
      source_port_id: `pin_${number}`,
      center: { x, y },
      distance_from_component_edge: 0.5,
      facing_direction: direction,
      side_of_component: side,
      pin_number: number,
      display_pin_label: direction.toUpperCase(),
    },
  ]),
]
