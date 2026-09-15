import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"
import { pinNumberPositionCircuit } from "./fixtures/pin-number-position-circuit"

test("anchors native pin numbers near the body in all four orientations", async () => {
  const converter = new CircuitJsonToAltiumConverter(pinNumberPositionCircuit, {
    projectName: "pin-number-start",
  })
  converter.runUntilFinished()
  const doc = parseAltiumSchDoc(converter.getOutput().schematics[0]!.content)
  expectValidSchematic(doc)
  expect(doc.pins).toHaveLength(4)
  const svg = serializeAltiumSheetToSvg(doc)
  const pinGroups = [...svg.matchAll(/<g data-record="2">([\s\S]*?)<\/g>/gu)]
  expect(pinGroups).toHaveLength(4)
  for (const [index, pin] of doc.pins.entries()) {
    expect(pin.getNumber("PINDESIGNATOR_POSITIONCONGLOMERATE")).toBe(17)
    expect(pin.getNumber("DESIGNATOR_CUSTOMPOSITION_MARGIN")).toBe(-7)
    expect(pin.getNumber("NAME_CUSTOMPOSITION_MARGIN")).toBe(10)
    const group = pinGroups[index]![1]!
    const terminal = group.match(/<line x1="([\d.-]+)" y1="([\d.-]+)"/u)!
    const number = group.match(
      /<text[^>]*dominant-baseline="text-after-edge"[^>]*transform="translate\(([\d.-]+) ([\d.-]+)\) rotate\(([\d.-]+)\)"/u,
    )!
    const orientation = pin.getNumber("PINCONGLOMERATE")! & 3
    // SVG y increases downwards. Each number starts three units outside the body.
    expect(Number(number[1]) - Number(terminal[1])).toBeCloseTo(
      [-7, 0, 7, 0][orientation]!,
    )
    expect(Number(number[2]) - Number(terminal[2])).toBeCloseTo(
      [0, 7, 0, -7][orientation]!,
    )
    expect(Number(number[3])).toBe(orientation % 2 === 1 ? -90 : 0)
    expect(group.match(/font-size="3"/gu)).toHaveLength(2)
  }
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
