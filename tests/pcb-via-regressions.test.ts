import { expect, test } from "bun:test"
import { board, extractArchive } from "./fixtures"
import { viaRegressionCases } from "./fixtures/via-regressions"

for (const fixture of viaRegressionCases) {
  const elements = [
    board({ num_layers: 4 }),
    { type: "source_net", source_net_id: "gnd", name: "GND" },
    ...fixture.elements,
  ]
  test(`${fixture.name}: preserves native via`, async () => {
    const { pcb } = await extractArchive(elements)
    const vias = pcb.getRecordsByKind("Via")
    expect(vias).toHaveLength(1)
    const via = vias[0]!
    expect([via.get("STARTLAYER"), via.get("ENDLAYER")]).toEqual(fixture.layers)
    expect(pcb.getNetForRecord(via)?.name).toBe("GND")
  })
}

test("normalizes layer spans, supports legacy endpoints, and declares via-only nets", async () => {
  const { pcb } = await extractArchive([
    board({ num_layers: 4 }),
    {
      type: "pcb_via",
      x: 0,
      y: 0,
      layers: ["inner2", "top", "inner1"],
      source_net_id: "undeclared",
    },
    { type: "pcb_via", x: 1, y: 0, from_layer: "bottom", to_layer: "inner2" },
    { type: "pcb_via", x: 2, y: 0 },
  ])
  const vias = pcb.getRecordsByKind("Via")
  expect(
    vias.map((via) => [via.get("STARTLAYER"), via.get("ENDLAYER")]),
  ).toEqual([
    ["TOP", "MID-LAYER2"],
    ["MID-LAYER2", "BOTTOM"],
    ["TOP", "BOTTOM"],
  ])
  expect(pcb.getNetForRecord(vias[0]!)?.name).toBe("undeclared")
  expect(pcb.getNetForRecord(vias[1]!)).toBeUndefined()
})

test("deduplicates inline vias by connection and span while retaining explicit dimensions", async () => {
  const { pcb } = await extractArchive([
    board({ num_layers: 4 }),
    {
      type: "source_trace",
      source_trace_id: "a",
      name: "A",
      connected_source_port_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "b",
      name: "B",
      connected_source_port_ids: [],
    },
    {
      type: "pcb_via",
      x: 1,
      y: 2,
      source_trace_id: "a",
      layers: ["inner1", "top"],
      outer_diameter: 0.9,
      hole_diameter: 0.4,
    },
    ...["a", "b"].map((id) => ({
      type: "pcb_trace",
      pcb_trace_id: id,
      source_trace_id: id,
      route: [
        {
          route_type: "via",
          x: 1,
          y: 2,
          from_layer: "top",
          to_layer: "inner1",
          outer_diameter: 0.7,
          hole_diameter: 0.35,
        },
        {
          route_type: "via",
          x: 1,
          y: 2,
          from_layer: "inner1",
          to_layer: "bottom",
        },
      ],
    })),
  ])
  const vias = pcb.getRecordsByKind("Via")
  expect(vias).toHaveLength(4)
  expect(vias.map((via) => pcb.getNetForRecord(via)?.name)).toEqual([
    "A",
    "A",
    "B",
    "B",
  ])
  expect(Number.parseFloat(vias[0]!.get("DIAMETER")!)).toBeCloseTo(
    0.9 / 0.0254,
    3,
  )
  expect(Number.parseFloat(vias[0]!.get("HOLESIZE")!)).toBeCloseTo(
    0.4 / 0.0254,
    3,
  )
  expect(Number.parseFloat(vias[2]!.get("DIAMETER")!)).toBeCloseTo(
    0.7 / 0.0254,
    3,
  )
  expect(Number.parseFloat(vias[2]!.get("HOLESIZE")!)).toBeCloseTo(
    0.35 / 0.0254,
    3,
  )
})

test("infers legacy inline layer transitions from neighboring wires", async () => {
  const { pcb } = await extractArchive([
    board({ num_layers: 4 }),
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      route: [
        { route_type: "wire", x: 0, y: 0, layer: "inner1", width: 0.2 },
        { route_type: "via", x: 1, y: 0 },
        { route_type: "wire", x: 2, y: 0, layer: "bottom", width: 0.2 },
      ],
    },
  ])
  expect(
    pcb
      .getRecordsByKind("Via")
      .map((via) => [via.get("STARTLAYER"), via.get("ENDLAYER")]),
  ).toEqual([["MID-LAYER1", "BOTTOM"]])
})
