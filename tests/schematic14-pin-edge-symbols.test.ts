import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { circuitJson } from "./fixtures/pin-edge-symbols-circuit"

test("renders a schematic pin edge symbol round trip", async () => {
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "schematic-pin-symbols",
  })
  converter.runUntilFinished()
  const firstSchematic = converter.getOutput().schematics[0]
  if (!firstSchematic) throw new Error("Converter did not create a schematic")
  const altiumSchematic = parseAltiumSchDoc(firstSchematic.content)
  const clockPin = altiumSchematic.pins.find((pin) => pin.name === "CLOCK")
  const invertedPin = altiumSchematic.pins.find(
    (pin) => pin.name === "INVERTED",
  )
  const invertedClockPin = altiumSchematic.pins.find(
    (pin) => pin.name === "INVERTED CLOCK",
  )

  // An input-direction arrow is not an IEEE clock edge symbol.
  expect(clockPin?.getNumber("SYMBOL_INNEREDGE")).toBeUndefined()
  expect(invertedPin?.getNumber("SYMBOL_OUTEREDGE")).toBeUndefined()
  expect(invertedClockPin?.getNumber("SYMBOL_INNEREDGE")).toBeUndefined()
  expect(invertedClockPin?.getNumber("SYMBOL_OUTEREDGE")).toBeUndefined()

  const sourceSvg = await convertCircuitJsonToSchematicSvg(circuitJson)
  const altiumSvg = serializeAltiumSheetToSvg(altiumSchematic)
  await expect(createSideBySideSvg(sourceSvg, altiumSvg)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
