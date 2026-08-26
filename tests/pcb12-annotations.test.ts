import { expect, test } from "bun:test"
import {
  AltiumArcRecord,
  AltiumDimensionRecord,
  serializeAltiumPcbToSvg,
} from "altiumts"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  board,
  type CircuitElement,
  expectValidPcb,
  extractArchive,
  pcbComponent,
  sourceComponent,
} from "./fixtures"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("preserves courtyards, keepouts, and fabrication annotations", async () => {
  const elements: CircuitElement[] = [
    board({ width: 24, height: 16 }),
    sourceComponent("sc1", "U1"),
    pcbComponent({ pcbComponentId: "pc1", sourceComponentId: "sc1" }),
    {
      type: "pcb_courtyard_outline",
      pcb_courtyard_outline_id: "courtyard_outline_1",
      pcb_component_id: "pc1",
      layer: "top",
      outline: [
        { x: -3, y: -2 },
        { x: 3, y: -2 },
        { x: 3, y: 2 },
        { x: -3, y: 2 },
      ],
    },
    {
      type: "pcb_courtyard_circle",
      pcb_courtyard_circle_id: "courtyard_circle_1",
      pcb_component_id: "pc1",
      layer: "bottom",
      center: { x: 0, y: 0 },
      radius: 2.5,
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "keepout_rect_1",
      shape: "rect",
      center: { x: -8, y: 4 },
      width: 3,
      height: 2,
      layers: ["top"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "keepout_circle_1",
      shape: "circle",
      center: { x: 8, y: 4 },
      radius: 1.4,
      layers: ["all"],
    },
    {
      type: "pcb_fabrication_note_path",
      pcb_fabrication_note_path_id: "fab_path_1",
      pcb_component_id: "pc1",
      layer: "top",
      route: [
        { x: -4, y: -4 },
        { x: 0, y: -6 },
        { x: 4, y: -4 },
      ],
      stroke_width: 0.15,
    },
    {
      type: "pcb_fabrication_note_rect",
      pcb_fabrication_note_rect_id: "fab_rect_1",
      pcb_component_id: "pc1",
      center: { x: 0, y: -5 },
      width: 9,
      height: 3,
      layer: "top",
      stroke_width: 0.12,
    },
    {
      type: "pcb_fabrication_note_text",
      pcb_fabrication_note_text_id: "fab_text_1",
      pcb_component_id: "pc1",
      font: "tscircuit2024",
      font_size: 0.7,
      text: "ASSEMBLY SIDE",
      layer: "top",
      anchor_position: { x: 0, y: -5 },
      anchor_alignment: "center",
    },
    {
      type: "pcb_fabrication_note_dimension",
      pcb_fabrication_note_dimension_id: "fab_dimension_1",
      pcb_component_id: "pc1",
      layer: "top",
      from: { x: -5, y: 5 },
      to: { x: 5, y: 5 },
      offset_distance: 2,
      offset_direction: { x: 0, y: 1 },
      font: "tscircuit2024",
      font_size: 0.7,
      arrow_size: 0.5,
    },
  ]
  const { pcb } = await extractArchive(elements)
  const arcs = pcb
    .getRecordsByKind("Arc")
    .filter((arc): arc is AltiumArcRecord => arc instanceof AltiumArcRecord)
  const tracks = pcb.getRecordsByKind("Track")
  const dimensions = pcb.getRecordsByKind("Dimension")

  expect(
    tracks.filter((track) => track.get("LAYER") === "MECHANICAL15"),
  ).toHaveLength(4)
  expect(arcs).toHaveLength(2)
  expect(arcs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        componentIndex: 0,
        isFullCircle: true,
        layer: "MECHANICAL16",
        radiusMils: 98.4252,
      }),
      expect.objectContaining({
        isFullCircle: true,
        layer: "KEEPOUT",
        radiusMils: 55.1181,
      }),
    ]),
  )
  expect(
    tracks.filter((track) => track.get("LAYER") === "MECHANICAL1"),
  ).toHaveLength(6)
  expect(pcb.getRecordsByKind("Fill")[0]?.getBoolean("KEEPOUT")).toBe(true)
  expect(
    arcs.find((arc) => arc.layer === "KEEPOUT")?.getBoolean("KEEPOUT"),
  ).toBe(true)
  expect(pcb.getRecordsByKind("Text")[0]?.get("LAYER")).toBe("MECHANICAL1")
  expect(dimensions).toHaveLength(1)
  expect(dimensions[0]).toBeInstanceOf(AltiumDimensionRecord)
  expect(dimensions[0]?.get("LAYER")).toBe("MECHANICAL1")
  expectValidPcb(pcb)

  const sourceSvg = await convertCircuitJsonToPcbSvg(elements as CircuitJson, {
    showCourtyards: true,
  })
  expect(sourceSvg).toContain(
    'data-pcb-courtyard-outline-id="courtyard_outline_1"',
  )
  expect(sourceSvg).toContain(
    'data-pcb-courtyard-circle-id="courtyard_circle_1"',
  )
  const altiumSvg = serializeAltiumPcbToSvg(pcb)
  await expect(createSideBySideSvg(sourceSvg, altiumSvg)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
