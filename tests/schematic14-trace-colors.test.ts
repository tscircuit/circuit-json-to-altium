import { expect, test } from "bun:test"
import { board, type CircuitElement, extractArchive } from "./fixtures"

test("writes schematic wire and junction colors to native records", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_trace",
      schematic_trace_id: "schematic_trace_signal",
      color: "#000080",
      edges: [
        {
          from: { x: 0, y: 0 },
          to: { x: 2, y: 0 },
        },
      ],
      junctions: [{ x: 2, y: 0, color: "#800000" }],
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]

  expect({
    junctionColor: schematic?.getRecordsByKind("29")[0]?.getNumber("COLOR"),
    wireColor: schematic?.getRecordsByKind("27")[0]?.getNumber("COLOR"),
  }).toEqual({
    junctionColor: 0x00_00_80,
    wireColor: 0x80_00_00,
  })
})
