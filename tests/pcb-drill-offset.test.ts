import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, type CircuitElement } from "./fixtures"

function exportHole(offsets: { x: number; y: number }) {
  const circuitJson: CircuitElement[] = [
    board({ width: 4, height: 3 }),
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "offset-hole",
      shape: "circular_hole_with_rect_pad",
      hole_shape: "circle",
      pad_shape: "rect",
      x: 0,
      y: 0,
      rect_pad_width: 2,
      rect_pad_height: 1.6,
      hole_diameter: 0.6,
      layers: ["top", "bottom"],
      hole_offset_x: offsets.x,
      hole_offset_y: offsets.y,
    },
  ]
  const converter = new CircuitJsonToAltiumConverter(circuitJson)
  converter.runUntilFinished()
  const bytes = converter.getOutput().pcb.content
  return { bytes, pcb: parseAltiumBinaryPcbDoc(bytes) }
}

test("snapshots the native PCB export with a 0.4 mm X / 0.2 mm Y drill offset", async () => {
  const { pcb } = exportHole({ x: 0.4, y: 0.2 })
  await expect(
    serializeAltiumPcbToSvg(pcb, {
      layers: ["TOP", "MULTILAYER"],
      width: 640,
      height: 480,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test.failing("preserves drill offsets in binary PcbDoc instead of emitting the zero-offset control", () => {
  const offset = exportHole({ x: 0.4, y: 0.2 })
  const control = exportHole({ x: 0, y: 0 })
  expect(offset.bytes).not.toEqual(control.bytes)
  const pad = offset.pcb.getRecordsByKind("Pad")[0]!
  for (let ordinal = 0; ordinal < 32; ordinal++) {
    expect(
      pad.getAltiumMeasurement(`LAYER${ordinal}HOLEXOFFSET`)?.toMillimeters(),
    ).toBeCloseTo(0.4, 4)
    expect(
      pad.getAltiumMeasurement(`LAYER${ordinal}HOLEYOFFSET`)?.toMillimeters(),
    ).toBeCloseTo(0.2, 4)
  }
})
