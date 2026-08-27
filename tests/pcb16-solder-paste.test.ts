import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidPcb,
  extractArchive,
} from "./fixtures"

test("writes Circuit JSON solder paste as native Altium paste graphics", async () => {
  const elements: CircuitElement[] = [
    board({ width: 24, height: 16 }),
    {
      type: "pcb_solder_paste",
      pcb_solder_paste_id: "pcb_solder_paste_rect",
      shape: "rect",
      x: -8,
      y: 3,
      width: 2.4,
      height: 1.2,
      layer: "top",
    },
    {
      type: "pcb_solder_paste",
      pcb_solder_paste_id: "pcb_solder_paste_rotated_rect",
      shape: "rotated_rect",
      x: -4,
      y: 3,
      width: 2.4,
      height: 1.2,
      ccw_rotation: 30,
      layer: "top",
    },
    {
      type: "pcb_solder_paste",
      pcb_solder_paste_id: "pcb_solder_paste_circle",
      shape: "circle",
      x: 0,
      y: 3,
      radius: 0.9,
      layer: "top",
    },
    {
      type: "pcb_solder_paste",
      pcb_solder_paste_id: "pcb_solder_paste_pill",
      shape: "pill",
      x: 4,
      y: 3,
      width: 3,
      height: 1.4,
      radius: 0.7,
      layer: "top",
    },
    {
      type: "pcb_solder_paste",
      pcb_solder_paste_id: "pcb_solder_paste_rotated_pill",
      shape: "rotated_pill",
      x: 8,
      y: 3,
      width: 3,
      height: 1.4,
      radius: 0.7,
      ccw_rotation: 30,
      layer: "top",
    },
    {
      type: "pcb_solder_paste",
      pcb_solder_paste_id: "pcb_solder_paste_oval",
      shape: "oval",
      x: -5,
      y: -3,
      width: 3,
      height: 1.5,
      layer: "bottom",
    },
    {
      type: "pcb_solder_paste",
      pcb_solder_paste_id: "pcb_solder_paste_polygon",
      shape: "polygon",
      points: [
        { x: 1, y: -4 },
        { x: 4, y: -4 },
        { x: 4, y: -2 },
        { x: 2.5, y: -2.8 },
        { x: 1, y: -2 },
      ],
      layer: "bottom",
    },
  ]
  const { pcb } = await extractArchive(elements)
  const pasteFills = pcb.getRecordsByKind("Fill")
  const pasteRegions = pcb.getRecordsByKind("Region")

  expectValidPcb(pcb)
  expect(pasteFills).toHaveLength(2)
  expect(pasteRegions).toHaveLength(5)
  expect(
    [...pasteFills, ...pasteRegions].map((record) =>
      record.getDecoded("LAYER"),
    ),
  ).toEqual([
    "TOPPASTE",
    "TOPPASTE",
    "TOPPASTE",
    "TOPPASTE",
    "TOPPASTE",
    "BOTTOMPASTE",
    "BOTTOMPASTE",
  ])
  await expect(serializeAltiumPcbToSvg(pcb)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
