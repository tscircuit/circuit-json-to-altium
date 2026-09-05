import { expect, test } from "bun:test"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
  sourcePort,
} from "./fixtures"

test("uses native pin text visibility for built-in and boxed symbols", async () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("source_resistor", "R1"),
    sourcePort({
      sourcePortId: "resistor_pin_1",
      sourceComponentId: "source_resistor",
      pinNumber: 1,
    }),
    sourcePort({
      sourcePortId: "resistor_pin_2",
      sourceComponentId: "source_resistor",
      pinNumber: 2,
    }),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_resistor",
      source_component_id: "source_resistor",
      center: { x: 0, y: 0 },
      size: { width: 0.6, height: 0.65 },
      symbol_name: "boxresistor_right",
      symbol_display_value: "1kΩ",
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_resistor_pin_1",
      schematic_component_id: "schematic_resistor",
      source_port_id: "resistor_pin_1",
      center: { x: -0.3, y: 0 },
      facing_direction: "left",
      display_pin_label: "anode",
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_resistor_pin_2",
      schematic_component_id: "schematic_resistor",
      source_port_id: "resistor_pin_2",
      center: { x: 0.3, y: 0 },
      facing_direction: "right",
      display_pin_label: "cathode",
    },
    sourceComponent("source_chip", "U1"),
    sourcePort({
      sourcePortId: "chip_pin_1",
      sourceComponentId: "source_chip",
      pinNumber: 1,
    }),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_chip",
      source_component_id: "source_chip",
      center: { x: 3, y: 0 },
      size: { width: 2, height: 1 },
      symbol_name: "generic_chip",
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_chip_pin_1",
      schematic_component_id: "schematic_chip",
      source_port_id: "chip_pin_1",
      center: { x: 2, y: 0 },
      facing_direction: "left",
      display_pin_label: "IN",
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected one generated schematic")
  const sheetRecord = schematic.getRecordsByKind("31")[0]
  const resistor = schematic.components.find(
    (component) => component.libraryReference === "boxresistor_right",
  )
  const chip = schematic.components.find(
    (component) => component.libraryReference === "generic_chip",
  )
  if (!resistor || !chip) {
    throw new Error("Expected generated resistor and chip components")
  }

  const resistorPins = schematic
    .getOwnedRecords(resistor)
    .filter((record) => record.recordKind === "2")
  const chipPin = schematic
    .getOwnedRecords(chip)
    .find((record) => record.recordKind === "2")

  expect(sheetRecord?.getNumber("SIZE1")).toBe(4)
  expect(sheetRecord?.getNumber("SIZE2")).toBe(4)
  expect(resistorPins.map((pin) => pin.getNumber("PINCONGLOMERATE"))).toEqual([
    34, 32,
  ])
  expect(
    resistorPins.map((pin) => ({
      color: pin.getNumber("COLOR"),
      length: pin.getNumber("PINLENGTH"),
      x: pin.getNumber("LOCATION.X"),
      y: pin.getNumber("LOCATION.Y"),
    })),
  ).toEqual([
    { color: 132, length: 2, x: 169, y: 150 },
    { color: 132, length: 2, x: 177, y: 150 },
  ])
  expect(chipPin?.getNumber("PINCONGLOMERATE")).toBe(58)
  expect(chipPin?.getNumber("COLOR")).toBe(132)
  expectValidSchematic(schematic)
})
