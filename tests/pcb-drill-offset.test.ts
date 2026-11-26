import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, type CircuitElement } from "./fixtures"
import { convertAltiumPcbToCircuitJson } from "./fixtures/convert-altium-pcb-to-circuit-json"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

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

let tiBoard: ReturnType<typeof buildTiBoard> | undefined

function exportTiBoard() {
  tiBoard ??= buildTiBoard()
  return tiBoard
}

async function buildTiBoard() {
  const source = parseAltiumBinaryPcbDoc(
    new Uint8Array(
      await Bun.file(
        new URL("../references/ti-pmp23595.PcbDoc", import.meta.url),
      ).arrayBuffer(),
    ),
  )
  const converter = new CircuitJsonToAltiumConverter(
    convertAltiumPcbToCircuitJson(source),
    { projectName: "PMP23595" },
  )
  converter.runUntilFinished()
  const pcb = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  return { source, pcb }
}

function getOffsetPads(pcb: ReturnType<typeof parseAltiumBinaryPcbDoc>) {
  return pcb
    .getRecordsByKind("Pad")
    .filter(
      (pad) =>
        Math.abs(
          pad.getAltiumMeasurement("LAYER0HOLEXOFFSET")?.toMillimeters() ?? 0,
        ) > 0.001,
    )
}

test("snapshots the actual TI PMP23595 board before and after export", async () => {
  const { source, pcb } = await exportTiBoard()
  const pads = getOffsetPads(source)
  expect(pads).toHaveLength(4)
  expect(
    pads
      .map((pad) => source.components[pad.getNumber("COMPONENT")!]!.designator)
      .sort(),
  ).toEqual(["T500", "T501", "T502", "T503"])
  for (const pad of pads) {
    expect(
      pad.getAltiumMeasurement("LAYER0HOLEXOFFSET")!.toMillimeters(),
    ).toBeCloseTo(-2.286, 6)
  }
  const options = {
    layers: ["TOP", "MULTILAYER", "TOPOVERLAY"],
    width: 800,
    height: 640,
  }
  await expect(
    createSideBySideSvg(
      serializeAltiumPcbToSvg(source, options),
      serializeAltiumPcbToSvg(pcb, options),
      { source: "TI PMP23595 source", converted: "Actual exported PcbDoc" },
    ),
  ).toMatchSvgSnapshot(import.meta.path)

  const renderTerminals = (document: typeof source) => {
    const terminalPads = document
      .getRecordsByKind("Pad")
      .filter((pad) =>
        ["T500", "T501", "T502", "T503"].includes(
          document.components[pad.getNumber("COMPONENT") ?? -1]?.designator ??
            "",
        ),
      )
    expect(terminalPads).toHaveLength(4)
    // Render unchanged records from each actual PCB, without nearby tracks
    // and pours obscuring the drill-to-copper displacement.
    return serializeAltiumPcbToSvg(
      parseAltiumPcbDoc(
        ["|RECORD=Board", ...terminalPads.map((pad) => pad.getString())].join(
          "\n",
        ),
      ),
      { layers: ["MULTILAYER"], width: 600, height: 480 },
    )
  }
  await expect(
    createSideBySideSvg(renderTerminals(source), renderTerminals(pcb), {
      source: "PMP23595 T500–T503: source",
      converted: "T500–T503: actual exported pads",
    }),
  ).toMatchSvgSnapshot(import.meta.path, "terminals")
}, 120_000)

test.failing("preserves the four real PMP23595 terminal drill offsets on every layer", async () => {
  const { source, pcb } = await exportTiBoard()
  for (const sourcePad of getOffsetPads(source)) {
    const designator =
      source.components[sourcePad.getNumber("COMPONENT")!]!.designator
    const componentIndex = pcb.components.findIndex(
      (component) => component.designator === designator,
    )
    expect(componentIndex).toBeGreaterThanOrEqual(0)
    const pad = pcb
      .getRecordsByKind("Pad")
      .find(
        (pad) =>
          pad.getNumber("COMPONENT") === componentIndex &&
          pad.getDecoded("NAME") === sourcePad.getDecoded("NAME"),
      )!
    expect(pad).toBeDefined()
    for (const field of ["XSIZE", "YSIZE", "HOLESIZE"]) {
      expect(pad.getAltiumMeasurement(field)!.toMillimeters()).toBeCloseTo(
        sourcePad.getAltiumMeasurement(field)!.toMillimeters(),
        4,
      )
    }
    expect(pad.getNumber("ROTATION")).toBe(sourcePad.getNumber("ROTATION"))
    for (let ordinal = 0; ordinal < 32; ordinal++) {
      for (const axis of ["X", "Y"]) {
        const field = `LAYER${ordinal}HOLE${axis}OFFSET`
        expect(
          pad.getAltiumMeasurement(field)?.toMillimeters() ?? 0,
        ).toBeCloseTo(sourcePad.getAltiumMeasurement(field)!.toMillimeters(), 4)
      }
    }
  }
}, 120_000)

test.failing("preserves drill offsets in binary PcbDoc instead of emitting the zero-offset control", () => {
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
  test.failing(`retains board-relative drill position with pad rotation ${padCcwRotationDegrees}`, () => {
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
