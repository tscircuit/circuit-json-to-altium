import { expect, test } from "bun:test"
import type { AltiumSchDoc } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

const anchorSides = ["bottom", "left", "right", "top"] as const

test("positions net-label text from its Circuit JSON anchor side", async () => {
  const elements: CircuitElement[] = [
    board(),
    ...anchorSides.map((anchorSide, index) => ({
      type: "schematic_net_label",
      schematic_net_label_id: `label-${anchorSide}`,
      source_net_id: `net-${anchorSide}`,
      center: { x: index * 2, y: 0 },
      anchor_position: { x: index * 2, y: 0 },
      anchor_side: anchorSide,
      text: anchorSide.toUpperCase(),
    })),
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc

  expect(
    schematic.netLabels.map((label) => ({
      color: label.getNumber("COLOR"),
      justification: label.getNumber("JUSTIFICATION"),
      orientation: label.getNumber("ORIENTATION"),
      text: label.getDecoded("TEXT"),
    })),
  ).toEqual([
    { color: 132, justification: 1, orientation: 0, text: "BOTTOM" },
    { color: 132, justification: 3, orientation: 0, text: "LEFT" },
    { color: 132, justification: 5, orientation: 0, text: "RIGHT" },
    { color: 132, justification: 7, orientation: 0, text: "TOP" },
  ])
  expectValidSchematic(schematic)
})
