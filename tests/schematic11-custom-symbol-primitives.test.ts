import { expect, test } from "bun:test"
import {
  AltiumSchArcRecord,
  AltiumSchEllipseRecord,
  AltiumSchLineRecord,
  AltiumSchPolygonRecord,
  AltiumSchRectangleRecord,
} from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
  sourcePort,
} from "./fixtures"

const schematicComponentId = "schematic_component_custom"
const schematicSymbolId = "schematic_symbol_custom"

const elements: CircuitElement[] = [
  board(),
  sourceComponent("source_component_custom", "U1"),
  sourcePort({
    sourcePortId: "source_port_custom",
    sourceComponentId: "source_component_custom",
    pinNumber: 1,
  }),
  {
    type: "schematic_symbol",
    schematic_symbol_id: schematicSymbolId,
    name: "custom_symbol",
  },
  {
    type: "schematic_component",
    schematic_component_id: schematicComponentId,
    source_component_id: "source_component_custom",
    center: { x: 5, y: 5 },
    size: { width: 8, height: 6 },
  },
  {
    type: "schematic_port",
    schematic_port_id: "schematic_port_custom",
    schematic_component_id: schematicComponentId,
    source_port_id: "source_port_custom",
    center: { x: 1, y: 3 },
    facing_direction: "left",
  },
  {
    type: "schematic_line",
    schematic_line_id: "schematic_line_custom",
    schematic_component_id: schematicComponentId,
    schematic_symbol_id: schematicSymbolId,
    x1: 1,
    y1: 2,
    x2: 3,
    y2: 4,
    stroke_width: 0.1,
    color: "rgba(18, 52, 86)",
    is_dashed: true,
  },
  {
    type: "schematic_text",
    schematic_text_id: "schematic_text_custom",
    schematic_symbol_id: schematicSymbolId,
    position: { x: 5, y: 5 },
    text: "custom function",
    anchor: "center",
    font_size: 0.2,
  },
  {
    type: "schematic_path",
    schematic_path_id: "schematic_path_custom",
    schematic_symbol_id: schematicSymbolId,
    points: [
      { x: 4, y: 2 },
      { x: 6, y: 2 },
      { x: 5, y: 4 },
    ],
    stroke_width: 0.15,
    fill_color: "#abcdef",
    is_filled: true,
    is_dashed: false,
  },
  {
    type: "schematic_circle",
    schematic_circle_id: "schematic_circle_custom",
    schematic_symbol_id: schematicSymbolId,
    center: { x: 8, y: 4 },
    radius: 1.5,
    stroke_width: 0.1,
    color: "#112233",
    fill_color: "#ddeeff",
    is_filled: true,
    is_dashed: false,
  },
  {
    type: "schematic_arc",
    schematic_arc_id: "schematic_arc_custom",
    schematic_symbol_id: schematicSymbolId,
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
    schematic_symbol_id: schematicSymbolId,
    center: { x: 12, y: 5 },
    width: 4,
    height: 2,
    rotation: 0,
    stroke_width: 0.1,
    color: "#445566",
    is_filled: true,
    is_dashed: false,
  },
]

test("writes custom symbol primitives as owned native Altium records", async () => {
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
  const circle = ownedRecords.find(
    (record): record is AltiumSchEllipseRecord =>
      record instanceof AltiumSchEllipseRecord,
  )
  const arc = ownedRecords.find(
    (record): record is AltiumSchArcRecord =>
      record instanceof AltiumSchArcRecord,
  )
  const rectangle = ownedRecords.find(
    (record): record is AltiumSchRectangleRecord =>
      record instanceof AltiumSchRectangleRecord,
  )

  expect(line).toMatchObject({ recordKind: "13" })
  expect(line?.getNumber("LINEWIDTH")).toBe(2)
  expect(line?.getNumber("LINESTYLE")).toBe(1)
  expect(line?.getNumber("COLOR")).toBe(0x56_34_12)
  expect(polygon).toMatchObject({ recordKind: "7" })
  expect(polygon?.getNumber("LOCATIONCOUNT")).toBe(3)
  expect(polygon?.getNumber("COLOR")).toBe(132)
  expect(polygon?.getNumber("AREACOLOR")).toBe(0xef_cd_ab)
  expect(circle).toMatchObject({ recordKind: "8" })
  expect(circle?.getNumber("RADIUS")).toBe(30)
  expect(circle?.getNumber("SECONDARYRADIUS")).toBe(30)
  expect(arc).toMatchObject({ recordKind: "12" })
  expect(arc?.getNumber("STARTANGLE")).toBe(30)
  expect(arc?.getNumber("ENDANGLE")).toBe(120)
  expect(rectangle).toMatchObject({ recordKind: "14" })
  expect(rectangle?.getNumber("COLOR")).toBe(0x66_55_44)
  expect(rectangle?.getNumber("AREACOLOR")).toBe(0x66_55_44)
  expect(rectangle?.getBoolean("ISSOLID")).toBe(true)
  expect(
    ownedRecords.filter((record) => record.recordKind === "14"),
  ).toHaveLength(1)
  const designator = ownedRecords.find((record) => record.recordKind === "34")
  const pin = ownedRecords.find((record) => record.recordKind === "2")
  const customTexts = ownedRecords.filter(
    (record) =>
      record.recordKind === "4" &&
      record.getDecoded("TEXT") === "custom function",
  )
  expect(designator?.getBoolean("ISHIDDEN")).toBe(true)
  expect(pin?.getNumber("PINCONGLOMERATE")).toBe(34)
  expect(pin?.getNumber("COLOR")).toBe(132)
  expect(customTexts).toHaveLength(1)
  expectValidSchematic(schematic)
})
