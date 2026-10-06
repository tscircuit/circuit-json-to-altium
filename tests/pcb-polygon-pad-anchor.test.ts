import { expect, test } from "bun:test"
import { getPolygonPadAnchor } from "../lib/get-polygon-pad-anchor"
import { board, extractArchive } from "./fixtures"

const concave = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 4 },
  { x: 0, y: 4 },
]

test("keeps the pad anchor inside a concave polygon", () => {
  const { center, diameter } = getPolygonPadAnchor(concave)
  expect(center.x < 1 || center.y < 1).toBe(true)
  expect(diameter).toBeGreaterThan(0)
  expect(() =>
    getPolygonPadAnchor([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
  ).toThrow("non-zero area")
})

test("exports concave bottom pads on bottom copper, solder, and paste", async () => {
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
  expect(pcb.pads).toHaveLength(1)
  expect(pcb.pads[0]!.get("LAYER")).toBe("BOTTOM")
  expect(pcb.regions.map((region) => region.layer)).toEqual([
    "BOTTOM",
    "BOTTOMSOLDER",
    "BOTTOMPASTE",
  ])
  expect(pcb.regions[0]!.geometry.outline.vertices).toHaveLength(7)
})
