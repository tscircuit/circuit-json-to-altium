import { expect, test } from "bun:test"
import { type AltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

const elements: CircuitElement[] = [
  board(),
  {
    type: "schematic_net_label",
    schematic_net_label_id: "rail_up",
    source_net_id: "source_net_vcc",
    center: { x: 0, y: 0 },
    anchor_position: { x: 0, y: 0 },
    anchor_side: "bottom",
    symbol_name: "rail_up",
    text: "VCC",
  },
  {
    type: "schematic_net_label",
    schematic_net_label_id: "ground_down",
    source_net_id: "source_net_ground",
    center: { x: 2, y: 0 },
    anchor_position: { x: 2, y: 0 },
    anchor_side: "top",
    symbol_name: "ground_down",
    text: "GND",
  },
  {
    type: "schematic_net_label",
    schematic_net_label_id: "rail_left",
    source_net_id: "source_net_left",
    center: { x: 4, y: 0 },
    anchor_position: { x: 4, y: 0 },
    anchor_side: "right",
    symbol_name: "rail_left",
    text: "LEFT_RAIL",
  },
  {
    type: "schematic_net_label",
    schematic_net_label_id: "ground_right",
    source_net_id: "source_net_right",
    center: { x: 6, y: 0 },
    anchor_position: { x: 6, y: 0 },
    anchor_side: "left",
    symbol_name: "ground_right",
    text: "RIGHT_GROUND",
  },
  {
    type: "schematic_net_label",
    schematic_net_label_id: "plain_label",
    source_net_id: "source_net_signal",
    center: { x: 8, y: 0 },
    anchor_position: { x: 8, y: 0 },
    anchor_side: "left",
    text: "SIGNAL",
  },
]

test("writes rail and ground net-label symbols as native power ports", async () => {
  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc

  expect(
    schematic.powerPorts.map((powerPort) => ({
      orientationIndex: powerPort.getNumber("ORIENTATION"),
      styleIndex: powerPort.getNumber("STYLE"),
      text: powerPort.text,
    })),
  ).toEqual([
    { orientationIndex: 1, styleIndex: 2, text: "VCC" },
    { orientationIndex: 3, styleIndex: 4, text: "GND" },
    { orientationIndex: 2, styleIndex: 2, text: "LEFT_RAIL" },
    { orientationIndex: 0, styleIndex: 4, text: "RIGHT_GROUND" },
  ])
  expect(schematic.netLabels.map((netLabel) => netLabel.text)).toEqual([
    "SIGNAL",
  ])
  expect(schematic.compoundFile?.getStream("/ObjectDefinitions")).toBeDefined()
  expect(schematic.getRecordsByKind("129")).toHaveLength(0)
  for (const port of schematic.powerPorts) {
    const id = port.getCaseInsensitive("ObjectDefinitionId")!
    const graphics = schematic.getObjectDefinitionGraphics(id)!
    expect(graphics).toHaveLength(port.getNumber("STYLE") === 2 ? 2 : 4)
    expect(graphics.every((r) => r.getNumber("LINEWIDTH") === 0)).toBe(true)
    const ownerIndex = schematic.objectDefinitionRecords
      .filter((record) => record.recordKind !== undefined)
      .findIndex(
        (record) => record.getCaseInsensitive("ObjectDefinitionId") === id,
      )
    expect(ownerIndex).toBeGreaterThanOrEqual(0)
    expect(
      graphics.every((r) => r.getNumber("OWNERINDEX") === ownerIndex),
    ).toBe(true)
  }
  // All four power ports must paint their custom hairline definitions,
  // including both ground orientations, instead of built-in power symbols.
  expect(
    serializeAltiumSheetToSvg(schematic).match(
      /<line data-record="13" vector-effect="non-scaling-stroke"/gu,
    ),
  ).toHaveLength(12)
  expectValidSchematic(schematic)
})
