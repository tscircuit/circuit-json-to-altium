import { expect, test } from "bun:test"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
} from "./fixtures"

test("fills fallback component boxes like the Circuit JSON schematic", async () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("source_chip", "U1"),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_chip",
      source_component_id: "source_chip",
      center: { x: 0, y: 0 },
      size: { width: 1.6, height: 1 },
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected one generated schematic")
  const chip = schematic.components.find(
    (component) => component.libraryReference === "U1",
  )
  if (!chip) throw new Error("Expected generated boxed component")
  const body = schematic
    .getOwnedRecords(chip)
    .find((record) => record.recordKind === "14")

  expect(body?.getNumber("AREACOLOR")).toBe(0xc2_ffff)
  expect(body?.getBoolean("ISSOLID")).toBe(true)
  expectValidSchematic(schematic)
})
