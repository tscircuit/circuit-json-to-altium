import { expect, test } from "bun:test"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
  sourcePort,
} from "./fixtures"

test("assigns consistent Altium part IDs across schematic sheets", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet-a",
      sheet_index: 1,
    },
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet-b",
      sheet_index: 2,
    },
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet-c",
      sheet_index: 3,
    },
    sourceComponent("source_component_u1", "U1"),
    sourcePort({
      sourcePortId: "source_port_u1_1",
      sourceComponentId: "source_component_u1",
      pinNumber: 1,
    }),
    sourcePort({
      sourcePortId: "source_port_u1_2",
      sourceComponentId: "source_component_u1",
      pinNumber: 2,
    }),
    sourcePort({
      sourcePortId: "source_port_u1_3",
      sourceComponentId: "source_component_u1",
      pinNumber: 3,
    }),
    {
      type: "schematic_symbol",
      schematic_symbol_id: "schematic_symbol_u1b",
      schematic_sheet_id: "sheet-b",
      name: "unit_b",
    },
    {
      type: "schematic_line",
      schematic_line_id: "schematic_line_u1b",
      schematic_symbol_id: "schematic_symbol_u1b",
      schematic_sheet_id: "sheet-b",
      x1: -1,
      y1: -1,
      x2: 1,
      y2: 1,
      stroke_width: 0.1,
    },
    {
      type: "schematic_component",
      schematic_component_id: "schematic_component_u1a",
      schematic_sheet_id: "sheet-a",
      source_component_id: "source_component_u1",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
      symbol_name: "boxresistor_right",
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_port_u1_1",
      schematic_component_id: "schematic_component_u1a",
      schematic_sheet_id: "sheet-a",
      source_port_id: "source_port_u1_1",
      center: { x: -1, y: 0 },
      facing_direction: "left",
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_u1a",
      schematic_component_id: "schematic_component_u1a",
      schematic_sheet_id: "sheet-a",
      text: "Unit A",
      position: { x: 0, y: 0 },
    },
    {
      type: "schematic_component",
      schematic_component_id: "schematic_component_u1b",
      schematic_sheet_id: "sheet-b",
      source_component_id: "source_component_u1",
      schematic_symbol_id: "schematic_symbol_u1b",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_port_u1_2",
      schematic_component_id: "schematic_component_u1b",
      schematic_sheet_id: "sheet-b",
      source_port_id: "source_port_u1_2",
      center: { x: -1, y: 0 },
      facing_direction: "left",
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_u1b",
      schematic_component_id: "schematic_component_u1b",
      schematic_sheet_id: "sheet-b",
      text: "Unit B",
      position: { x: 0, y: 0 },
    },
    {
      type: "schematic_component",
      schematic_component_id: "schematic_component_u1c",
      schematic_sheet_id: "sheet-c",
      source_component_id: "source_component_u1",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_port_u1_3",
      schematic_component_id: "schematic_component_u1c",
      schematic_sheet_id: "sheet-c",
      source_port_id: "source_port_u1_3",
      center: { x: -1, y: 0 },
      facing_direction: "left",
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_u1c",
      schematic_component_id: "schematic_component_u1c",
      schematic_sheet_id: "sheet-c",
      text: "Unit C",
      position: { x: 0, y: 0 },
    },
  ]

  const { schematicSources, schematics } = await extractArchive(
    elements,
    "multi-part",
  )
  const partOwnershipByFilename = schematicSources.flatMap(
    ({ filename }, schematicIndex) => {
      const schematic = schematics[schematicIndex]
      const component = schematic?.components[0]
      if (!schematic || !component) return []
      const ownedPartIds = [
        ...new Set(
          schematic.getOwnedRecords(component).flatMap((record) => {
            const ownerPartId = record.getNumber("OWNERPARTID")
            return ownerPartId !== undefined && ownerPartId > 0
              ? [ownerPartId]
              : []
          }),
        ),
      ]
      return [
        {
          currentPartId: component.getNumber("CURRENTPARTID"),
          filename,
          ownedPartIds,
        },
      ]
    },
  )

  expect(partOwnershipByFilename).toEqual([
    {
      currentPartId: 1,
      filename: "multi-part-01.SchDoc",
      ownedPartIds: [1],
    },
    {
      currentPartId: 2,
      filename: "multi-part-02.SchDoc",
      ownedPartIds: [2],
    },
    {
      currentPartId: 3,
      filename: "multi-part-03.SchDoc",
      ownedPartIds: [3],
    },
  ])
  for (const schematic of schematics) expectValidSchematic(schematic)
})
