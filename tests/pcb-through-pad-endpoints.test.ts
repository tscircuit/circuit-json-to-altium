import { expect, test } from "bun:test"
import { board, extractArchive } from "./fixtures"

test("uses each pad entry/exit layer and position without drawing copper across the pad", async () => {
  const { pcb } = await extractArchive([
    board(),
    {
      type: "source_trace",
      source_trace_id: "signal",
      name: "SIGNAL",
      connected_source_port_ids: [],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      source_trace_id: "signal",
      route: [
        { route_type: "wire", x: -3, y: 0, layer: "top", width: 0.2 },
        {
          route_type: "through_pad",
          start: { x: -1, y: 0 },
          end: { x: 1, y: 0 },
          start_layer: "top",
          end_layer: "bottom",
          width: 0.3,
        },
        { route_type: "wire", x: 3, y: 0, layer: "bottom", width: 0.4 },
      ],
    },
  ])
  const tracks = pcb.getRecordsByKind("Track")
  expect(tracks.map((track) => track.get("LAYER"))).toEqual(["TOP", "BOTTOM"])
  expect(tracks.map((track) => pcb.getNetForRecord(track)?.name)).toEqual([
    "SIGNAL",
    "SIGNAL",
  ])
  for (const track of tracks)
    expect(
      track.getAltiumMeasurement("X2")!.toMillimeters() -
        track.getAltiumMeasurement("X1")!.toMillimeters(),
    ).toBeCloseTo(2, 4)
})
