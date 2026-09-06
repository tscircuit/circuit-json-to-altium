import { expect, test } from "bun:test"
import {
  getSchematicRecordPoints,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "altiumts"
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

  expect(clockPin?.get("SYMBOL_INNEREDGE")).toBeUndefined()
  expect(invertedPin?.get("SYMBOL_OUTEREDGE")).toBeUndefined()
  expect(invertedClockPin?.get("SYMBOL_INNEREDGE")).toBeUndefined()
  expect(invertedClockPin?.get("SYMBOL_OUTEREDGE")).toBeUndefined()

  const ownedRecords = altiumSchematic.getOwnedRecords(
    altiumSchematic.components[0]!,
  )
  const arrowRecords = ownedRecords.filter(
    (record) => record.recordKind === "7",
  )
  const inversionCircleRecords = ownedRecords.filter(
    (record) => record.recordKind === "8",
  )
  expect(arrowRecords).toHaveLength(2)
  expect(inversionCircleRecords).toHaveLength(2)

  for (const arrowRecord of arrowRecords) {
    expect(arrowRecord.getNumber("LINEWIDTH")).toBe(0)
    const arrowPoints = getSchematicRecordPoints(arrowRecord)
    const xs = arrowPoints.map((point) => point.x)
    const ys = arrowPoints.map((point) => point.y)
    const width = Math.max(...xs) - Math.min(...xs)
    const height = Math.max(...ys) - Math.min(...ys)
    expect(Math.max(width, height)).toBeCloseTo(2, 4)
    expect(Math.min(width, height)).toBeCloseTo(1.73205, 4)
  }
  for (const circleRecord of inversionCircleRecords) {
    expect(circleRecord.getNumber("RADIUS")).toBe(1)
    expect(circleRecord.get("RADIUS_FRAC")).toBe("20000")
  }

  const sourceSvg = await convertCircuitJsonToSchematicSvg(circuitJson)
  const altiumSvg = serializeAltiumSheetToSvg(altiumSchematic)
  await expect(createSideBySideSvg(sourceSvg, altiumSvg)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
