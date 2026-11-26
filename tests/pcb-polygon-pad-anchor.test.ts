import { expect, test } from "bun:test"
import { board, extractArchive } from "./fixtures"

const concave = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 4 },
  { x: 0, y: 4 },
]

test.failing("rejects a polygon with zero copper area", async () => {
  await expect(
    extractArchive([
      board(),
      {
        type: "pcb_smtpad",
        shape: "polygon",
        layer: "bottom",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
      },
    ]),
  ).rejects.toThrow("non-zero area")
})

test.failing("exports concave bottom pads on bottom copper, solder, and paste", async () => {
  const { pcb } = await extractArchive([
    board(),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "polygon",
      pcb_component_id: "",
      pcb_port_id: "",
      shape: "polygon",
      layer: "bottom",
      points: concave,
    },
  ])
  const anchor = pcb.pads[0]!
  const x = anchor.getAltiumMeasurement("X")!.toMillimeters() - 25.4 - 10
  const y = anchor.getAltiumMeasurement("Y")!.toMillimeters() - 25.4 - 6
  expect(x).toBeGreaterThan(0)
  expect(y).toBeGreaterThan(0)
  expect(x < 1 || y < 1).toBe(true)
  expect(pcb.pads).toHaveLength(1)
  expect(pcb.pads[0]!.get("LAYER")).toBe("BOTTOM")
  expect(pcb.regions.map((region) => region.layer)).toEqual([
    "BOTTOM",
    "BOTTOMSOLDER",
    "BOTTOMPASTE",
  ])
  expect(pcb.regions[0]!.geometry.outline.vertices).toHaveLength(7)
})
