import { expect, test } from "bun:test"
import { serializeAltiumSheetToSvg } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
} from "./fixtures"

test("creates a root schematic with sorted child sheet links", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet-b",
      sheet_index: 20,
    },
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet-a",
      sheet_index: 10,
      name: "power_supply",
      display_name: "Power Supply",
    },
    sourceComponent("sc-a", "A1"),
    sourceComponent("sc-b", "B1"),
    sourceComponent("sc-free", "FREE1"),
    {
      type: "source_port",
      source_port_id: "source-port-vin",
      name: "VIN",
    },
    {
      type: "source_port",
      source_port_id: "source-port-vout",
      name: "VOUT",
    },
    {
      type: "source_port",
      source_port_id: "source-port-data",
      name: "DATA",
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic-port-vin",
      schematic_sheet_id: "sheet-a",
      source_port_id: "source-port-vin",
      center: { x: -2, y: 0 },
      facing_direction: "left",
      has_input_arrow: true,
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic-port-vout",
      schematic_sheet_id: "sheet-a",
      source_port_id: "source-port-vout",
      center: { x: 2, y: 0 },
      facing_direction: "right",
      has_output_arrow: true,
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic-port-data",
      schematic_sheet_id: "sheet-b",
      source_port_id: "source-port-data",
      center: { x: -2, y: 0 },
      facing_direction: "left",
      has_input_arrow: true,
      has_output_arrow: true,
    },
    {
      type: "schematic_component",
      schematic_component_id: "sch-a",
      schematic_sheet_id: "sheet-a",
      source_component_id: "sc-a",
      center: { x: 0, y: 0 },
    },
    {
      type: "schematic_component",
      schematic_component_id: "sch-b",
      schematic_sheet_id: "sheet-b",
      source_component_id: "sc-b",
      center: { x: 0, y: 0 },
    },
    {
      type: "schematic_component",
      schematic_component_id: "sch-free",
      source_component_id: "sc-free",
      center: { x: 2, y: 0 },
    },
  ]

  const result = await extractArchive(elements, "multi")

  expect(result.schematicSources.map(({ filename }) => filename)).toEqual([
    "multi-01.SchDoc",
    "multi-02.SchDoc",
    "multi.SchDoc",
  ])
  expect(result.project.documents).toHaveLength(4)
  const schematicByFilename = new Map(
    result.schematicSources.map(({ filename }, index) => [
      filename,
      result.schematics[index]!,
    ]),
  )
  const rootSchematic = schematicByFilename.get("multi.SchDoc")!
  expect(
    rootSchematic.sheetLinks.map(({ fileName, name }) => ({
      fileName,
      name,
    })),
  ).toEqual([
    { fileName: "multi-01.SchDoc", name: "Power Supply" },
    { fileName: "multi-02.SchDoc", name: "Sheet 2" },
  ])
  expect(
    rootSchematic.sheetLinks.map(({ symbol }) =>
      rootSchematic
        .getOwnedRecords(symbol)
        .filter((record) => record.recordKind === "16")
        .map((record) => record.getDecoded("NAME")),
    ),
  ).toEqual([["VIN", "VOUT"], ["DATA"]])
  expect(
    rootSchematic.sheetLinks.map(({ symbol }) => ({
      areaColor: symbol.getNumber("AREACOLOR"),
      color: symbol.getNumber("COLOR"),
      isSolid: symbol.getBoolean("ISSOLID"),
    })),
  ).toEqual([
    { areaColor: 12_779_519, color: 132, isSolid: true },
    { areaColor: 12_779_519, color: 132, isSolid: true },
  ])
  expect(
    rootSchematic.sheetLinks.flatMap(({ symbol }) =>
      rootSchematic
        .getOwnedRecords(symbol)
        .filter((record) => record.recordKind === "16")
        .map((record) => ({
          areaColor: record.getNumber("AREACOLOR"),
          color: record.getNumber("COLOR"),
          textColor: record.getNumber("TEXTCOLOR"),
        })),
    ),
  ).toEqual([
    { areaColor: 12_779_519, color: 132, textColor: 132 },
    { areaColor: 12_779_519, color: 132, textColor: 132 },
    { areaColor: 12_779_519, color: 132, textColor: 132 },
  ])
  expect(
    schematicByFilename
      .get("multi-01.SchDoc")
      ?.components.map((component) => component.get("UNIQUEID")),
  ).toEqual(["sch-a"])
  expect(
    schematicByFilename
      .get("multi-02.SchDoc")
      ?.components.map((component) => component.get("UNIQUEID")),
  ).toEqual(["sch-b"])
  expect(
    rootSchematic.components.map((component) => component.get("UNIQUEID")),
  ).toEqual(["sch-free"])
  for (const schematic of result.schematics) expectValidSchematic(schematic)
  await expect(serializeAltiumSheetToSvg(rootSchematic)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test("does not reserve sheet space for hierarchy metadata", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet-a",
      sheet_index: 0,
    },
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet-b",
      sheet_index: 1,
    },
    {
      type: "schematic_group",
      schematic_group_id: "group-a",
      source_group_id: "source-group-a",
      center: { x: 0, y: 0 },
      width: 0,
      height: 0,
      schematic_component_ids: [],
    },
  ]

  const result = await extractArchive(elements, "metadata")
  const rootSchematic = result.schematics.find(
    (_, index) =>
      result.schematicSources[index]?.filename === "metadata.SchDoc",
  )
  const sheetRecord = rootSchematic?.getRecordsByKind("31")[0]

  expect({
    childLocations: rootSchematic?.sheetLinks.map(({ symbol }) => ({
      x: symbol.getNumber("LOCATION.X"),
      y: symbol.getNumber("LOCATION.Y"),
    })),
    height: sheetRecord?.getNumber("CUSTOMY"),
    width: sheetRecord?.getNumber("CUSTOMX"),
  }).toEqual({
    childLocations: [
      { x: 60, y: 240 },
      { x: 260, y: 240 },
    ],
    height: 300,
    width: 480,
  })
})
