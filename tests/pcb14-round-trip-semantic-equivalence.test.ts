import { expect, test } from "bun:test"
import type { CircuitElement } from "../lib/types"
import { getPcbSemanticMismatches } from "./fixtures/get-pcb-semantic-signatures"

test("accepts equivalent translated and fragmented PCB geometry", () => {
  const sourceCircuitJson: CircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "source-board",
      outline: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    },
    {
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: "source-silkscreen",
      layer: "top",
      stroke_width: 0.15,
      route: [
        { x: 1, y: 5 },
        { x: 5, y: 5 },
        { x: 9, y: 5 },
      ],
    },
  ]
  const roundTripCircuitJson: CircuitElement[] = [
    {
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: "round-trip-silkscreen-2",
      layer: "top",
      stroke_width: 0.15,
      route: [
        { x: 30, y: 30 },
        { x: 34, y: 30 },
      ],
    },
    {
      type: "pcb_board",
      pcb_board_id: "round-trip-board",
      outline: [
        { x: 25, y: 25 },
        { x: 35, y: 25 },
        { x: 35, y: 35 },
        { x: 25, y: 35 },
      ],
    },
    {
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: "round-trip-silkscreen-1",
      layer: "top",
      stroke_width: 0.15,
      route: [
        { x: 26, y: 30 },
        { x: 30, y: 30 },
      ],
    },
  ]

  expect(
    getPcbSemanticMismatches({
      roundTripCircuitJson,
      sourceCircuitJson,
    }),
  ).toEqual([])
})
