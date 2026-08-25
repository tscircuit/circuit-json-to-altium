import { expect, test } from "bun:test"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
} from "./fixtures"

test("preserves explicit root schematic sheet bounds", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_sheet",
      schematic_sheet_id: "root-sheet",
      center: { x: 25, y: 15 },
      width: 50,
      height: 30,
      is_root: true,
    },
    sourceComponent("source-component", "U1"),
    {
      type: "schematic_component",
      schematic_component_id: "schematic-component",
      schematic_sheet_id: "root-sheet",
      source_component_id: "source-component",
      center: { x: 25, y: 15 },
    },
  ]

  const result = await extractArchive(elements, "sheet-size")
  const schematic = result.schematics[0]!
  const sheetRecord = schematic.getRecordsByKind("31")[0]

  expect(result.schematicSources.map(({ filename }) => filename)).toEqual([
    "sheet-size.SchDoc",
  ])
  expect(sheetRecord?.getNumber("CUSTOMX")).toBe(1_000)
  expect(sheetRecord?.getNumber("CUSTOMY")).toBe(600)
  expect(schematic.components[0]?.position).toEqual({ x: 500, y: 300 })
  expectValidSchematic(schematic)
})
