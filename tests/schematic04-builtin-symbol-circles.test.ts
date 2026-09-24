import { expect, test } from "bun:test"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
} from "./fixtures"

test("converts built-in symbol circles to native ellipses", async () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("source_voltmeter", "VM1"),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_voltmeter",
      source_component_id: "source_voltmeter",
      center: { x: 0, y: 0 },
      size: { width: 1.08, height: 0.818_910_7 },
      symbol_name: "ac_voltmeter_right",
      symbol_display_value: "AC",
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected one generated schematic")
  const voltmeter = schematic.components.find(
    (component) => component.libraryReference === "ac_voltmeter_right",
  )
  if (!voltmeter) throw new Error("Expected a generated voltmeter component")

  const voltmeterRecords = schematic.getOwnedRecords(voltmeter)
  const circle = voltmeterRecords.find((record) => record.recordKind === "8")

  expect(circle?.getNumber("LOCATION.X")).toBe(200)
  expect(circle?.getNumber("LOCATION.Y")).toBe(150)
  expect(circle?.getNumber("RADIUS")).toBe(6)
  expect(circle?.getNumber("SECONDARYRADIUS")).toBe(6)
  expect(circle?.getBoolean("ISSOLID")).toBe(false)
  expect(voltmeterRecords.some((record) => record.recordKind === "14")).toBe(
    false,
  )
  expectValidSchematic(schematic)
})
