import { expect, test } from "bun:test"
import {
  AltiumDimensionRecord,
  AltiumTextRecord,
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

const boardAnnotations: CircuitElement[] = [
  {
    type: "pcb_fabrication_note_path",
    pcb_fabrication_note_path_id: "board_path",
    pcb_component_id: "pcb_component_altium_board_graphics",
    layer: "bottom",
    route: [
      { x: 5, y: -2 },
      { x: 8, y: -2 },
      { x: 8, y: 1 },
    ],
    stroke_width: 0.15,
  },
  {
    type: "pcb_fabrication_note_rect",
    pcb_fabrication_note_rect_id: "board_rect",
    pcb_component_id: "pcb_component_altium_board_graphics",
    center: { x: 8, y: -5 },
    width: 4,
    height: 2,
    layer: "bottom",
    stroke_width: 0.12,
    is_filled: true,
  },
  {
    type: "pcb_fabrication_note_text",
    pcb_fabrication_note_text_id: "board_text",
    pcb_component_id: "pcb_component_altium_board_graphics",
    font: "tscircuit2024",
    font_size: 0.5,
    text: "BOARD",
    layer: "bottom",
    anchor_position: { x: 8, y: -5 },
    anchor_alignment: "center",
  },
  {
    type: "pcb_fabrication_note_dimension",
    pcb_fabrication_note_dimension_id: "board_dimension",
    pcb_component_id: "pcb_component_altium_board_graphics",
    layer: "bottom",
    from: { x: -8, y: -5 },
    to: { x: -8, y: 5 },
    offset_distance: 1,
    offset_direction: { x: -1, y: 0 },
    font: "tscircuit2024",
    font_size: 0.7,
    arrow_size: 0.5,
  },
]

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
    ...boardAnnotations,
  ]
  const { pcb } = await extractArchive(elements)
  const tracks = pcb.getRecordsByKind("Track")
  const dimensions = pcb.getRecordsByKind("Dimension")

  expect(
    tracks.filter((track) => track.get("LAYER") === "MECHANICAL15"),
  ).toHaveLength(4)
  expect(
    tracks.filter((track) => track.get("LAYER") === "MECHANICAL16"),
  ).toHaveLength(48)
  expect(
    tracks.filter((track) => track.get("LAYER") === "MECHANICAL1"),
  ).toHaveLength(6)
  expect(pcb.getRecordsByKind("Fill")[0]?.getBoolean("KEEPOUT")).toBe(true)
  expect(pcb.getRecordsByKind("Region")[0]?.get("LAYER")).toBe("KEEPOUT")
  expect(pcb.getRecordsByKind("Region")[0]?.getBoolean("KEEPOUT")).toBe(true)
  expect(pcb.getRecordsByKind("Text")[0]?.get("LAYER")).toBe("MECHANICAL1")
  expect(dimensions).toHaveLength(2)
  expect(dimensions[0]).toBeInstanceOf(AltiumDimensionRecord)
  expect(dimensions[0]?.get("LAYER")).toBe("MECHANICAL1")
  expect(pcb.components).toHaveLength(1)
  const componentAnnotations = pcb.records.filter(
    (record) => record.get("LAYER") === "MECHANICAL1",
  )
  expect(componentAnnotations).toHaveLength(8)
  expect(
    componentAnnotations.every(
      (record) => pcb.getComponentForRecord(record) === pcb.components[0],
    ),
  ).toBe(true)
  const standaloneAnnotations = pcb.records.filter(
    (record) => record.get("LAYER") === "MECHANICAL2",
  )
  expect(standaloneAnnotations).toHaveLength(9)
  expect(
    standaloneAnnotations.every(
      (record) => pcb.getComponentForRecord(record) === undefined,
    ),
  ).toBe(true)
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

test("exports board annotations without creating a physical component", async () => {
  const { pcb } = await extractArchive([board(), ...boardAnnotations])

  expect(pcb.components).toHaveLength(0)
  expect(pcb.getRecordsByKind("Track")).toHaveLength(6)
  expect(pcb.getRecordsByKind("Fill")).toHaveLength(1)
  const text = pcb.getRecordsByKind("Text")[0]
  expect(text).toBeInstanceOf(AltiumTextRecord)
  if (text instanceof AltiumTextRecord) expect(text.text).toBe("BOARD")
  expect(pcb.getRecordsByKind("Dimension")).toHaveLength(1)
  expect(
    pcb.records.every(
      (record) => pcb.getComponentForRecord(record) === undefined,
    ),
  ).toBe(true)
  expectValidPcb(pcb)
})

for (const annotation of boardAnnotations) {
  test(`rejects missing component references on ${annotation.type}`, async () => {
    await expect(
      extractArchive([
        board(),
        { ...annotation, pcb_component_id: "missing_component" },
      ]),
    ).rejects.toThrow(
      "PCB annotation references missing component missing_component",
    )
  })
}

test("does not treat arbitrary board-graphics prefixes as standalone owners", async () => {
  await expect(
    extractArchive([
      board(),
      {
        ...boardAnnotations[0]!,
        pcb_component_id: "pcb_component_altium_board_graphics_missing",
      },
    ]),
  ).rejects.toThrow(
    "PCB annotation references missing component pcb_component_altium_board_graphics_missing",
  )
})
