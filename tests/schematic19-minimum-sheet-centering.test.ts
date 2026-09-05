import { expect, test } from "bun:test"
import type { AltiumSchDoc } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

test("centers compact schematic content on the minimum-size sheet", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_net_label",
      schematic_net_label_id: "left-label",
      source_net_id: "left-net",
      anchor_position: { x: 0, y: 0 },
      text: "LEFT",
    },
    {
      type: "schematic_net_label",
      schematic_net_label_id: "right-label",
      source_net_id: "right-net",
      anchor_position: { x: 2, y: 0 },
      text: "RIGHT",
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc
  const sheet = schematic.getRecordsByKind("31")[0]

  expect({
    areaColor: sheet?.getNumber("AREACOLOR"),
    height: sheet?.getNumber("CUSTOMY"),
    labelLocations: schematic.netLabels.map((label) => ({
      x: label.getNumber("LOCATION.X"),
      y: label.getNumber("LOCATION.Y"),
    })),
    width: sheet?.getNumber("CUSTOMX"),
  }).toEqual({
    areaColor: 0xf8_fc_ff,
    height: 300,
    labelLocations: [
      { x: 180, y: 150 },
      { x: 220, y: 150 },
    ],
    width: 400,
  })
  expectValidSchematic(schematic)
})
