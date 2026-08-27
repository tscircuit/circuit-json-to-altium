import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  board,
  type CircuitElement,
  expectValidPcb,
  extractArchive,
} from "./fixtures"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("exports rectangular, circular, and polygon board cutouts as native Altium regions", async () => {
  const elements: CircuitElement[] = [
    board({ pcb_board_id: "pcb_board_0", width: 24, height: 14 }),
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_polygon",
      pcb_board_id: "pcb_board_0",
      shape: "polygon",
      points: [
        { x: -3, y: -1.5 },
        { x: 3, y: -1.5 },
        { x: 2, y: 1.5 },
        { x: -2, y: 1.5 },
      ],
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_rect",
      pcb_board_id: "pcb_board_0",
      shape: "rect",
      center: { x: -8, y: 1 },
      width: 3,
      height: 2,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_circle",
      pcb_board_id: "pcb_board_0",
      shape: "circle",
      center: { x: 8, y: 1 },
      radius: 1.2,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_triangle",
      pcb_board_id: "pcb_board_0",
      shape: "polygon",
      points: [
        { x: -2, y: -4 },
        { x: 0, y: -3 },
        { x: 2, y: -4 },
      ],
    },
  ]
  const { pcb } = await extractArchive(elements)
  const cutouts = pcb.boardGeometry.cutouts
  expect(cutouts).toHaveLength(4)
  expect(cutouts.map(({ outline }) => outline.points.length)).toEqual([
    5, 5, 49, 4,
  ])
  expect(
    cutouts.every(
      ({ record }) =>
        record.getBoolean("ISBOARDCUTOUT") === true &&
        record.get("ISSHAPEBASED") === "FALSE" &&
        record.get("LAYER") === "MULTILAYER",
    ),
  ).toBe(true)
  expectValidPcb(pcb)

  const sourceSvg = await convertCircuitJsonToPcbSvg(elements as CircuitJson)
  const altiumSvg = serializeAltiumPcbToSvg(pcb)
  expect(altiumSvg).toContain('data-board-cutouts="4"')

  await expect(createSideBySideSvg(sourceSvg, altiumSvg)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test("preserves rounded rectangles and continuous, dashed, or closed path cutouts", async () => {
  const { pcb } = await extractArchive([
    board({ width: 20, height: 14 }),
    {
      type: "pcb_cutout",
      pcb_cutout_id: "rounded_rect",
      shape: "rect",
      center: { x: -6, y: 2 },
      width: 4,
      height: 2,
      rotation: 90,
      corner_radius: 0.5,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "continuous_path",
      shape: "path",
      route: [
        { x: -2, y: -1 },
        { x: 0, y: 0 },
        { x: 2, y: -1 },
      ],
      slot_width: 0.8,
      slot_corner_radius: 0.4,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "dashed_path",
      shape: "path",
      route: [
        { x: -3, y: -3 },
        { x: 3, y: -3 },
      ],
      slot_width: 0.6,
      slot_length: 1,
      space_between_slots: 1,
      slot_corner_radius: 0,
    },
    {
      type: "pcb_cutout",
      pcb_cutout_id: "closed_path",
      shape: "path",
      route: [
        { x: 4, y: 1 },
        { x: 7, y: 1 },
        { x: 7, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 1 },
      ],
      slot_width: 0.5,
    },
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "ordinary_region",
      covered_with_solder_mask: true,
      shape: "rect",
      center: { x: 0, y: 3 },
      width: 2,
      height: 1,
      rotation: 0,
      layer: "top",
    },
  ])

  expect(pcb.boardGeometry.cutouts).toHaveLength(6)
  expect(pcb.regions).toHaveLength(7)
  expect(pcb.boardGeometry.cutouts[0]?.outline.points).toHaveLength(33)
  expect(pcb.boardGeometry.cutouts[1]?.outline.points).toHaveLength(37)
  expect(
    pcb.boardGeometry.cutouts.filter(({ holes }) => holes.length > 0),
  ).toHaveLength(1)
  expect(pcb.boardGeometry.cutouts.at(-1)?.holes).toHaveLength(1)
  expect(pcb.regions.at(-1)?.get("ISBOARDCUTOUT")).toBeUndefined()
  expectValidPcb(pcb)
})
