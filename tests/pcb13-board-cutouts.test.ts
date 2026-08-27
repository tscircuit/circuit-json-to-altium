import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { board, type CircuitElement, extractArchive } from "./fixtures"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("repro: Circuit JSON board cutout shapes are missing from the generated Altium PCB", async () => {
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
      pcb_cutout_id: "pcb_cutout_path",
      pcb_board_id: "pcb_board_0",
      shape: "path",
      route: [
        { x: -2, y: -4 },
        { x: 0, y: -3 },
        { x: 2, y: -4 },
      ],
      slot_width: 0.8,
      slot_corner_radius: 0.4,
    },
  ]
  const { pcb } = await extractArchive(elements)
  const sourceSvg = await convertCircuitJsonToPcbSvg(elements as CircuitJson)
  const altiumSvg = serializeAltiumPcbToSvg(pcb)

  await expect(createSideBySideSvg(sourceSvg, altiumSvg)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
