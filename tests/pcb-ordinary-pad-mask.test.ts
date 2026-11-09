import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, type CircuitElement } from "./fixtures"

function exportPads(swapped = false) {
  const elements: CircuitElement[] = [board({ width: 8, height: 4 })]
  for (const [index, x] of [-2, 2].entries()) {
    elements.push({
      type: "pcb_smtpad",
      pcb_smtpad_id: `pad-${index}`,
      shape: "rect",
      x,
      y: 0,
      width: 1.5,
      height: 1,
      layer: "top",
      is_covered_with_solder_mask: swapped ? index === 1 : index === 0,
      soldermask_margin: 0.3,
    })
  }
  const converter = new CircuitJsonToAltiumConverter(elements)
  converter.runUntilFinished()
  const bytes = converter.getOutput().pcb.content
  return { bytes, pcb: parseAltiumBinaryPcbDoc(bytes) }
}

test("snapshots actual copper and mask openings for covered/exposed pads", async () => {
  const { pcb } = exportPads()
  const options = { width: 640, height: 320 }
  const copper = serializeAltiumPcbToSvg(pcb, { ...options, layers: ["TOP"] })
  const mask = serializeAltiumPcbToSvg(pcb, {
    ...options,
    layers: ["TOPSOLDER"],
  })
  await expect(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="352"><title>Actual copper and solder mask openings</title><rect width="1280" height="352" fill="white"/><g font-family="sans-serif" font-size="16"><text x="12" y="24">Copper: left covered, right exposed</text><text x="652" y="24">Actual top mask openings: requested margin 0.3 mm</text></g>${copper.replace("<svg ", '<svg x="0" y="32" ')}${mask.replace("<svg ", '<svg x="640" y="32" ')}</svg>`,
  ).toMatchSvgSnapshot(import.meta.path)
})

test("preserves coverage and the 0.3 mm margin in binary pad records", () => {
  const original = exportPads()
  const swapped = exportPads(true)
  expect(original.bytes).not.toEqual(swapped.bytes)
  const [covered, exposed] = original.pcb.getRecordsByKind("Pad")
  expect(covered!.getBoolean("TENTEDTOP")).toBe(true)
  expect(exposed!.getBoolean("TENTEDTOP")).toBe(false)
  expect(exposed!.get("SOLDERMASKEXPANSIONMODE")).toBe("Manual")
  expect(
    exposed!
      .getAltiumMeasurement("SOLDERMASKEXPANSION_MANUAL")
      ?.toMillimeters(),
  ).toBeCloseTo(0.3, 4)
})

for (const layer of ["top", "bottom"]) {
  for (const margin of [-0.1, 0, 0.3]) {
    test(`${layer} pads preserve signed mask margin ${margin} mm and rotation`, () => {
      const converter = new CircuitJsonToAltiumConverter([
        board(),
        {
          type: "pcb_smtpad",
          pcb_smtpad_id: "pad",
          shape: "rect",
          x: 0,
          y: 0,
          width: 1.5,
          height: 1,
          layer,
          ccw_rotation: 30,
          soldermask_margin: margin,
          is_covered_with_solder_mask: true,
        },
      ])
      converter.runUntilFinished()
      const pcb = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
      const pad = pcb.getRecordsByKind("Pad")[0]!
      expect(pad.getBoolean(`TENTED${layer.toUpperCase()}`)).toBe(true)
      expect(
        pad.getBoolean(layer === "top" ? "TENTEDBOTTOM" : "TENTEDTOP"),
      ).toBe(false)
      expect(pad.get("SOLDERMASKEXPANSIONMODE")).toBe("Manual")
      expect(pad.getNumber("ROTATION")).toBe(30)
      expect(
        pad.getAltiumMeasurement("SOLDERMASKEXPANSION_MANUAL")?.toMillimeters(),
      ).toBeCloseTo(margin, 4)
      expect(pad.getAltiumMeasurement("XSIZE")?.toMillimeters()).toBeCloseTo(
        1.5,
        4,
      )
      expect(pad.getAltiumMeasurement("YSIZE")?.toMillimeters()).toBeCloseTo(
        1,
        4,
      )
    })
  }
}
