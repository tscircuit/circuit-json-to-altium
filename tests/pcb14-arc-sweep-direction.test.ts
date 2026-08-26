import { expect, test } from "bun:test"
import {
  AltiumArcRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, type CircuitElement, expectValidPcb } from "./fixtures"

test("preserves minor and major PCB arc sweep directions", async () => {
  const arcCases = [
    { centerX: -6, circuitSweepDegrees: 90 },
    { centerX: -2, circuitSweepDegrees: -90 },
    { centerX: 2, circuitSweepDegrees: 270 },
    { centerX: 6, circuitSweepDegrees: -270 },
  ]
  const circuitJson: CircuitElement[] = [
    board({ width: 18, height: 6 }),
    ...arcCases.map(({ centerX, circuitSweepDegrees }, arcIndex) => {
      const sweepRadians = (circuitSweepDegrees * Math.PI) / 180
      return {
        type: "pcb_silkscreen_path",
        pcb_silkscreen_path_id: `pcb_silkscreen_path_${arcIndex}`,
        layer: "top",
        route: [
          {
            x: centerX + 1,
            y: 0,
            bulge: Math.tan(sweepRadians / 4),
          },
          {
            x: centerX + Math.cos(sweepRadians),
            y: Math.sin(sweepRadians),
          },
        ],
        stroke_width: 0.15,
      }
    }),
  ]
  const converter = new CircuitJsonToAltiumConverter(circuitJson)
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const arcs = document.arcs.filter(
    (arc): arc is AltiumArcRecord => arc instanceof AltiumArcRecord,
  )

  expect(
    arcs.map(
      (arc) =>
        (arc.getNumber("ENDANGLE") ?? 0) - (arc.getNumber("STARTANGLE") ?? 0),
    ),
  ).toEqual([90, -90, 270, -270])
  expect(arcs.map((arc) => arc.radiusMils)).toEqual([
    39.3701, 39.3701, 39.3701, 39.3701,
  ])
  expectValidPcb(document)

  await expect(serializeAltiumPcbToSvg(document)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
