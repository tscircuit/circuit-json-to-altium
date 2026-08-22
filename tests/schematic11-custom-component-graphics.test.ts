import { expect, test } from "bun:test"
import {
  AltiumSchArcRecord,
  AltiumSchEllipseRecord,
  AltiumSchLineRecord,
  AltiumSchPolygonRecord,
  AltiumSchRoundedRectangleRecord,
} from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
} from "./fixtures"

const schematicComponentId = "schematic_component_custom"

const elements: CircuitElement[] = [
  board(),
  sourceComponent("source_component_custom", "U1"),
  {
    type: "schematic_component",
    schematic_component_id: schematicComponentId,
    source_component_id: "source_component_custom",
    center: { x: 5, y: 5 },
    size: { width: 8, height: 6 },
    symbol_name: "generic_chip",
  },
  {
    type: "schematic_line",
    schematic_line_id: "schematic_line_custom",
    schematic_component_id: schematicComponentId,
    x1: 1,
    y1: 2,
    x2: 3,
    y2: 4,
    stroke_width: 0.1,
    color: "#123456",
    is_dashed: true,
  },
  {
    type: "schematic_path",
    schematic_path_id: "schematic_path_custom",
    schematic_component_id: schematicComponentId,
    points: [
      { x: 4, y: 2 },
      { x: 6, y: 2 },
      { x: 5, y: 4 },
    ],
    stroke_width: 0.15,
    stroke_color: "#654321",
    fill_color: "#abcdef",
    is_filled: true,
    is_dashed: false,
  },
  {
    type: "schematic_oval",
    schematic_oval_id: "schematic_oval_custom",
    schematic_component_id: schematicComponentId,
    center: { x: 8, y: 4 },
    radius_x: 1.5,
    radius_y: 0.75,
    stroke_width: 0.1,
    color: "#112233",
    fill_color: "#ddeeff",
    is_filled: true,
    is_dashed: false,
  },
  {
    type: "schematic_arc",
    schematic_arc_id: "schematic_arc_custom",
    schematic_component_id: schematicComponentId,
    center: { x: 10, y: 5 },
    radius: 2,
    start_angle_degrees: 30,
    end_angle_degrees: 120,
    direction: "counterclockwise",
    stroke_width: 0.1,
    color: "#334455",
    is_dashed: false,
  },
  {
    type: "schematic_rect",
    schematic_rect_id: "schematic_rect_custom",
    schematic_component_id: schematicComponentId,
    center: { x: 12, y: 5 },
    width: 4,
    height: 2,
    corner_radius: 0.5,
    rotation: 0,
    stroke_width: 0.1,
    color: "#445566",
    fill_color: "#ffffff",
    is_filled: false,
    is_dashed: false,
  },
]

test("writes custom component graphics as owned native Altium records", async () => {
  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected a generated schematic")
  const component = schematic.components[0]
  if (!component) throw new Error("Expected a native Altium component")
  const ownedRecords = schematic.getOwnedRecords(component)

  const line = ownedRecords.find(
    (record): record is AltiumSchLineRecord =>
      record instanceof AltiumSchLineRecord,
  )
  const polygon = ownedRecords.find(
    (record): record is AltiumSchPolygonRecord =>
      record instanceof AltiumSchPolygonRecord,
  )
  const oval = ownedRecords.find(
    (record): record is AltiumSchEllipseRecord =>
      record instanceof AltiumSchEllipseRecord,
  )
  const arc = ownedRecords.find(
    (record): record is AltiumSchArcRecord =>
      record instanceof AltiumSchArcRecord,
  )
  const roundedRect = ownedRecords.find(
    (record): record is AltiumSchRoundedRectangleRecord =>
      record instanceof AltiumSchRoundedRectangleRecord,
  )

  expect(line).toMatchObject({ recordKind: "13" })
  expect(line?.getNumber("LINEWIDTH")).toBe(2)
  expect(line?.getNumber("LINESTYLE")).toBe(1)
  expect(line?.getNumber("COLOR")).toBe(0x56_34_12)
  expect(polygon).toMatchObject({ recordKind: "7" })
  expect(polygon?.getNumber("LOCATIONCOUNT")).toBe(3)
  expect(polygon?.getNumber("COLOR")).toBe(0x21_43_65)
  expect(polygon?.getNumber("AREACOLOR")).toBe(0xef_cd_ab)
  expect(oval).toMatchObject({ recordKind: "8" })
  expect(oval?.getNumber("RADIUS")).toBe(30)
  expect(oval?.getNumber("SECONDARYRADIUS")).toBe(15)
  expect(arc).toMatchObject({ recordKind: "12" })
  expect(arc?.getNumber("STARTANGLE")).toBe(30)
  expect(arc?.getNumber("ENDANGLE")).toBe(120)
  expect(roundedRect).toMatchObject({ recordKind: "10" })
  expect(roundedRect?.getNumber("CORNERXRADIUS")).toBe(10)
  expect(roundedRect?.getNumber("CORNERYRADIUS")).toBe(10)
  expect(ownedRecords.filter((record) => record.recordKind === "14")).toEqual(
    [],
  )
  expectValidSchematic(schematic)
})
