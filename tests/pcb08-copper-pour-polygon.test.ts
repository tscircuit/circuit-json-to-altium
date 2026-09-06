import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, expectValidPcb } from "./fixtures"

test("exports polygonal copper pours on inner layers", () => {
  const converter = new CircuitJsonToAltiumConverter([
    board(),
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "pcb_copper_pour_polygon",
      covered_with_solder_mask: true,
      shape: "polygon",
      points: [
        { x: -4, y: -2 },
        { x: 4, y: -2 },
        { x: 1, y: 3 },
      ],
      layer: "inner2",
    },
  ])
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const polygon = document.polygons[0]
  const region = document.regions[0]

  expect(document.polygons).toHaveLength(1)
  expect(document.regions).toHaveLength(1)
  expect(polygon?.layer).toBe("MID-LAYER2")
  expect(region?.layer).toBe("MID-LAYER2")
  expect(region?.geometry.outline.vertices).toHaveLength(4)
  expect(region?.geometry.holes).toHaveLength(0)
  expectValidPcb(document)
})

test("keeps imported polygon outlines separate from their poured regions", () => {
  const converter = new CircuitJsonToAltiumConverter([
    board(),
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "imported-polygon-outline",
      altium_polygon_id: 7,
      altium_polygon_role: "outline",
      covered_with_solder_mask: true,
      shape: "polygon",
      points: [
        { x: -4, y: -3 },
        { x: 4, y: -3 },
        { x: 4, y: 3 },
        { x: -4, y: 3 },
      ],
      layer: "bottom",
    },
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "imported-poured-region",
      altium_polygon_id: 7,
      altium_polygon_role: "region",
      covered_with_solder_mask: true,
      shape: "polygon",
      points: [
        { x: -3, y: -2 },
        { x: 3, y: -2 },
        { x: 3, y: 2 },
        { x: -3, y: 2 },
      ],
      layer: "bottom",
    },
  ])
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)

  expect(document.polygons).toHaveLength(1)
  expect(document.regions).toHaveLength(1)
  expect(document.polygons[0]?.getNumber("ID")).toBe(7)
  expect(document.regions[0]?.polygonIndex).toBe(7)
  expectValidPcb(document)
})
