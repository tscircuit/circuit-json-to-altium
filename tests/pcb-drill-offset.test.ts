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

test("preserves drill offsets in binary PcbDoc instead of emitting the zero-offset control", () => {
  const offset = exportHole({ x: 0.4, y: 0.2 })
  const control = exportHole({ x: 0, y: 0 })
  expect(offset.bytes).not.toEqual(control.bytes)
  const pad = offset.pcb.getRecordsByKind("Pad")[0]!
  const controlPad = control.pcb.getRecordsByKind("Pad")[0]!
  for (const field of ["X", "Y", "XSIZE", "YSIZE", "HOLESIZE", "PLATED"]) {
    expect(pad.get(field)).toBe(controlPad.get(field))
  }
  for (let ordinal = 0; ordinal < 32; ordinal++) {
    expect(
      pad.getAltiumMeasurement(`LAYER${ordinal}HOLEXOFFSET`)?.toMillimeters(),
    ).toBeCloseTo(0.4, 4)
    expect(
      pad.getAltiumMeasurement(`LAYER${ordinal}HOLEYOFFSET`)?.toMillimeters(),
    ).toBeCloseTo(0.2, 4)
  }
})

for (const [padCcwRotationDegrees, holeOffsetX, holeOffsetY] of [
  [0, -0.4, 0.2],
  [90, 0.4, 0.2],
  [180, 0.4, -0.2],
  [37, -0.4, -0.2],
]) {
  test(`retains board-relative drill position with pad rotation ${padCcwRotationDegrees}`, () => {
    const converter = new CircuitJsonToAltiumConverter([
      board(),
      {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: "slot",
        shape: "rotated_pill_hole_with_rect_pad",
        x: 2,
        y: -1,
        hole_width: 0.6,
        hole_height: 1,
        hole_ccw_rotation: 25,
        rect_pad_width: 2.5,
        rect_pad_height: 2,
        rect_ccw_rotation: padCcwRotationDegrees,
        hole_offset_x: holeOffsetX,
        hole_offset_y: holeOffsetY,
      },
    ])
    converter.runUntilFinished()
    const pcb = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
    const pad = pcb.getRecordsByKind("Pad")[0]!
    expect(pad.getNumber("ROTATION")).toBe(padCcwRotationDegrees!)
    expect(pad.getAltiumMeasurement("XSIZE")?.toMillimeters()).toBeCloseTo(
      2.5,
      4,
    )
    expect(pad.getAltiumMeasurement("YSIZE")?.toMillimeters()).toBeCloseTo(2, 4)
    expect(pad.getAltiumMeasurement("HOLESIZE")?.toMillimeters()).toBeCloseTo(
      0.6,
      4,
    )
    expect(pad.getAltiumMeasurement("SLOTLENGTH")?.toMillimeters()).toBeCloseTo(
      1,
      4,
    )
    const angle = (padCcwRotationDegrees! * Math.PI) / 180
    for (let ordinal = 0; ordinal < 32; ordinal++) {
      const x = pad
        .getAltiumMeasurement(`LAYER${ordinal}HOLEXOFFSET`)!
        .toMillimeters()
      const y = pad
        .getAltiumMeasurement(`LAYER${ordinal}HOLEYOFFSET`)!
        .toMillimeters()
      expect(x * Math.cos(angle) - y * Math.sin(angle)).toBeCloseTo(
        holeOffsetX!,
        4,
      )
      expect(x * Math.sin(angle) + y * Math.cos(angle)).toBeCloseTo(
        holeOffsetY!,
        4,
      )
    }
  })
}
