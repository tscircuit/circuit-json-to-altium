import { expect, test } from "bun:test"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
  sourcePort,
} from "./fixtures"

test("preserves boxed component body and pin geometry", async () => {
  const elements: CircuitElement[] = [
    board(),
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
      center: { x: 0, y: 0 },
      size: { width: 1.6, height: 1 },
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_chip_pin_1",
      schematic_component_id: "schematic_chip",
      source_port_id: "chip_pin_1",
      center: { x: -1.2, y: 0.3 },
      distance_from_component_edge: 0.4,
      facing_direction: "left",
      display_pin_label: "VCC",
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected one generated schematic")
  const chip = schematic.components.find(
    (component) => component.libraryReference === "U1",
  )
  if (!chip) throw new Error("Expected generated boxed component")
  const ownedRecords = schematic.getOwnedRecords(chip)
  const body = ownedRecords.find((record) => record.recordKind === "14")
  const designator = ownedRecords.find((record) => record.recordKind === "34")
  const comment = ownedRecords.find((record) => record.recordKind === "41")
  const pin = ownedRecords.find((record) => record.recordKind === "2")

  expect({
    body: {
      left: body?.getNumber("LOCATION.X"),
      bottom: body?.getNumber("LOCATION.Y"),
      right: body?.getNumber("CORNER.X"),
      top: body?.getNumber("CORNER.Y"),
    },
    pin: {
      x: pin?.getNumber("LOCATION.X"),
      y: pin?.getNumber("LOCATION.Y"),
      length: pin?.getNumber("PINLENGTH"),
    },
    text: {
      commentY: comment?.getNumber("LOCATION.Y"),
      designatorY: designator?.getNumber("LOCATION.Y"),
    },
  }).toEqual({
    body: { left: 196, bottom: 137, right: 228, top: 157 },
    pin: { x: 196, y: 153, length: 8 },
    text: { commentY: 125, designatorY: 169 },
  })
  expect(comment?.getBoolean("ISHIDDEN")).toBe(true)
  expect(comment?.getDecoded("TEXT")).toBe("")
  expectValidSchematic(schematic)
})
