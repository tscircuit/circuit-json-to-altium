import { expect, test } from "bun:test"
import { type AltiumSchDoc, parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
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

test("uses explicit source sheet geometry without repositioning imported coordinates", () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_net_label",
      schematic_net_label_id: "source-label",
      source_net_id: "source-net",
      anchor_position: { x: 25, y: 25 },
      text: "SOURCE",
    },
  ]
  const converter = new CircuitJsonToAltiumConverter(elements, {
    schematicSheet: {
      circuitOrigin: { x: 0, y: 0 },
      height: 47.5,
      width: 75,
    },
  })
  converter.runUntilFinished()
  const schematic = parseAltiumSchDoc(
    converter.getOutput().schematics[0]!.content,
  )
  const sheet = schematic.getRecordsByKind("31")[0]

  expect({
    height: sheet?.getNumber("CUSTOMY"),
    labelLocation: {
      x: schematic.netLabels[0]?.getNumber("LOCATION.X"),
      y: schematic.netLabels[0]?.getNumber("LOCATION.Y"),
    },
    width: sheet?.getNumber("CUSTOMX"),
  }).toEqual({
    height: 950,
    labelLocation: { x: 500, y: 500 },
    width: 1500,
  })
  expectValidSchematic(schematic)
})
