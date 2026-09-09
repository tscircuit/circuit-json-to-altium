import { expect, test } from "bun:test"
import type { CircuitElement } from "../lib/types"
import { getPcbSemanticMismatches } from "./fixtures/get-pcb-semantic-signatures"

const sourceCircuitJson: CircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "board",
    outline: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
  },
  { type: "source_net", source_net_id: "net-a", name: "A" },
  { type: "source_net", source_net_id: "net-b", name: "B" },
  {
    type: "source_trace",
    source_trace_id: "trace",
    connected_source_net_ids: ["net-a"],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb-trace",
    source_trace_id: "trace",
    route: [
      { x: 1, y: 1, layer: "top", route_type: "wire", width: 0.2 },
      { x: 9, y: 1, layer: "top", route_type: "wire", width: 0.2 },
    ],
  },
  {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    source_net_id: "net-a",
    covered_with_solder_mask: true,
    layer: "top",
    shape: "polygon",
    points: [
      { x: 1, y: 2 },
      { x: 9, y: 2 },
      { x: 9, y: 8 },
      { x: 1, y: 8 },
    ],
  },
  {
    type: "pcb_silkscreen_path",
    pcb_silkscreen_path_id: "silkscreen-path",
    layer: "top",
    stroke_width: 0.15,
    route: [
      { x: 2, y: 9 },
      { x: 8, y: 9 },
    ],
  },
]

test("detects semantic changes in PCB round-trip data", () => {
  const changedCircuitJson = structuredClone(sourceCircuitJson)
  const changedBoard = changedCircuitJson.find(
    (element) => element.type === "pcb_board",
  )
  const changedTrace = changedCircuitJson.find(
    (element) => element.type === "source_trace",
  )
  const changedPour = changedCircuitJson.find(
    (element) => element.type === "pcb_copper_pour",
  )
  const changedSilkscreen = changedCircuitJson.find(
    (element) => element.type === "pcb_silkscreen_path",
  )
  if (!changedBoard || !changedTrace || !changedPour || !changedSilkscreen) {
    throw new Error("Expected complete PCB semantic validation fixture")
  }

  changedBoard.outline = [
    { x: 0, y: 0 },
    { x: 11, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  changedTrace.connected_source_net_ids = ["net-b"]
  changedPour.points = [
    { x: 1, y: 2 },
    { x: 8, y: 2 },
    { x: 9, y: 8 },
    { x: 1, y: 8 },
  ]
  changedSilkscreen.route = [
    { x: 2, y: 9 },
    { x: 7, y: 9 },
  ]

  const mismatchSummary = getPcbSemanticMismatches({
    roundTripCircuitJson: changedCircuitJson,
    sourceCircuitJson,
  }).join("\n")

  expect(mismatchSummary).toContain("boardOutlineSegments")
  expect(mismatchSummary).toContain("copperPourSegments")
  expect(mismatchSummary).toContain("copperTraceSegments")
  expect(mismatchSummary).toContain("silkscreenPathSegments")
  expect(mismatchSummary).toContain("sourceConnectivity")
})
