import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "altiumts"
import { type CircuitElement, CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("shows rectangular through-hole pads shrinking on the real Quadcopter Controller board", async () => {
  const sourcePcb = parseAltiumPcbDoc(
    await Bun.file(
      new URL("../references/quadcopter-controller.PcbDoc", import.meta.url),
    ).text(),
  )
  const circuitJson = (await Bun.file(
    new URL(
      "./assets/quadcopter-controller-rect-pad.circuit.json",
      import.meta.url,
    ),
  ).json()) as CircuitElement[]
  const rectangularPads = circuitJson.filter(
    (element) =>
      element.type === "pcb_plated_hole" &&
      element.shape === "circular_hole_with_rect_pad",
  )
  expect(rectangularPads).toHaveLength(5)
  expect(rectangularPads.every((pad) => pad.rect_pad_width === 2.032)).toBe(
    true,
  )

  const converter = new CircuitJsonToAltiumConverter(circuitJson)
  converter.runUntilFinished()
  const exportedPcb = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const view = {
    viewSide: "top" as const,
    width: 800,
    height: 800,
    viewBox: { x: 4070, y: 3420, width: 350, height: 350 },
  }
  await expect(
    createSideBySideSvg(
      serializeAltiumPcbToSvg(sourcePcb, view),
      serializeAltiumPcbToSvg(exportedPcb, view),
      { source: "Original Altium", converted: "Current export" },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
