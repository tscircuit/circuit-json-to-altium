import { expect, test } from "bun:test"
import type { AltiumSchDoc } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

const elements: CircuitElement[] = [
  board(),
  {
    type: "schematic_text",
    schematic_text_id: "section_title",
    text: "POWER SUPPLY",
    font_size: 0.6,
    position: { x: 0, y: 0 },
    rotation: 0,
    anchor: "top_left",
    color: "#ff0000",
  },
  {
    type: "schematic_text",
    schematic_text_id: "section_note",
    text: "3.3 V",
    font_size: 1.2,
    position: { x: 2, y: 1 },
    rotation: 0,
    anchor: "bottom_right",
    color: "#0000ff",
  },
  ...(["bottom", "left", "right", "top"] as const).map((anchor, index) => ({
    type: "schematic_text" as const,
    schematic_text_id: `short_anchor_${anchor}`,
    text: `SHORT ${anchor.toUpperCase()}`,
    font_size: 0.6,
    position: { x: index * 2, y: 3 },
    rotation: 0,
    anchor,
    color: "#ff0000",
  })),
  {
    type: "schematic_rect",
    schematic_rect_id: "section_box",
    center: { x: 4, y: 0 },
    width: 2,
    height: 1,
    rotation: 0,
    stroke_width: 0.1,
    color: "#112233",
    is_filled: true,
    fill_color: "#445566",
    is_dashed: false,
  },
  {
    type: "schematic_line",
    schematic_line_id: "feedback_line",
    x1: 3,
    y1: -2,
    x2: 4,
    y2: -1,
    stroke_width: 0.1,
    color: "#008000",
    is_dashed: true,
  },
  {
    type: "schematic_rect",
    schematic_rect_id: "inherited_fill_box",
    center: { x: 8, y: 0 },
    width: 2,
    height: 1,
    rotation: 0,
    stroke_width: 0.1,
    color: "#123456",
    is_filled: true,
    is_dashed: false,
  },
  {
    type: "schematic_path",
    schematic_path_id: "leader",
    points: [
      { x: 0, y: -2 },
      { x: 1, y: -1 },
      { x: 2, y: -2 },
    ],
    stroke_width: 0.05,
    stroke_color: "#778899",
    is_filled: false,
    is_dashed: false,
  },
  {
    type: "schematic_path",
    schematic_path_id: "filled_marker",
    points: [
      { x: 6, y: -2 },
      { x: 7, y: -2 },
      { x: 6.5, y: -1 },
    ],
    stroke_width: 0.05,
    stroke_color: "#aabbcc",
    is_filled: true,
    fill_color: "#ddeeff",
    is_dashed: false,
  },
]

test("writes schematic sheet annotations as native records", async () => {
  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc
  const sheetRecord = schematic.getRecordsByKind("31")[0]
  const labels = schematic.getRecordsByKind("4")
  const rectangle = schematic.getRecordsByKind("14")[0]
  const inheritedFillRectangle = schematic
    .getRecordsByKind("14")
    .find((record) => record.getNumber("COLOR") === 0x56_34_12)
  const line = schematic.getRecordsByKind("13")[0]
  const polyline = schematic.getRecordsByKind("6")[0]
  const polygon = schematic.getRecordsByKind("7")[0]

  expect({
    fontCount: sheetRecord?.getNumber("FONTIDCOUNT"),
    fontNames: [
      sheetRecord?.getDecoded("FONTNAME4"),
      sheetRecord?.getDecoded("FONTNAME5"),
    ],
    fontSizesPoints: [
      sheetRecord?.getNumber("SIZE4"),
      sheetRecord?.getNumber("SIZE5"),
    ],
  }).toEqual({
    fontCount: 5,
    fontNames: ["Arial", "Arial"],
    fontSizesPoints: [12, 24],
  })
  expect(
    labels.map((label) => ({
      color: label.getNumber("COLOR"),
      fontId: label.getNumber("FONTID"),
      justification: label.getNumber("JUSTIFICATION"),
      text: label.getDecoded("TEXT"),
    })),
  ).toEqual([
    { color: 0x00_00_ff, fontId: 4, justification: 6, text: "POWER SUPPLY" },
    { color: 0xff_00_00, fontId: 5, justification: 2, text: "3.3 V" },
    { color: 0x00_00_ff, fontId: 4, justification: 1, text: "SHORT BOTTOM" },
    { color: 0x00_00_ff, fontId: 4, justification: 3, text: "SHORT LEFT" },
    { color: 0x00_00_ff, fontId: 4, justification: 5, text: "SHORT RIGHT" },
    { color: 0x00_00_ff, fontId: 4, justification: 7, text: "SHORT TOP" },
  ])
  expect({
    areaColor: rectangle?.getNumber("AREACOLOR"),
    color: rectangle?.getNumber("COLOR"),
    isSolid: rectangle?.getBoolean("ISSOLID"),
    lineWidth: rectangle?.getNumber("LINEWIDTH"),
  }).toEqual({
    areaColor: 0x66_55_44,
    color: 0x33_22_11,
    isSolid: true,
    lineWidth: 2,
  })
  expect({
    areaColor: inheritedFillRectangle?.getNumber("AREACOLOR"),
    isSolid: inheritedFillRectangle?.getBoolean("ISSOLID"),
  }).toEqual({
    areaColor: 0x56_34_12,
    isSolid: true,
  })
  expect({
    color: line?.getNumber("COLOR"),
    lineStyle: line?.getNumber("LINESTYLE"),
    lineWidth: line?.getNumber("LINEWIDTH"),
  }).toEqual({
    color: 0x00_80_00,
    lineStyle: 1,
    lineWidth: 2,
  })
  expect({
    polygonAreaColor: polygon?.getNumber("AREACOLOR"),
    polygonColor: polygon?.getNumber("COLOR"),
    polygonPointCount: polygon?.getNumber("LOCATIONCOUNT"),
    polylineColor: polyline?.getNumber("COLOR"),
    polylinePointCount: polyline?.getNumber("LOCATIONCOUNT"),
  }).toEqual({
    polygonAreaColor: 0xff_ee_dd,
    polygonColor: 0xcc_bb_aa,
    polygonPointCount: 3,
    polylineColor: 0x99_88_77,
    polylinePointCount: 3,
  })
  expectValidSchematic(schematic)
})
