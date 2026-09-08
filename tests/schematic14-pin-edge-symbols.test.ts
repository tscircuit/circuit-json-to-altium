import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

const circuitJson: CircuitJson = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_1",
    center: { x: 0, y: 0 },
    width: 12,
    height: 10,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "source_component",
    source_component_id: "source_component_1",
    ftype: "simple_chip",
    name: "U1",
  },
  ...["clock", "inverted", "inverted_clock"].map((portName, portIndex) => ({
    type: "source_port" as const,
    source_port_id: `source_port_${portIndex + 1}`,
    source_component_id: "source_component_1",
    pin_number: portIndex + 1,
    name: portName,
  })),
  {
    type: "schematic_component",
    schematic_component_id: "schematic_component_1",
    source_component_id: "source_component_1",
    center: { x: 0, y: 0 },
    size: { width: 4, height: 3 },
    is_box_with_pins: true,
  },
  {
    type: "schematic_port",
    schematic_port_id: "schematic_port_1",
    schematic_component_id: "schematic_component_1",
    source_port_id: "source_port_1",
    center: { x: -3, y: 0.7 },
    distance_from_component_edge: 1,
    facing_direction: "left",
    side_of_component: "left",
    pin_number: 1,
    display_pin_label: "CLOCK",
    has_input_arrow: true,
  },
  {
    type: "schematic_port",
    schematic_port_id: "schematic_port_2",
    schematic_component_id: "schematic_component_1",
    source_port_id: "source_port_2",
    center: { x: 3, y: 0 },
    distance_from_component_edge: 1,
    facing_direction: "right",
    side_of_component: "right",
    pin_number: 2,
    display_pin_label: "INVERTED",
    is_drawn_with_inversion_circle: true,
  },
  {
    type: "schematic_port",
    schematic_port_id: "schematic_port_3",
    schematic_component_id: "schematic_component_1",
    source_port_id: "source_port_3",
    center: { x: 0, y: 2.5 },
    distance_from_component_edge: 1,
    facing_direction: "up",
    side_of_component: "top",
    pin_number: 3,
    display_pin_label: "INVERTED CLOCK",
    has_input_arrow: true,
    is_drawn_with_inversion_circle: true,
  },
]

test("renders a schematic pin edge symbol round trip", async () => {
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "schematic-pin-symbols",
  })
  converter.runUntilFinished()
  const firstSchematic = converter.getOutput().schematics[0]
  if (!firstSchematic) throw new Error("Converter did not create a schematic")
  const altiumSchematic = parseAltiumSchDoc(firstSchematic.content)
  const clockPin = altiumSchematic.pins.find((pin) => pin.name === "CLOCK")
  const invertedPin = altiumSchematic.pins.find(
    (pin) => pin.name === "INVERTED",
  )
  const invertedClockPin = altiumSchematic.pins.find(
    (pin) => pin.name === "INVERTED CLOCK",
  )

  expect(clockPin?.getNumber("SYMBOL_INNEREDGE")).toBeUndefined()
  expect(invertedPin?.getNumber("SYMBOL_OUTEREDGE")).toBe(1)
  expect(invertedClockPin?.getNumber("SYMBOL_INNEREDGE")).toBeUndefined()
  expect(invertedClockPin?.getNumber("SYMBOL_OUTEREDGE")).toBe(1)
  const arrows = altiumSchematic.getRecordsByKind("7")
  expect(arrows).toHaveLength(2)
  expect(arrows[0]?.getNumber("X1")).toBe(clockPin?.getNumber("LOCATION.X"))
  expect(arrows[0]?.getNumber("X2")).toBeLessThan(arrows[0]!.getNumber("X1")!)
  for (const arrow of arrows) {
    expect(arrow.getNumber("OWNERINDEX")).toBe(
      clockPin?.getNumber("OWNERINDEX"),
    )
    expect(arrow.getNumber("LINEWIDTH")).toBe(0)
  }

  const sourceSvg = await convertCircuitJsonToSchematicSvg(circuitJson)
  const altiumSvg = serializeAltiumSheetToSvg(altiumSchematic)
  await expect(createSideBySideSvg(sourceSvg, altiumSvg)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
